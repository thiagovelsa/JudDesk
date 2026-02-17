/**
 * @fileoverview Módulo de extração de texto de múltiplos formatos de arquivo.
 * Suporta PDF, CSV, Excel (.xlsx/.xls), Word (.docx) e arquivos de texto (.txt/.md).
 *
 * @module extractors
 * @requires pdfjs-dist - Para extração de texto de PDFs
 * @requires papaparse - Para parsing de arquivos CSV
 * @requires xlsx - Para leitura de planilhas Excel
 * @requires mammoth - Para extração de texto de documentos Word
 */

import * as pdfjsLib from 'pdfjs-dist'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import mammoth from 'mammoth'

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString()

/**
 * Tipos de arquivo suportados pelo extrator
 */
export type FileType = 'pdf' | 'csv' | 'excel' | 'word' | 'text' | 'unknown'

/**
 * Resultado da extração de texto de um arquivo
 * @interface ExtractionResult
 */
export interface ExtractionResult {
  /** Texto extraído do arquivo */
  text: string
  /** Metadados do arquivo (título, autor, páginas, etc.) */
  metadata?: Record<string, string>
  /** Tipo do arquivo processado */
  type: FileType
  /** Número de linhas (para CSV/Excel) */
  rowCount?: number
  /** Mensagem de erro caso a extração falhe */
  error?: string
}

/**
 * Detecta o tipo de arquivo baseado na extensão
 * @param fileName - Nome do arquivo com extensão
 * @returns Tipo do arquivo (pdf, csv, excel, word, text, unknown)
 * @example
 * getFileType('documento.pdf') // 'pdf'
 * getFileType('dados.xlsx') // 'excel'
 */
export function getFileType(fileName: string): FileType {
  const ext = fileName.toLowerCase().split('.').pop() || ''

  const typeMap: Record<string, FileType> = {
    pdf: 'pdf',
    csv: 'csv',
    xlsx: 'excel',
    xls: 'excel',
    docx: 'word',
    doc: 'word',
    txt: 'text',
    md: 'text',
  }

  return typeMap[ext] || 'unknown'
}

/**
 * Verifica se o tipo de arquivo é suportado para extração
 * @param fileName - Nome do arquivo com extensão
 * @returns true se o arquivo pode ser processado
 */
export function isSupportedFileType(fileName: string): boolean {
  const type = getFileType(fileName)
  return type !== 'unknown'
}

/**
 * Retorna lista de extensões suportadas para uso em file pickers
 * @returns Array de extensões com ponto (ex: ['.pdf', '.csv'])
 */
export function getSupportedExtensions(): string[] {
  return ['.pdf', '.csv', '.xlsx', '.xls', '.docx', '.txt', '.md']
}

/**
 * Extract text from PDF buffer
 */
async function extractFromPDF(buffer: ArrayBuffer): Promise<ExtractionResult> {
  try {
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise
    const pageCount = pdf.numPages
    let fullText = ''

    for (let i = 1; i <= pageCount; i++) {
      const page = await pdf.getPage(i)
      const textContent = await page.getTextContent()
      const pageText = textContent.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ')
      fullText += pageText + '\n\n'
    }

    // Get metadata
    let metadata: Record<string, string> = {}
    try {
      const pdfMetadata = await pdf.getMetadata()
      const info = pdfMetadata.info as Record<string, unknown>
      if (info.Title) metadata.title = String(info.Title)
      if (info.Author) metadata.author = String(info.Author)
    } catch {
      // Ignore metadata errors
    }

    return {
      text: fullText.trim(),
      type: 'pdf',
      metadata: { ...metadata, pages: String(pageCount) },
    }
  } catch (error) {
    return {
      text: '',
      type: 'pdf',
      error: error instanceof Error ? error.message : 'Erro ao extrair PDF',
    }
  }
}

/**
 * Decode buffer with encoding detection.
 * Tries UTF-8 first, falls back to ISO-8859-1 if invalid characters detected.
 */
function decodeWithFallback(buffer: ArrayBuffer): string {
  // Try UTF-8 first
  const utf8Decoder = new TextDecoder('utf-8', { fatal: false })
  const utf8Text = utf8Decoder.decode(buffer)

  // Check for replacement character (indicates invalid UTF-8)
  if (utf8Text.includes('\uFFFD')) {
    // Fall back to ISO-8859-1 (Latin-1) which handles most Western encodings
    const latin1Decoder = new TextDecoder('iso-8859-1')
    return latin1Decoder.decode(buffer)
  }

  return utf8Text
}

/**
 * Extract text from CSV buffer
 */
async function extractFromCSV(buffer: ArrayBuffer): Promise<ExtractionResult> {
  try {
    const text = decodeWithFallback(buffer)

    const result = Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
    })

    if (result.errors.length > 0 && import.meta.env.DEV) {
      console.warn('CSV parse warnings:', result.errors)
    }

    const rows = result.data as Record<string, unknown>[]
    const headers = result.meta.fields || []

    // Format as readable text
    let formattedText = `Colunas: ${headers.join(', ')}\n\n`
    formattedText += `Total de linhas: ${rows.length}\n\n`
    formattedText += 'Dados:\n'

    rows.forEach((row, index) => {
      formattedText += `\nLinha ${index + 1}:\n`
      headers.forEach((header) => {
        formattedText += `  ${header}: ${row[header] ?? ''}\n`
      })
    })

    return {
      text: formattedText.trim(),
      type: 'csv',
      rowCount: rows.length,
      metadata: {
        columns: headers.join(', '),
        rows: String(rows.length),
      },
    }
  } catch (error) {
    return {
      text: '',
      type: 'csv',
      error: error instanceof Error ? error.message : 'Erro ao extrair CSV',
    }
  }
}

/**
 * Extract text from Excel buffer
 */
async function extractFromExcel(buffer: ArrayBuffer): Promise<ExtractionResult> {
  try {
    const workbook = XLSX.read(buffer, { type: 'array' })
    let fullText = ''
    let totalRows = 0

    workbook.SheetNames.forEach((sheetName) => {
      const worksheet = workbook.Sheets[sheetName]
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as unknown[][]

      if (jsonData.length === 0) return

      fullText += `=== Planilha: ${sheetName} ===\n\n`

      // First row as headers
      const headers = jsonData[0] as string[]
      fullText += `Colunas: ${headers.join(', ')}\n\n`

      // Data rows
      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i] as unknown[]
        fullText += `Linha ${i}:\n`
        row.forEach((cell, j) => {
          const header = headers[j] || `Col${j + 1}`
          fullText += `  ${header}: ${cell ?? ''}\n`
        })
        fullText += '\n'
        totalRows++
      }

      fullText += '\n'
    })

    return {
      text: fullText.trim(),
      type: 'excel',
      rowCount: totalRows,
      metadata: {
        sheets: workbook.SheetNames.join(', '),
        rows: String(totalRows),
      },
    }
  } catch (error) {
    return {
      text: '',
      type: 'excel',
      error: error instanceof Error ? error.message : 'Erro ao extrair Excel',
    }
  }
}

/**
 * Extract text from Word document buffer
 */
async function extractFromWord(buffer: ArrayBuffer): Promise<ExtractionResult> {
  try {
    const result = await mammoth.extractRawText({ arrayBuffer: buffer })

    if (result.messages.length > 0 && import.meta.env.DEV) {
      console.warn('Word extract warnings:', result.messages)
    }

    return {
      text: result.value.trim(),
      type: 'word',
    }
  } catch (error) {
    return {
      text: '',
      type: 'word',
      error: error instanceof Error ? error.message : 'Erro ao extrair Word',
    }
  }
}

/**
 * Extract text from plain text buffer
 */
async function extractFromText(buffer: ArrayBuffer): Promise<ExtractionResult> {
  try {
    const text = decodeWithFallback(buffer)

    return {
      text: text.trim(),
      type: 'text',
    }
  } catch (error) {
    return {
      text: '',
      type: 'text',
      error: error instanceof Error ? error.message : 'Erro ao ler arquivo',
    }
  }
}

/**
 * Extrai texto de um buffer de arquivo baseado no nome/extensão
 * @param buffer - ArrayBuffer contendo os dados do arquivo
 * @param fileName - Nome do arquivo (usado para detectar o tipo)
 * @returns Resultado da extração com texto, metadados e possíveis erros
 * @example
 * const file = await fetch('doc.pdf').then(r => r.arrayBuffer())
 * const result = await extractFromBuffer(file, 'doc.pdf')
 * console.log(result.text)
 */
export async function extractFromBuffer(
  buffer: ArrayBuffer,
  fileName: string
): Promise<ExtractionResult> {
  const fileType = getFileType(fileName)

  switch (fileType) {
    case 'pdf':
      return extractFromPDF(buffer)
    case 'csv':
      return extractFromCSV(buffer)
    case 'excel':
      return extractFromExcel(buffer)
    case 'word':
      return extractFromWord(buffer)
    case 'text':
      return extractFromText(buffer)
    default:
      return {
        text: '',
        type: 'unknown',
        error: `Tipo de arquivo não suportado: ${fileName}`,
      }
  }
}

/**
 * Extrai texto de um arquivo usando Tauri FS
 * @param filePath - Caminho absoluto do arquivo no sistema
 * @returns Resultado da extração com texto, metadados e possíveis erros
 * @throws Retorna ExtractionResult com error se arquivo não puder ser lido
 */
export async function extractFromFile(filePath: string): Promise<ExtractionResult> {
  try {
    const { readFile } = await import('@tauri-apps/plugin-fs')
    const fileData = await readFile(filePath)
    const buffer = fileData.buffer as ArrayBuffer

    // Get file name from path
    const fileName = filePath.split(/[/\\]/).pop() || filePath

    return extractFromBuffer(buffer, fileName)
  } catch (error) {
    return {
      text: '',
      type: 'unknown',
      error: error instanceof Error ? error.message : 'Erro ao ler arquivo',
    }
  }
}

/**
 * Formata tamanho de arquivo para exibição humana
 * Re-exported from utils.ts for backwards compatibility
 */
export { formatFileSize } from './utils'
