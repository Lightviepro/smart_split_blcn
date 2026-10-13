import { expect } from "chai";
import { network } from "hardhat";

const { ethers, networkHelpers } = await network.create();
const { parseEther } = ethers;

function makeAddresses(count: number): string[] {
  return Array.from({ length: count }, (_, i) =>
    ethers.getAddress(ethers.zeroPadValue(ethers.toBeHex(0x1000 + i), 20)),
  );
}

const sum = (values: bigint[]) => values.reduce((a, b) => a + b, 0n);

async function deployFixture() {
  const [sender, alice, bob, carol, dave] = await ethers.getSigners();
  const smartSplit = await ethers.deployContract("SmartSplit");
  const address = await smartSplit.getAddress();
  return { smartSplit, address, sender, alice, bob, carol, dave };
}

describe("SmartSplit", function () {
  describe("Deployment", function () {
    it("starts with paymentCount == 0", async function () {
      const { smartSplit } = await networkHelpers.loadFixture(deployFixture);
      expect(await smartSplit.paymentCount()).to.equal(0n);
    });

    it("has MAX_RECIPIENTS == 20", async function () {
      const { smartSplit } = await networkHelpers.loadFixture(deployFixture);
      expect(await smartSplit.MAX_RECIPIENTS()).to.equal(20n);
    });

    it("holds a balance of 0", async function () {
      const { address } = await networkHelpers.loadFixture(deployFixture);
      expect(await ethers.provider.getBalance(address)).to.equal(0n);
    });
  });

  describe("Successful splits", function () {
    it("pays a single recipient", async function () {
      const { smartSplit, sender, alice } = await networkHelpers.loadFixture(deployFixture);
      const amount = parseEther("0.001");

      await expect(
        smartSplit.splitPayment([alice.address], [amount], { value: amount }),
      ).to.changeEtherBalances(ethers, [sender, alice], [-amount, amount]);
    });

    it("splits equally among 3 recipients with exact balance changes", async function () {
      const { smartSplit, address, sender, alice, bob, carol } =
        await networkHelpers.loadFixture(deployFixture);
      const share = parseEther("0.01");

      await expect(
        smartSplit.splitPayment(
          [alice.address, bob.address, carol.address],
          [share, share, share],
          { value: share * 3n },
        ),
      ).to.changeEtherBalances(
        ethers,
        [sender, alice, bob, carol, address],
        [-share * 3n, share, share, share, 0n],
      );
    });

    it("handles unequal amounts", async function () {
      const { smartSplit, alice, bob, carol } = await networkHelpers.loadFixture(deployFixture);
      const amounts = [parseEther("0.005"), parseEther("0.0001"), 1n];

      await expect(
        smartSplit.splitPayment([alice.address, bob.address, carol.address], amounts, {
          value: sum(amounts),
        }),
      ).to.changeEtherBalances(ethers, [alice, bob, carol], amounts);
    });

    it("pays exactly 20 recipients (the maximum)", async function () {
      const { smartSplit } = await networkHelpers.loadFixture(deployFixture);
      const recipients = makeAddresses(20);
      const amounts = recipients.map((_, i) => BigInt(i + 1) * 1000n);

      await expect(
        smartSplit.splitPayment(recipients, amounts, { value: sum(amounts) }),
      ).to.changeEtherBalances(ethers, recipients, amounts);
      expect(await smartSplit.paymentCount()).to.equal(1n);
    });

    it("emits PaymentSplit with the exact arguments", async function () {
      const { smartSplit, sender, alice, bob } = await networkHelpers.loadFixture(deployFixture);
      const recipients = [alice.address, bob.address];
      const amounts = [parseEther("0.002"), parseEther("0.003")];
      const total = sum(amounts);

      const tx = await smartSplit.splitPayment(recipients, amounts, { value: total });
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt!.blockNumber);

      await expect(tx)
        .to.emit(smartSplit, "PaymentSplit")
        .withArgs(1n, sender.address, recipients, amounts, total, BigInt(block!.timestamp));
    });

    it("increments paymentCount for each split and uses it as the paymentId", async function () {
      const { smartSplit, sender, alice } = await networkHelpers.loadFixture(deployFixture);
      const amount = 100n;

      for (let id = 1n; id <= 3n; id++) {
        await expect(smartSplit.splitPayment([alice.address], [amount], { value: amount }))
          .to.emit(smartSplit, "PaymentSplit")
          .withArgs(id, sender.address, [alice.address], [amount], amount, (t: bigint) => t > 0n);
        expect(await smartSplit.paymentCount()).to.equal(id);
      }
    });

    it("keeps the contract balance at 0 after paying", async function () {
      const { smartSplit, address, alice, bob } = await networkHelpers.loadFixture(deployFixture);
      const amounts = [parseEther("0.1"), parseEther("0.2")];

      await smartSplit.splitPayment([alice.address, bob.address], amounts, {
        value: sum(amounts),
      });
      expect(await ethers.provider.getBalance(address)).to.equal(0n);
    });
  });

  describe("Validation reverts", function () {
    it("reverts with NoRecipients for an empty list", async function () {
      const { smartSplit } = await networkHelpers.loadFixture(deployFixture);
      await expect(smartSplit.splitPayment([], [], { value: 0n })).to.be.revertedWithCustomError(
        smartSplit,
        "NoRecipients",
      );
    });

    it("reverts with TooManyRecipients for 21 recipients", async function () {
      const { smartSplit } = await networkHelpers.loadFixture(deployFixture);
      const recipients = makeAddresses(21);
      const amounts = recipients.map(() => 1n);

      await expect(smartSplit.splitPayment(recipients, amounts, { value: 21n }))
        .to.be.revertedWithCustomError(smartSplit, "TooManyRecipients")
        .withArgs(21n, 20n);
    });

    it("reverts with LengthMismatch when arrays differ in length", async function () {
      const { smartSplit, alice, bob } = await networkHelpers.loadFixture(deployFixture);
      await expect(
        smartSplit.splitPayment([alice.address, bob.address], [1n], { value: 1n }),
      )
        .to.be.revertedWithCustomError(smartSplit, "LengthMismatch")
        .withArgs(2n, 1n);
    });

    it("reverts with ZeroAddress (and reports the index)", async function () {
      const { smartSplit, alice } = await networkHelpers.loadFixture(deployFixture);
      await expect(
        smartSplit.splitPayment([alice.address, ethers.ZeroAddress], [1n, 1n], { value: 2n }),
      )
        .to.be.revertedWithCustomError(smartSplit, "ZeroAddress")
        .withArgs(1n);
    });

    it("reverts with ContractAsRecipient when the contract pays itself", async function () {
      const { smartSplit, address } = await networkHelpers.loadFixture(deployFixture);
      await expect(smartSplit.splitPayment([address], [1n], { value: 1n }))
        .to.be.revertedWithCustomError(smartSplit, "ContractAsRecipient")
        .withArgs(0n);
    });

    it("reverts with SenderAsRecipient when the sender pays themself", async function () {
      const { smartSplit, sender, alice } = await networkHelpers.loadFixture(deployFixture);
      await expect(
        smartSplit.splitPayment([alice.address, sender.address], [1n, 1n], { value: 2n }),
      )
        .to.be.revertedWithCustomError(smartSplit, "SenderAsRecipient")
        .withArgs(1n);
    });

    it("reverts with ZeroAmount for a 0 wei amount", async function () {
      const { smartSplit, alice, bob } = await networkHelpers.loadFixture(deployFixture);
      await expect(
        smartSplit.splitPayment([alice.address, bob.address], [5n, 0n], { value: 5n }),
      )
        .to.be.revertedWithCustomError(smartSplit, "ZeroAmount")
        .withArgs(1n);
    });

    it("reverts with DuplicateRecipient for adjacent duplicates", async function () {
      const { smartSplit, alice } = await networkHelpers.loadFixture(deployFixture);
      await expect(
        smartSplit.splitPayment([alice.address, alice.address], [1n, 1n], { value: 2n }),
      )
        .to.be.revertedWithCustomError(smartSplit, "DuplicateRecipient")
        .withArgs(alice.address);
    });

    it("reverts with DuplicateRecipient for non-adjacent duplicates", async function () {
      const { smartSplit, alice, bob, carol, dave } =
        await networkHelpers.loadFixture(deployFixture);
      await expect(
        smartSplit.splitPayment(
          [alice.address, bob.address, carol.address, dave.address, bob.address],
          [1n, 1n, 1n, 1n, 1n],
          { value: 5n },
        ),
      )
        .to.be.revertedWithCustomError(smartSplit, "DuplicateRecipient")
        .withArgs(bob.address);
    });

    it("reverts with IncorrectValue when msg.value is too low", async function () {
      const { smartSplit, alice, bob } = await networkHelpers.loadFixture(deployFixture);
      await expect(
        smartSplit.splitPayment([alice.address, bob.address], [100n, 200n], { value: 299n }),
      )
        .to.be.revertedWithCustomError(smartSplit, "IncorrectValue")
        .withArgs(299n, 300n);
    });

    it("reverts with IncorrectValue when msg.value is too high", async function () {
      const { smartSplit, alice, bob } = await networkHelpers.loadFixture(deployFixture);
      await expect(
        smartSplit.splitPayment([alice.address, bob.address], [100n, 200n], { value: 301n }),
      )
        .to.be.revertedWithCustomError(smartSplit, "IncorrectValue")
        .withArgs(301n, 300n);
    });

    it("reverts with IncorrectValue when msg.value is 0", async function () {
      const { smartSplit, alice } = await networkHelpers.loadFixture(deployFixture);
      await expect(smartSplit.splitPayment([alice.address], [100n], { value: 0n }))
        .to.be.revertedWithCustomError(smartSplit, "IncorrectValue")
        .withArgs(0n, 100n);
    });

    it("does not change paymentCount when a payment reverts", async function () {
      const { smartSplit, alice } = await networkHelpers.loadFixture(deployFixture);
      await expect(
        smartSplit.splitPayment([alice.address], [100n], { value: 1n }),
      ).to.be.revertedWithCustomError(smartSplit, "IncorrectValue");
      expect(await smartSplit.paymentCount()).to.equal(0n);
    });
  });

  describe("Failed transfer (atomicity)", function () {
    it("reverts the whole payment with TransferFailed and changes no balances", async function () {
      const { smartSplit, address, alice, bob } = await networkHelpers.loadFixture(deployFixture);
      const rejecting = await ethers.deployContract("RejectingReceiver");
      const rejectingAddress = await rejecting.getAddress();

      const recipients = [alice.address, rejectingAddress, bob.address];
      const amounts = [1000n, 2000n, 3000n];
      const value = sum(amounts);

      const before = await Promise.all(
        [...recipients, address].map((a) => ethers.provider.getBalance(a)),
      );

      await expect(smartSplit.splitPayment(recipients, amounts, { value }))
        .to.be.revertedWithCustomError(smartSplit, "TransferFailed")
        .withArgs(rejectingAddress, 2000n);

      const after = await Promise.all(
        [...recipients, address].map((a) => ethers.provider.getBalance(a)),
      );
      expect(after).to.deep.equal(before);
      expect(await smartSplit.paymentCount()).to.equal(0n);
    });
  });

  describe("Reentrancy", function () {
    it("blocks re-entry with ReentrantCall; the outer payment completes", async function () {
      const { smartSplit, address, alice, bob } = await networkHelpers.loadFixture(deployFixture);
      const attacker = await ethers.deployContract("ReentrantReceiver", [address, bob.address]);
      const attackerAddress = await attacker.getAddress();

      const amounts = [1000n, 5000n];
      await expect(
        smartSplit.splitPayment([alice.address, attackerAddress], amounts, {
          value: sum(amounts),
        }),
      ).to.changeEtherBalances(
        ethers,
        [alice, attackerAddress, bob, address],
        [1000n, 5000n, 0n, 0n],
      );

      expect(await attacker.reentryAttempted()).to.equal(true);
      expect(await attacker.reentryBlocked()).to.equal(true);
      const selector = smartSplit.interface.getError("ReentrantCall")!.selector;
      expect(await attacker.reentryRevertData()).to.equal(selector);
      expect(await smartSplit.paymentCount()).to.equal(1n);
    });
  });

  describe("Direct ETH", function () {
    it("rejects a plain ETH transfer (receive)", async function () {
      const { smartSplit, address, sender } = await networkHelpers.loadFixture(deployFixture);
      await expect(
        sender.sendTransaction({ to: address, value: 1000n }),
      ).to.be.revertedWithCustomError(smartSplit, "DirectPaymentNotAccepted");
    });

    it("rejects a call with unknown calldata (fallback)", async function () {
      const { smartSplit, address, sender } = await networkHelpers.loadFixture(deployFixture);
      await expect(
        sender.sendTransaction({ to: address, value: 1000n, data: "0xdeadbeef" }),
      ).to.be.revertedWithCustomError(smartSplit, "DirectPaymentNotAccepted");
      await expect(
        sender.sendTransaction({ to: address, data: "0xdeadbeef" }),
      ).to.be.revertedWithCustomError(smartSplit, "DirectPaymentNotAccepted");
    });
  });

  describe("Smart-contract-wallet recipient", function () {
    it("pays a recipient whose receive() needs more than 2300 gas", async function () {
      const { smartSplit, alice } = await networkHelpers.loadFixture(deployFixture);
      const wallet = await ethers.deployContract("GasHeavyReceiver");
      const walletAddress = await wallet.getAddress();
      const amounts = [700n, 300n];

      await expect(
        smartSplit.splitPayment([walletAddress, alice.address], amounts, { value: 1000n }),
      ).to.changeEtherBalances(ethers, [walletAddress, alice], amounts);
      expect(await wallet.timesPaid()).to.equal(1n);
      expect(await wallet.totalReceived()).to.equal(700n);
    });

    it("(contrast) the same recipient cannot be paid with transfer()'s 2300 gas stipend", async function () {
      const wallet = await ethers.deployContract("GasHeavyReceiver");
      const transferSender = await ethers.deployContract("TransferSender");
      await expect(
        transferSender.payWithTransfer(await wallet.getAddress(), { value: 1000n }),
      ).to.be.revert(ethers);
    });
  });

  describe("Gas sanity", function () {
    it("records gas used for 1, 3, 10 and 20 recipients", async function () {
      const { smartSplit } = await networkHelpers.loadFixture(deployFixture);
      const rows: { recipients: number; gasUsed: bigint }[] = [];

      for (const n of [1, 3, 10, 20]) {
        const recipients = Array.from({ length: n }, (_, i) =>
          ethers.getAddress(ethers.zeroPadValue(ethers.toBeHex(0x3000 + n * 100 + i), 20)),
        );
        const amounts = recipients.map(() => parseEther("0.001"));

        const freshTx = await smartSplit.splitPayment(recipients, amounts, { value: sum(amounts) });
        const freshReceipt = await freshTx.wait();
        const tx = await smartSplit.splitPayment(recipients, amounts, { value: sum(amounts) });
        const receipt = await tx.wait();
        rows.push({ recipients: n, gasUsed: receipt!.gasUsed });
        console.log(
          `      gas: ${String(n).padStart(2)} recipients -> ${receipt!.gasUsed} (existing accounts), ${freshReceipt!.gasUsed} (new empty accounts)`,
        );
        expect(receipt!.gasUsed).to.be.lessThan(1_000_000n);
      }

      expect(rows[3].gasUsed).to.be.greaterThan(rows[0].gasUsed);
    });
  });
});
