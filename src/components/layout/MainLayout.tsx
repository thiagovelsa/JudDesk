import { ReactNode, useState } from 'react'
import { useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import UiDensityApplier from './UiDensityApplier'
import UiMotionApplier from './UiMotionApplier'

interface MainLayoutProps {
  children: ReactNode
}

export default function MainLayout({ children }: MainLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()

  return (
    <div className="h-screen flex overflow-hidden bg-[var(--color-bg-primary)]">
      <UiDensityApplier />
      <UiMotionApplier />
      {/* Sidebar - hidden on mobile */}
      <div className="hidden md:flex">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        >
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm motion-overlay-backdrop" />
          <div className="fixed inset-y-0 left-0 w-64 motion-overlay-panel">
            <Sidebar />
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <div className="flex-1 overflow-y-auto p-[var(--space-page)] scroll-smooth">
          <div key={location.pathname} className="w-full max-w-[1400px] mx-auto motion-page-enter">
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}
