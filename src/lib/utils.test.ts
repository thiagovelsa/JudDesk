import { describe, it, expect } from 'vitest'
import { cn, formatDate, formatDateTime, formatCPFCNPJ, formatPhone } from './utils'

describe('utils', () => {
  describe('cn', () => {
    it('should merge class names correctly', () => {
      expect(cn('foo', 'bar')).toBe('foo bar')
    })

    it('should handle conditional classes', () => {
      expect(cn('foo', true && 'bar', false && 'baz')).toBe('foo bar')
    })

    it('should merge tailwind classes correctly', () => {
      expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4')
    })

    it('should handle arrays', () => {
      expect(cn(['foo', 'bar'])).toBe('foo bar')
    })

    it('should handle objects', () => {
      expect(cn({ foo: true, bar: false, baz: true })).toBe('foo baz')
    })

    it('should handle undefined and null', () => {
      expect(cn('foo', undefined, null, 'bar')).toBe('foo bar')
    })
  })

  describe('formatDate', () => {
    it('should format Date object to pt-BR format', () => {
      const date = new Date('2024-03-15T10:30:00Z')
      const result = formatDate(date)
      expect(result).toMatch(/15\/03\/2024/)
    })

    it('should format date string to pt-BR format', () => {
      // Use noon UTC to avoid timezone date shifts
      const result = formatDate('2024-12-25T12:00:00Z')
      expect(result).toMatch(/25\/12\/2024/)
    })

    it('should handle different date formats', () => {
      // Create date at noon to avoid timezone issues
      const date = new Date(2024, 0, 1, 12, 0, 0) // Jan 1, 2024 at noon local time
      const result = formatDate(date)
      expect(result).toMatch(/01\/01\/2024/)
    })
  })

  describe('formatDateTime', () => {
    it('should format Date object with time', () => {
      const date = new Date('2024-03-15T14:30:00Z')
      const result = formatDateTime(date)
      // Time will depend on timezone
      expect(result).toMatch(/15\/03\/2024/)
      expect(result).toMatch(/\d{2}:\d{2}/)
    })

    it('should format date string with time', () => {
      const result = formatDateTime('2024-06-20T08:45:00Z')
      expect(result).toMatch(/20\/06\/2024/)
      expect(result).toMatch(/\d{2}:\d{2}/)
    })
  })

  describe('formatCPFCNPJ', () => {
    it('should format CPF (11 digits)', () => {
      expect(formatCPFCNPJ('12345678901')).toBe('123.456.789-01')
    })

    it('should format CNPJ (14 digits)', () => {
      expect(formatCPFCNPJ('12345678000190')).toBe('12.345.678/0001-90')
    })

    it('should handle input with existing formatting', () => {
      expect(formatCPFCNPJ('123.456.789-01')).toBe('123.456.789-01')
    })

    it('should handle CNPJ with existing formatting', () => {
      expect(formatCPFCNPJ('12.345.678/0001-90')).toBe('12.345.678/0001-90')
    })

    it('should strip non-numeric characters', () => {
      expect(formatCPFCNPJ('123-456-789/01')).toBe('123.456.789-01')
    })

    it('should handle short input (less than 11 digits)', () => {
      // CPF format applies even for shorter numbers
      const result = formatCPFCNPJ('1234567890')
      expect(result).toBe('1234567890') // Not enough digits for full format
    })
  })

  describe('formatPhone', () => {
    it('should format phone with 10 digits (landline)', () => {
      expect(formatPhone('1133334444')).toBe('(11) 3333-4444')
    })

    it('should format phone with 11 digits (mobile)', () => {
      expect(formatPhone('11999998888')).toBe('(11) 99999-8888')
    })

    it('should handle input with existing formatting', () => {
      expect(formatPhone('(11) 99999-8888')).toBe('(11) 99999-8888')
    })

    it('should strip non-numeric characters', () => {
      expect(formatPhone('11-9999-98888')).toBe('(11) 99999-8888')
    })

    it('should handle phone with spaces', () => {
      expect(formatPhone('11 99999 8888')).toBe('(11) 99999-8888')
    })
  })
})
