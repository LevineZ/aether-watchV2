import { MAX_NC_BYTES, NcUploadError } from './types'
import type { BBox, FieldFrame } from './types'
import { parseFieldFrameJson } from './parse-json'

export type UploadProgress = 'reading' | 'parsing' | 'done'

const NC_EXT = /\.(nc|nc4|nc3|cdf)$/i
const JSON_EXT = /\.json$/i

export async function parseNcFile(
  file: File,
  bbox?: BBox,
  onStatus?: (s: UploadProgress) => void,
): Promise<FieldFrame> {
  if (!file) throw new NcUploadError('BAD_EXT', '未选择文件')
  const name = file.name || 'upload'
  if (file.size > MAX_NC_BYTES) {
    throw new NcUploadError('TOO_LARGE', `文件过大（${(file.size / 1024 / 1024).toFixed(1)}MB，上限 100MB）`)
  }

  if (JSON_EXT.test(name) || file.type === 'application/json') {
    onStatus?.('reading')
    let text: string
    try {
      text = await file.text()
    } catch {
      throw new NcUploadError('PARSE_FAILED', '格式不支持')
    }
    onStatus?.('parsing')
    let raw: unknown
    try {
      raw = JSON.parse(text)
    } catch {
      throw new NcUploadError('BAD_FORMAT', '格式不支持')
    }
    const frame = parseFieldFrameJson(raw)
    onStatus?.('done')
    return frame
  }

  if (!NC_EXT.test(name)) {
    throw new NcUploadError('BAD_EXT', '格式不支持')
  }

  onStatus?.('reading')
  const buffer = await file.arrayBuffer()
  onStatus?.('parsing')

  const worker = new Worker(new URL('./nc.worker.ts', import.meta.url), { type: 'module' })

  try {
    const frame = await new Promise<FieldFrame>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new NcUploadError('PARSE_FAILED', '解析超时（Worker 超过 30s）。请换更小的 NetCDF-3 或 JSON。'))
      }, 30_000)
      worker.onmessage = (ev: MessageEvent) => {
        clearTimeout(timer)
        if (ev.data?.ok) resolve(ev.data.frame as FieldFrame)
        else {
          reject(
            new NcUploadError(
              (ev.data?.code as NcUploadError['code']) || 'PARSE_FAILED',
              ev.data?.message || '解析失败',
            ),
          )
        }
      }
      worker.onerror = (e) => {
        clearTimeout(timer)
        reject(new NcUploadError('PARSE_FAILED', e.message || 'Worker 异常'))
      }
      worker.postMessage({ buffer, filename: name, bbox: bbox ?? null }, [buffer])
    })
    onStatus?.('done')
    return frame
  } finally {
    worker.terminate()
  }
}
