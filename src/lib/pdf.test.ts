import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as pdfjsLib from 'pdfjs-dist'

// Mock pdfjs-dist before importing the module
vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  getDocument: vi.fn(),
}))

// Mock @tauri-apps/plugin-fs
vi.mock('@tauri-apps/plugin-fs', () => ({
  readFile: vi.fn(),
}))

// Import after mocking
import { createTextSummary, extractTextFromPDF, extractTextFromPDFFile } from './pdf'

describe('PDF Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('extractTextFromPDF', () => {
    it('should extract text from PDF buffer', async () => {
      const mockPage = {
        getTextContent: vi.fn().mockResolvedValue({
          items: [
            { str: 'Hello' },
            { str: ' ' },
            { str: 'World' },
          ],
        }),
      }

      const mockPdf = {
        numPages: 1,
        getPage: vi.fn().mockResolvedValue(mockPage),
        getMetadata: vi.fn().mockResolvedValue({
          info: {
            Title: 'Test PDF',
            Author: 'Test Author',
          },
        }),
      }

      const mockGetDocument = pdfjsLib.getDocument as unknown as ReturnType<typeof vi.fn>
      mockGetDocument.mockReturnValue({
        promise: Promise.resolve(mockPdf),
      })

      const buffer = new ArrayBuffer(8)
      const result = await extractTextFromPDF(buffer)

      expect(result.text).toBe('Hello   World')
      expect(result.pageCount).toBe(1)
      expect(result.metadata?.title).toBe('Test PDF')
      expect(result.metadata?.author).toBe('Test Author')
    })

    it('should handle multiple pages', async () => {
      const mockPage1 = {
        getTextContent: vi.fn().mockResolvedValue({
          items: [{ str: 'Page 1' }],
        }),
      }
      const mockPage2 = {
        getTextContent: vi.fn().mockResolvedValue({
          items: [{ str: 'Page 2' }],
        }),
      }

      const mockPdf = {
        numPages: 2,
        getPage: vi.fn()
          .mockResolvedValueOnce(mockPage1)
          .mockResolvedValueOnce(mockPage2),
        getMetadata: vi.fn().mockResolvedValue({ info: {} }),
      }

      const mockGetDocument = pdfjsLib.getDocument as unknown as ReturnType<typeof vi.fn>
      mockGetDocument.mockReturnValue({
        promise: Promise.resolve(mockPdf),
      })

      const buffer = new ArrayBuffer(8)
      const result = await extractTextFromPDF(buffer)

      expect(result.pageCount).toBe(2)
      expect(result.text).toContain('Page 1')
      expect(result.text).toContain('Page 2')
    })

    it('should handle items without str property', async () => {
      const mockPage = {
        getTextContent: vi.fn().mockResolvedValue({
          items: [
            { str: 'Valid' },
            { other: 'no str' },
            { str: 'Text' },
          ],
        }),
      }

      const mockPdf = {
        numPages: 1,
        getPage: vi.fn().mockResolvedValue(mockPage),
        getMetadata: vi.fn().mockResolvedValue({ info: {} }),
      }

      const mockGetDocument = pdfjsLib.getDocument as unknown as ReturnType<typeof vi.fn>
      mockGetDocument.mockReturnValue({
        promise: Promise.resolve(mockPdf),
      })

      const buffer = new ArrayBuffer(8)
      const result = await extractTextFromPDF(buffer)

      expect(result.text).toContain('Valid')
      expect(result.text).toContain('Text')
    })

    it('should handle metadata extraction failure', async () => {
      const mockPage = {
        getTextContent: vi.fn().mockResolvedValue({
          items: [{ str: 'Content' }],
        }),
      }

      const mockPdf = {
        numPages: 1,
        getPage: vi.fn().mockResolvedValue(mockPage),
        getMetadata: vi.fn().mockRejectedValue(new Error('Metadata error')),
      }

      const mockGetDocument = pdfjsLib.getDocument as unknown as ReturnType<typeof vi.fn>
      mockGetDocument.mockReturnValue({
        promise: Promise.resolve(mockPdf),
      })

      const buffer = new ArrayBuffer(8)
      const result = await extractTextFromPDF(buffer)

      expect(result.text).toBe('Content')
      expect(result.metadata).toBeUndefined()
    })

    it('should parse creation and modification dates', async () => {
      const mockPage = {
        getTextContent: vi.fn().mockResolvedValue({
          items: [{ str: 'Content' }],
        }),
      }

      const mockPdf = {
        numPages: 1,
        getPage: vi.fn().mockResolvedValue(mockPage),
        getMetadata: vi.fn().mockResolvedValue({
          info: {
            CreationDate: '2024-01-15T10:30:00Z',
            ModDate: '2024-06-20T14:00:00Z',
          },
        }),
      }

      const mockGetDocument = pdfjsLib.getDocument as unknown as ReturnType<typeof vi.fn>
      mockGetDocument.mockReturnValue({
        promise: Promise.resolve(mockPdf),
      })

      const buffer = new ArrayBuffer(8)
      const result = await extractTextFromPDF(buffer)

      expect(result.metadata?.creationDate).toBeInstanceOf(Date)
      expect(result.metadata?.modificationDate).toBeInstanceOf(Date)
    })
  })

  describe('extractTextFromPDFFile', () => {
    it('should read file and extract text', async () => {
      const mockBuffer = new ArrayBuffer(8)
      const mockFileData = { buffer: mockBuffer }

      const { readFile } = await import('@tauri-apps/plugin-fs')
      ;(readFile as ReturnType<typeof vi.fn>).mockResolvedValue(mockFileData)

      const mockPage = {
        getTextContent: vi.fn().mockResolvedValue({
          items: [{ str: 'File content' }],
        }),
      }

      const mockPdf = {
        numPages: 1,
        getPage: vi.fn().mockResolvedValue(mockPage),
        getMetadata: vi.fn().mockResolvedValue({ info: {} }),
      }

      const mockGetDocument = pdfjsLib.getDocument as unknown as ReturnType<typeof vi.fn>
      mockGetDocument.mockReturnValue({
        promise: Promise.resolve(mockPdf),
      })

      const result = await extractTextFromPDFFile('/path/to/file.pdf')

      expect(readFile).toHaveBeenCalledWith('/path/to/file.pdf')
      expect(result.text).toBe('File content')
    })
  })
  describe('createTextSummary', () => {
    it('should return full text if shorter than maxLength', () => {
      const text = 'This is a short text.'
      const result = createTextSummary(text, 500)
      expect(result).toBe(text)
    })

    it('should truncate text at sentence boundary', () => {
      const text =
        'This is the first sentence. This is the second sentence. This is the third sentence that should be cut off.'
      const result = createTextSummary(text, 60)

      expect(result).toContain('first sentence.')
      expect(result.endsWith('...')).toBe(true)
    })

    it('should truncate at maxLength if no good break point', () => {
      const text = 'abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyz'
      const result = createTextSummary(text, 20)

      expect(result.length).toBeLessThanOrEqual(23)
      expect(result.endsWith('...')).toBe(true)
    })

    it('should handle text with newlines', () => {
      const text = 'First paragraph here.\n\nSecond paragraph that is much longer and should be truncated after the first newline break point.'
      const result = createTextSummary(text, 50)

      expect(result.endsWith('...')).toBe(true)
    })

    it('should use default maxLength of 500', () => {
      const shortText = 'Short text'
      const result = createTextSummary(shortText)
      expect(result).toBe(shortText)
    })

    it('should handle empty string', () => {
      const result = createTextSummary('')
      expect(result).toBe('')
    })
  })
})
