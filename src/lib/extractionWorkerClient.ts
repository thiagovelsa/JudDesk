import { extractFromBuffer, type ExtractionResult } from './extractors'

type ExtractionWorkerRequest = {
  jobId: string
  fileName: string
  buffer: ArrayBuffer
}

type ExtractionWorkerResponse = {
  jobId: string
  result: ExtractionResult
}

let extractionWorker: Worker | null = null
let workerDisabled = false

function getExtractionWorker(): Worker | null {
  if (workerDisabled) return null
  if (typeof Worker === 'undefined') return null
  if (extractionWorker) return extractionWorker

  try {
    extractionWorker = new Worker(new URL('../workers/extraction.worker.ts', import.meta.url), {
      type: 'module',
    })
    return extractionWorker
  } catch (error) {
    workerDisabled = true
    console.warn('[ExtractionWorker] Falling back to main thread:', error)
    return null
  }
}

export async function extractFromBufferInBackground(
  buffer: ArrayBuffer,
  fileName: string,
  timeoutMs = 60000
): Promise<ExtractionResult> {
  const worker = getExtractionWorker()
  if (!worker) {
    return extractFromBuffer(buffer, fileName)
  }

  const jobId = `${Date.now()}-${Math.random().toString(36).slice(2)}`

  return new Promise<ExtractionResult>((resolve, reject) => {
    const cleanup = () => {
      worker.removeEventListener('message', onMessage)
      worker.removeEventListener('error', onError)
      clearTimeout(timeout)
    }

    const onMessage = (event: MessageEvent<ExtractionWorkerResponse>) => {
      if (event.data.jobId !== jobId) return
      cleanup()
      resolve(event.data.result)
    }

    const onError = (event: ErrorEvent) => {
      cleanup()
      reject(new Error(event.message || 'Falha na extração em background'))
    }

    const timeout = setTimeout(() => {
      cleanup()
      reject(new Error('Tempo limite excedido durante extração de texto'))
    }, timeoutMs)

    worker.addEventListener('message', onMessage)
    worker.addEventListener('error', onError)

    const payload: ExtractionWorkerRequest = { jobId, fileName, buffer }
    worker.postMessage(payload, [buffer])
  })
}

