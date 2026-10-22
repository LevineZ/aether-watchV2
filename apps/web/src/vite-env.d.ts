/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ESRI_API_KEY?: string
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}

declare module 'netcdfjs' {
  export class NetCDFReader {
    constructor(buffer: ArrayBuffer)
    dimensions: { name: string; size: number }[]
    variables: { name: string }[]
    getDataVariable(name: string): unknown
  }
}
