/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ENABLE_LOCAL_CHAIN?: string
  readonly VITE_LOG_CHUNK_SIZE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

interface EthereumProvider {
  isMetaMask?: boolean
  request(args: { method: string; params?: unknown[] | object }): Promise<unknown>
  on(event: string, listener: (...args: never[]) => void): void
  removeListener(event: string, listener: (...args: never[]) => void): void
}

interface Window {
  ethereum?: EthereumProvider
}
