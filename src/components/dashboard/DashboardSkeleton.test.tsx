import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { DashboardSkeleton } from './DashboardSkeleton'

describe('DashboardSkeleton', () => {
  it('should render without crashing', () => {
    render(<DashboardSkeleton />)
    // Component should render skeleton elements
    const container = document.querySelector('.animate-fade-in-up')
    expect(container).toBeInTheDocument()
  })

  it('should render 4 stat card skeletons', () => {
    render(<DashboardSkeleton />)
    // First grid should have 4 skeleton cards (stats)
    const statCards = document.querySelectorAll('.lg\\:grid-cols-4 > div')
    expect(statCards).toHaveLength(4)
  })

  it('should render 4 quick action skeletons', () => {
    render(<DashboardSkeleton />)
    // Quick actions grid should have 4 buttons
    const quickActions = document.querySelectorAll('.md\\:grid-cols-4 > div')
    expect(quickActions).toHaveLength(4)
  })

  it('should render 5 deadline row skeletons', () => {
    render(<DashboardSkeleton />)
    // Table body should have 5 rows
    const tableRows = document.querySelectorAll('.divide-y > div')
    expect(tableRows).toHaveLength(5)
  })

  it('should render 4 summary stat skeletons', () => {
    render(<DashboardSkeleton />)
    // Summary stats section should have 4 items
    const summaryStats = document.querySelectorAll('.space-y-4 > div')
    expect(summaryStats).toHaveLength(4)
  })

  it('should have shimmer class on skeleton elements', () => {
    render(<DashboardSkeleton />)
    const pulsingElements = document.querySelectorAll('.shimmer')
    expect(pulsingElements.length).toBeGreaterThan(0)
  })

  it('should use correct background colors for skeletons', () => {
    render(<DashboardSkeleton />)
    const darkElements = document.querySelectorAll('[class*="bg-[var(--color-bg-tertiary)]"]')
    expect(darkElements.length).toBeGreaterThan(0)
  })

  it('should render main content grid with correct columns', () => {
    render(<DashboardSkeleton />)
    const mainGrid = document.querySelector('.lg\\:grid-cols-3')
    expect(mainGrid).toBeInTheDocument()
  })

  it('should render deadlines section spanning 2 columns', () => {
    render(<DashboardSkeleton />)
    const deadlinesSection = document.querySelector('.lg\\:col-span-2')
    expect(deadlinesSection).toBeInTheDocument()
  })

  it('should render AI assistant widget skeleton', () => {
    render(<DashboardSkeleton />)
    // AI widget has specific structure with input skeleton
    const inputSkeleton = document.querySelector('.h-10.w-full.rounded-lg.shimmer')
    expect(inputSkeleton).toBeInTheDocument()
  })
})
