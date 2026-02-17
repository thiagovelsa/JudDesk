import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Minimal DOMMatrix polyfill for pdfjs-dist in jsdom
if (typeof globalThis.DOMMatrix === 'undefined') {
  class DOMMatrixMock {
    a = 1
    b = 0
    c = 0
    d = 1
    e = 0
    f = 0

    constructor(init?: number[] | { a?: number; b?: number; c?: number; d?: number; e?: number; f?: number }) {
      if (Array.isArray(init) && init.length >= 6) {
        ;[this.a, this.b, this.c, this.d, this.e, this.f] = init
      } else if (init && typeof init === 'object') {
        this.a = init.a ?? this.a
        this.b = init.b ?? this.b
        this.c = init.c ?? this.c
        this.d = init.d ?? this.d
        this.e = init.e ?? this.e
        this.f = init.f ?? this.f
      }
    }

    translate(): this {
      return this
    }

    scale(): this {
      return this
    }

    invertSelf(): this {
      return this
    }

    multiplySelf(): this {
      return this
    }

    preMultiplySelf(): this {
      return this
    }
  }

  globalThis.DOMMatrix = DOMMatrixMock as unknown as typeof DOMMatrix
  globalThis.DOMMatrixReadOnly = DOMMatrixMock as unknown as typeof DOMMatrixReadOnly
}

// Mock do ambiente Tauri (necessário para isTauriEnvironment() retornar true)
Object.defineProperty(window, '__TAURI_INTERNALS__', {
  value: {},
  writable: true,
})

// Mock do Tauri SQL Plugin
const mockDatabase = {
  select: vi.fn(),
  execute: vi.fn(),
}

vi.mock('@tauri-apps/plugin-sql', () => ({
  default: {
    load: vi.fn().mockResolvedValue(mockDatabase),
  },
}))

// Mock do Tauri API
vi.mock('@tauri-apps/api', () => ({
  invoke: vi.fn(),
}))

// Mock do Tauri Path API
vi.mock('@tauri-apps/api/path', () => ({
  appDataDir: vi.fn().mockResolvedValue('C:\\MockAppData'),
  join: (...parts: string[]) => Promise.resolve(parts.join('\\')),
}))

// Mock do Tauri FS Plugin
vi.mock('@tauri-apps/plugin-fs', () => ({
  exists: vi.fn().mockResolvedValue(true),
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue(new Uint8Array()),
  writeTextFile: vi.fn().mockResolvedValue(undefined),
  readTextFile: vi.fn().mockResolvedValue(''),
  readDir: vi.fn().mockResolvedValue([]),
  stat: vi.fn().mockResolvedValue({ size: 0 }),
  remove: vi.fn().mockResolvedValue(undefined),
  copyFile: vi.fn().mockResolvedValue(undefined),
  rename: vi.fn().mockResolvedValue(undefined),
}))

// Mock do fetch para testes de IA
global.fetch = vi.fn()

// Helper para resetar mocks entre testes
export function resetMocks() {
  vi.clearAllMocks()
  mockDatabase.select.mockReset()
  mockDatabase.execute.mockReset()
  // Default mock for select (returns empty array by default)
  mockDatabase.select.mockResolvedValue([])
  // Default mock for execute (used by activity logger)
  mockDatabase.execute.mockResolvedValue({ lastInsertId: 0, rowsAffected: 1 })
}

// Helper para configurar retornos do banco
export function mockDatabaseSelect<T>(data: T[]) {
  mockDatabase.select.mockResolvedValue(data)
}

export function mockDatabaseExecute(lastInsertId: number = 1, rowsAffected: number = 1) {
  mockDatabase.execute.mockResolvedValue({ lastInsertId, rowsAffected })
}

// Helper to queue multiple select responses
export function mockDatabaseSelectOnce<T>(data: T[]) {
  mockDatabase.select.mockResolvedValueOnce(data)
}

// Helper para mock do fetch
export function mockFetch(response: unknown, ok: boolean = true) {
  ;(global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
    ok,
    json: vi.fn().mockResolvedValue(response),
    text: vi.fn().mockResolvedValue(JSON.stringify(response)),
  })
}

export { mockDatabase }
