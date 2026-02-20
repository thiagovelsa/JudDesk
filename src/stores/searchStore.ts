import { create } from 'zustand'
import { globalSearch } from '@/lib/globalSearch'
import type { SearchResult } from '@/types'

let latestSearchRequestId = 0

interface SearchStore {
  query: string
  results: SearchResult[]
  isOpen: boolean
  loading: boolean
  selectedIndex: number

  setQuery: (query: string) => void
  search: () => Promise<void>
  clear: () => void
  setOpen: (open: boolean) => void
  setSelectedIndex: (index: number) => void
  selectNext: () => void
  selectPrevious: () => void
}

export const useSearchStore = create<SearchStore>((set, get) => ({
  query: '',
  results: [],
  isOpen: false,
  loading: false,
  selectedIndex: -1,

  setQuery: (query: string) => {
    set({ query })
  },

  search: async () => {
    const { query } = get()
    const normalizedQuery = query.trim()

    if (!normalizedQuery) {
      latestSearchRequestId += 1
      set({ results: [], loading: false })
      return
    }

    const requestId = ++latestSearchRequestId
    set({ loading: true })
    try {
      const results = await globalSearch(normalizedQuery)
      if (requestId !== latestSearchRequestId) return
      set({ results, loading: false, selectedIndex: results.length > 0 ? 0 : -1 })
    } catch (error) {
      if (requestId !== latestSearchRequestId) return
      console.error('Search error:', error)
      set({ results: [], loading: false })
    }
  },

  clear: () => {
    latestSearchRequestId += 1
    set({ query: '', results: [], isOpen: false, selectedIndex: -1 })
  },

  setOpen: (open: boolean) => {
    set({ isOpen: open })
    if (!open) {
      set({ selectedIndex: -1 })
    }
  },

  setSelectedIndex: (index: number) => {
    set({ selectedIndex: index })
  },

  selectNext: () => {
    const { results, selectedIndex } = get()
    if (results.length === 0) return
    const nextIndex = selectedIndex < results.length - 1 ? selectedIndex + 1 : 0
    set({ selectedIndex: nextIndex })
  },

  selectPrevious: () => {
    const { results, selectedIndex } = get()
    if (results.length === 0) return
    const prevIndex = selectedIndex > 0 ? selectedIndex - 1 : results.length - 1
    set({ selectedIndex: prevIndex })
  },
}))
