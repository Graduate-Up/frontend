/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 백엔드 주소 (예: https://api.example.com). 비우면 같은 origin */
  readonly VITE_API_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
