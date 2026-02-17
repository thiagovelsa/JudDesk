/**
 * @fileoverview Componente de visualização de PDF integrado.
 * Oferece navegação entre páginas, controle de zoom, modo tela cheia e download.
 *
 * @module PDFViewer
 * @requires pdfjs-dist - Biblioteca para renderização de PDFs
 * @requires @tauri-apps/plugin-fs - Para leitura de arquivos do sistema
 * @requires @tauri-apps/plugin-dialog - Para diálogo de download
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import {
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Download,
  Maximize2,
  Minimize2,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString()

/**
 * Props do componente PDFViewer
 * @interface PDFViewerProps
 */
interface PDFViewerProps {
  /** Caminho absoluto do arquivo PDF no sistema */
  filePath: string
  /** Nome do arquivo para exibição no header */
  fileName: string
  /** Callback chamado ao fechar o visualizador */
  onClose: () => void
}

/** Níveis de zoom disponíveis (50% a 200%) */
const ZOOM_LEVELS = [0.5, 0.75, 1, 1.25, 1.5, 2]
/** Índice do zoom padrão (100%) */
const DEFAULT_ZOOM_INDEX = 2

/**
 * Componente de visualização de PDF em modal fullscreen.
 *
 * Funcionalidades:
 * - Navegação entre páginas (setas do teclado ou botões)
 * - Zoom in/out (teclas +/- ou botões)
 * - Modo tela cheia
 * - Download do arquivo
 * - Atalhos de teclado (Esc para fechar, setas para navegar)
 *
 * @param props - {@link PDFViewerProps}
 * @example
 * <PDFViewer
 *   filePath="/path/to/document.pdf"
 *   fileName="document.pdf"
 *   onClose={() => setShowViewer(false)}
 * />
 */
export default function PDFViewer({ filePath, fileName, onClose }: PDFViewerProps) {
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [zoomIndex, setZoomIndex] = useState(DEFAULT_ZOOM_INDEX)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [rendering, setRendering] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const zoom = ZOOM_LEVELS[zoomIndex]

  // Load PDF document
  useEffect(() => {
    let currentPdf: pdfjsLib.PDFDocumentProxy | null = null
    let isMounted = true

    const loadPDF = async () => {
      setLoading(true)
      setError(null)

      try {
        const { readFile } = await import('@tauri-apps/plugin-fs')
        const fileData = await readFile(filePath)
        const arrayBuffer = fileData.buffer as ArrayBuffer

        const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

        if (!isMounted) {
          pdfDoc.destroy()
          return
        }

        currentPdf = pdfDoc
        setPdf(pdfDoc)
        setTotalPages(pdfDoc.numPages)
        setCurrentPage(1)
      } catch (err) {
        if (isMounted) {
          console.error('Error loading PDF:', err)
          setError('Erro ao carregar o PDF. Verifique se o arquivo existe.')
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    loadPDF()

    // Cleanup: destroy PDF document to free memory
    return () => {
      isMounted = false
      if (currentPdf) {
        currentPdf.destroy()
      }
    }
  }, [filePath])

  // Render current page - using ref to avoid loop from rendering dependency
  const renderingRef = useRef(false)

  const renderPage = useCallback(async () => {
    if (!pdf || !canvasRef.current || renderingRef.current) return

    renderingRef.current = true
    setRendering(true)

    try {
      const page = await pdf.getPage(currentPage)
      const canvas = canvasRef.current
      const context = canvas.getContext('2d')

      if (!context) {
        renderingRef.current = false
        setRendering(false)
        return
      }

      const viewport = page.getViewport({ scale: zoom * window.devicePixelRatio })

      canvas.height = viewport.height
      canvas.width = viewport.width
      canvas.style.width = `${viewport.width / window.devicePixelRatio}px`
      canvas.style.height = `${viewport.height / window.devicePixelRatio}px`

      await page.render({
        canvasContext: context,
        viewport: viewport,
        canvas: canvas,
      }).promise
    } catch (err) {
      console.error('Error rendering page:', err)
    } finally {
      renderingRef.current = false
      setRendering(false)
    }
  }, [pdf, currentPage, zoom])

  useEffect(() => {
    renderPage()
  }, [renderPage])

  // Navigation handlers
  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1)
    }
  }

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1)
    }
  }

  // Zoom handlers
  const zoomIn = () => {
    if (zoomIndex < ZOOM_LEVELS.length - 1) {
      setZoomIndex(zoomIndex + 1)
    }
  }

  const zoomOut = () => {
    if (zoomIndex > 0) {
      setZoomIndex(zoomIndex - 1)
    }
  }

  // Download handler
  const handleDownload = async () => {
    try {
      const { readFile } = await import('@tauri-apps/plugin-fs')
      const { save } = await import('@tauri-apps/plugin-dialog')
      const { writeFile } = await import('@tauri-apps/plugin-fs')

      const fileData = await readFile(filePath)

      const savePath = await save({
        defaultPath: fileName,
        filters: [{ name: 'PDF', extensions: ['pdf'] }],
      })

      if (savePath) {
        await writeFile(savePath, fileData)
      }
    } catch (err) {
      console.error('Error downloading PDF:', err)
    }
  }

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!containerRef.current) return

    if (!isFullscreen) {
      containerRef.current.requestFullscreen?.()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen?.()
      setIsFullscreen(false)
    }
  }

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  // Keyboard navigation - stable handlers
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      setCurrentPage(p => p > 1 ? p - 1 : p)
    } else if (e.key === 'ArrowRight') {
      setCurrentPage(p => p < totalPages ? p + 1 : p)
    } else if (e.key === 'Escape') {
      if (document.fullscreenElement) {
        document.exitFullscreen?.()
      } else {
        onClose()
      }
    } else if (e.key === '+' || e.key === '=') {
      setZoomIndex(z => z < ZOOM_LEVELS.length - 1 ? z + 1 : z)
    } else if (e.key === '-') {
      setZoomIndex(z => z > 0 ? z - 1 : z)
    }
  }, [totalPages, onClose])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return (
    <div className="fixed inset-0 z-50 flex flex-col" ref={containerRef}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Viewer Container */}
      <div className="relative flex flex-col h-full max-h-screen">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-surface-dark/95 border-b border-border-dark backdrop-blur-sm z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-2 hover:bg-surface-highlight rounded-lg transition-colors"
              title="Fechar (Esc)"
            >
              <X className="size-5 text-gray-400" />
            </button>
            <span className="text-white font-medium truncate max-w-md">
              {fileName}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="p-2 hover:bg-surface-highlight rounded-lg transition-colors"
              title="Baixar"
            >
              <Download className="size-5 text-gray-400" />
            </button>
            <button
              onClick={toggleFullscreen}
              className="p-2 hover:bg-surface-highlight rounded-lg transition-colors"
              title={isFullscreen ? 'Sair do modo tela cheia' : 'Tela cheia'}
            >
              {isFullscreen ? (
                <Minimize2 className="size-5 text-gray-400" />
              ) : (
                <Maximize2 className="size-5 text-gray-400" />
              )}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto flex items-center justify-center p-4 bg-zinc-900">
          {loading && (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="size-10 text-primary animate-spin" />
              <span className="text-gray-400">Carregando PDF...</span>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center gap-3 text-red-400">
              <AlertCircle className="size-10" />
              <span>{error}</span>
            </div>
          )}

          {!loading && !error && (
            <div className="relative">
              {rendering && (
                <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/50">
                  <Loader2 className="size-8 text-primary animate-spin" />
                </div>
              )}
              <canvas
                ref={canvasRef}
                className="shadow-2xl bg-white"
              />
            </div>
          )}
        </div>

        {/* Footer Controls */}
        {!loading && !error && (
          <div className="flex items-center justify-center gap-4 px-4 py-3 bg-surface-dark/95 border-t border-border-dark backdrop-blur-sm">
            {/* Page Navigation */}
            <div className="flex items-center gap-2">
              <button
                onClick={goToPreviousPage}
                disabled={currentPage <= 1}
                className={cn(
                  'p-2 rounded-lg transition-colors',
                  currentPage <= 1
                    ? 'text-gray-600 cursor-not-allowed'
                    : 'text-gray-400 hover:bg-surface-highlight hover:text-white'
                )}
                title="Página anterior (←)"
              >
                <ChevronLeft className="size-5" />
              </button>

              <span className="text-gray-300 min-w-[100px] text-center">
                Página {currentPage} de {totalPages}
              </span>

              <button
                onClick={goToNextPage}
                disabled={currentPage >= totalPages}
                className={cn(
                  'p-2 rounded-lg transition-colors',
                  currentPage >= totalPages
                    ? 'text-gray-600 cursor-not-allowed'
                    : 'text-gray-400 hover:bg-surface-highlight hover:text-white'
                )}
                title="Próxima página (→)"
              >
                <ChevronRight className="size-5" />
              </button>
            </div>

            <div className="w-px h-6 bg-border-dark" />

            {/* Zoom Controls */}
            <div className="flex items-center gap-2">
              <button
                onClick={zoomOut}
                disabled={zoomIndex <= 0}
                className={cn(
                  'p-2 rounded-lg transition-colors',
                  zoomIndex <= 0
                    ? 'text-gray-600 cursor-not-allowed'
                    : 'text-gray-400 hover:bg-surface-highlight hover:text-white'
                )}
                title="Diminuir zoom (-)"
              >
                <ZoomOut className="size-5" />
              </button>

              <span className="text-gray-300 min-w-[60px] text-center">
                {Math.round(zoom * 100)}%
              </span>

              <button
                onClick={zoomIn}
                disabled={zoomIndex >= ZOOM_LEVELS.length - 1}
                className={cn(
                  'p-2 rounded-lg transition-colors',
                  zoomIndex >= ZOOM_LEVELS.length - 1
                    ? 'text-gray-600 cursor-not-allowed'
                    : 'text-gray-400 hover:bg-surface-highlight hover:text-white'
                )}
                title="Aumentar zoom (+)"
              >
                <ZoomIn className="size-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
