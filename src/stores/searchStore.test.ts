import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useSearchStore } from './searchStore'
import { resetMocks } from '@/test/setup'

// Mock globalSearch module
vi.mock('@/lib/globalSearch', () => ({
  globalSearch: vi.fn(),
}))

import { globalSearch } from '@/lib/globalSearch'

const mockGlobalSearch = globalSearch as ReturnType<typeof vi.fn>

describe('searchStore', () => {
  beforeEach(() => {
    resetMocks()
    vi.clearAllMocks()
    // Reset store state
    useSearchStore.setState({
      query: '',
      results: [],
      isOpen: false,
      loading: false,
      selectedIndex: -1,
    })
  })

  describe('setQuery', () => {
    it('should update query', () => {
      useSearchStore.getState().setQuery('test')

      expect(useSearchStore.getState().query).toBe('test')
    })
  })

  describe('search', () => {
    it('should search and update results', async () => {
      const mockResults = [
        { type: 'client' as const, id: 1, title: 'Test Client', subtitle: '' },
        { type: 'case' as const, id: 2, title: 'Test Case', subtitle: '' },
      ]

      mockGlobalSearch.mockResolvedValue(mockResults)
      useSearchStore.setState({ query: 'test' })

      await useSearchStore.getState().search()

      const state = useSearchStore.getState()
      expect(state.results).toEqual(mockResults)
      expect(state.loading).toBe(false)
      expect(state.selectedIndex).toBe(0)
    })

    it('should not search if query is empty', async () => {
      useSearchStore.setState({ query: '' })

      await useSearchStore.getState().search()

      expect(mockGlobalSearch).not.toHaveBeenCalled()
      expect(useSearchStore.getState().results).toEqual([])
    })

    it('should not search if query is only whitespace', async () => {
      useSearchStore.setState({ query: '   ' })

      await useSearchStore.getState().search()

      expect(mockGlobalSearch).not.toHaveBeenCalled()
    })

    it('should set loading state during search', async () => {
      mockGlobalSearch.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve([]), 100)))
      useSearchStore.setState({ query: 'test' })

      const searchPromise = useSearchStore.getState().search()
      expect(useSearchStore.getState().loading).toBe(true)

      await searchPromise
      expect(useSearchStore.getState().loading).toBe(false)
    })

    it('should set selectedIndex to 0 when results found', async () => {
      mockGlobalSearch.mockResolvedValue([
        { type: 'client' as const, id: 1, title: 'Test', subtitle: '' },
      ])
      useSearchStore.setState({ query: 'test', selectedIndex: -1 })

      await useSearchStore.getState().search()

      expect(useSearchStore.getState().selectedIndex).toBe(0)
    })

    it('should set selectedIndex to -1 when no results', async () => {
      mockGlobalSearch.mockResolvedValue([])
      useSearchStore.setState({ query: 'test', selectedIndex: 0 })

      await useSearchStore.getState().search()

      expect(useSearchStore.getState().selectedIndex).toBe(-1)
    })

    it('should handle errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockGlobalSearch.mockRejectedValue(new Error('Search error'))
      useSearchStore.setState({ query: 'test' })

      await useSearchStore.getState().search()

      const state = useSearchStore.getState()
      expect(state.results).toEqual([])
      expect(state.loading).toBe(false)
      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })

  describe('clear', () => {
    it('should reset all search state', () => {
      useSearchStore.setState({
        query: 'test',
        results: [{ type: 'client' as const, id: 1, title: 'Test', subtitle: '' }],
        isOpen: true,
        selectedIndex: 0,
      })

      useSearchStore.getState().clear()

      const state = useSearchStore.getState()
      expect(state.query).toBe('')
      expect(state.results).toEqual([])
      expect(state.isOpen).toBe(false)
      expect(state.selectedIndex).toBe(-1)
    })
  })

  describe('setOpen', () => {
    it('should set isOpen to true', () => {
      useSearchStore.getState().setOpen(true)

      expect(useSearchStore.getState().isOpen).toBe(true)
    })

    it('should set isOpen to false and reset selectedIndex', () => {
      useSearchStore.setState({ isOpen: true, selectedIndex: 2 })

      useSearchStore.getState().setOpen(false)

      const state = useSearchStore.getState()
      expect(state.isOpen).toBe(false)
      expect(state.selectedIndex).toBe(-1)
    })
  })

  describe('setSelectedIndex', () => {
    it('should update selectedIndex', () => {
      useSearchStore.getState().setSelectedIndex(3)

      expect(useSearchStore.getState().selectedIndex).toBe(3)
    })
  })

  describe('selectNext', () => {
    it('should increment selectedIndex', () => {
      useSearchStore.setState({
        results: [
          { type: 'client' as const, id: 1, title: 'A', subtitle: '' },
          { type: 'client' as const, id: 2, title: 'B', subtitle: '' },
          { type: 'client' as const, id: 3, title: 'C', subtitle: '' },
        ],
        selectedIndex: 0,
      })

      useSearchStore.getState().selectNext()

      expect(useSearchStore.getState().selectedIndex).toBe(1)
    })

    it('should wrap to 0 when at end of list', () => {
      useSearchStore.setState({
        results: [
          { type: 'client' as const, id: 1, title: 'A', subtitle: '' },
          { type: 'client' as const, id: 2, title: 'B', subtitle: '' },
        ],
        selectedIndex: 1,
      })

      useSearchStore.getState().selectNext()

      expect(useSearchStore.getState().selectedIndex).toBe(0)
    })

    it('should do nothing if no results', () => {
      useSearchStore.setState({ results: [], selectedIndex: -1 })

      useSearchStore.getState().selectNext()

      expect(useSearchStore.getState().selectedIndex).toBe(-1)
    })
  })

  describe('selectPrevious', () => {
    it('should decrement selectedIndex', () => {
      useSearchStore.setState({
        results: [
          { type: 'client' as const, id: 1, title: 'A', subtitle: '' },
          { type: 'client' as const, id: 2, title: 'B', subtitle: '' },
          { type: 'client' as const, id: 3, title: 'C', subtitle: '' },
        ],
        selectedIndex: 2,
      })

      useSearchStore.getState().selectPrevious()

      expect(useSearchStore.getState().selectedIndex).toBe(1)
    })

    it('should wrap to last item when at start of list', () => {
      useSearchStore.setState({
        results: [
          { type: 'client' as const, id: 1, title: 'A', subtitle: '' },
          { type: 'client' as const, id: 2, title: 'B', subtitle: '' },
        ],
        selectedIndex: 0,
      })

      useSearchStore.getState().selectPrevious()

      expect(useSearchStore.getState().selectedIndex).toBe(1)
    })

    it('should do nothing if no results', () => {
      useSearchStore.setState({ results: [], selectedIndex: -1 })

      useSearchStore.getState().selectPrevious()

      expect(useSearchStore.getState().selectedIndex).toBe(-1)
    })
  })
})
