/// <reference lib="webworker" />

import { extractFromBuffer, type ExtractionResult } from '@/lib/extractors'

type ExtractionWorkerRequest = {
  jobId: string
  fileName: string
  buffer: ArrayBuffer
}

type ExtractionWorkerResponse = {
  jobId: string
  result: ExtractionResult
}

self.onmessage = async (event: MessageEvent<ExtractionWorkerRequest>) => {
  const { jobId, fileName, buffer } = event.data
  const result = await extractFromBuffer(buffer, fileName)
  const response: ExtractionWorkerResponse = { jobId, result }
  self.postMessage(response)
}
