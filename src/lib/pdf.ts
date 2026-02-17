import * as pdfjsLib from 'pdfjs-dist'

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString()

export interface PDFExtractionResult {
  text: string
  pageCount: number
  metadata?: {
    title?: string
    author?: string
    subject?: string
    keywords?: string
    creationDate?: Date
    modificationDate?: Date
  }
}

/**
 * Extracts text content from a PDF file
 * @param arrayBuffer - The PDF file as ArrayBuffer
 * @returns Promise with extracted text and metadata
 */
export async function extractTextFromPDF(
  arrayBuffer: ArrayBuffer
): Promise<PDFExtractionResult> {
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

  try {
    const pageCount = pdf.numPages
    let fullText = ''

    // Extract text from each page
    for (let i = 1; i <= pageCount; i++) {
      const page = await pdf.getPage(i)
      const textContent = await page.getTextContent()
      const pageText = textContent.items
        .map((item) => {
          if ('str' in item) {
            return item.str
          }
          return ''
        })
        .join(' ')

      fullText += pageText + '\n\n'
    }

    // Try to extract metadata
    let metadata: PDFExtractionResult['metadata']
    try {
      const pdfMetadata = await pdf.getMetadata()
      const info = pdfMetadata.info as Record<string, unknown>

      metadata = {
        title: info.Title as string | undefined,
        author: info.Author as string | undefined,
        subject: info.Subject as string | undefined,
        keywords: info.Keywords as string | undefined,
        creationDate: info.CreationDate
          ? new Date(info.CreationDate as string)
          : undefined,
        modificationDate: info.ModDate
          ? new Date(info.ModDate as string)
          : undefined,
      }
    } catch {
      // Metadata extraction failed, continue without it
    }

    return {
      text: fullText.trim(),
      pageCount,
      metadata,
    }
  } finally {
    // Cleanup: destroy PDF document to release memory and workers
    if (typeof pdf.destroy === 'function') {
      pdf.destroy()
    }
  }
}

/**
 * Reads a file from Tauri FS and extracts PDF text
 * @param filePath - Path to the PDF file
 * @returns Promise with extracted text and metadata
 */
export async function extractTextFromPDFFile(
  filePath: string
): Promise<PDFExtractionResult> {
  // Import Tauri FS plugin dynamically
  const { readFile } = await import('@tauri-apps/plugin-fs')

  const fileData = await readFile(filePath)
  return extractTextFromPDF(fileData.buffer as ArrayBuffer)
}

/**
 * Creates a text summary from extracted PDF content
 * @param text - Full extracted text
 * @param maxLength - Maximum length of summary (default 500)
 * @returns Truncated text with ellipsis if needed
 */
export function createTextSummary(text: string, maxLength: number = 500): string {
  if (text.length <= maxLength) {
    return text
  }

  // Try to break at a sentence boundary
  const truncated = text.substring(0, maxLength)
  const lastPeriod = truncated.lastIndexOf('.')
  const lastNewline = truncated.lastIndexOf('\n')

  const breakPoint = Math.max(lastPeriod, lastNewline)

  if (breakPoint > maxLength * 0.5) {
    return truncated.substring(0, breakPoint + 1).trim() + '...'
  }

  return truncated.trim() + '...'
}
