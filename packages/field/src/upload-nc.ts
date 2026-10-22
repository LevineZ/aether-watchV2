import { MAX_NC_BYTES, NcUploadError } from './types'
import type { BBox, FieldFrame } from './types'

export type UploadProgress = 'reading' | 'parsing' | 'done'

export async function parseNcFile(
  file: File,
  bbox: BBox,
  onStatus?: (s: UploadProgress) => void,
): Promise<FieldFrame> {
  if (!file) throw new NcUploadError('BAD_EXT', '未选择文件')
  const name = file.name || 'upload.nc'
  if (!/\.nc$/i.test(name) && !/\.nc3$/i.test(name) && !/\.cdf$/i.test(name)) {
    throw new NcUploadError('BAD_EXT', '请上传 .nc / .cdf 文件')
  }
  if (file.size > MAX_NC_BYTES) {
    throw new NcUploadError('TOO_LARGE', `文件 ${(file.size / 1024 / 1024).toFixed(1)}MB 超过 100MB，请压缩或裁剪区域后重试`)
  }

  onStatus?.('reading')
  const buffer = await file.arrayBuffer()
  onStatus?.('parsing')

  const worker = new Worker(new URL('./nc.worker.ts', import.meta.url), { type: 'module' })

  try {
    const frame = await new Promise<FieldFrame>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new NcUploadError('PARSE_FAILED', '解析超时（Worker 超过 30s）。请换更小的 NetCDF-3 文件。'))
      }, 30_000)
      worker.onmessage = (ev: MessageEvent) => {
        clearTimeout(timer)
        if (ev.data?.ok) resolve(ev.data.frame as FieldFrame)
        else {
          reject(new NcUploadError((ev.data?.code as NcUploadError['code']) || 'PARSE_FAILED', ev.data?.message || '解析失败'))
        }
      }
      worker.onerror = (e) => {
        clearTimeout(timer)
        reject(new NcUploadError('PARSE_FAILED', e.message || 'Worker 异常'))
      }
      worker.postMessage({ buffer, filename: name, bbox }, [buffer])
    })
    onStatus?.('done')
    return frame
  } finally {
    worker.terminate()
  }
}
