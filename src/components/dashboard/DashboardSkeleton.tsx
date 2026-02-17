/**
 * Skeleton loading component for Dashboard
 * Mimics the structure of the real Dashboard to reduce perceived loading time
 */
export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6 animate-fade-in-up">
      {/* Stats Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-xl p-5 flex flex-col"
          >
            <div className="h-4 w-24 bg-[var(--color-bg-tertiary)] rounded shimmer mb-3" />
            <div className="h-9 w-16 bg-[var(--color-bg-tertiary)] rounded shimmer" />
          </div>
        ))}
      </div>

      {/* Quick Actions Skeleton */}
      <div>
        <div className="h-6 w-32 bg-[var(--color-bg-tertiary)] rounded shimmer mb-3 ml-1" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)]"
            >
              <div className="h-9 w-9 bg-[var(--color-bg-tertiary)] rounded-lg shimmer" />
              <div className="h-4 w-20 bg-[var(--color-bg-tertiary)] rounded shimmer" />
            </div>
          ))}
        </div>
      </div>

      {/* Main Content Grid Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Deadlines Table Skeleton */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-xl overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-5 border-b border-[var(--color-border-default)] flex items-center justify-between">
              <div className="h-5 w-32 bg-[var(--color-bg-tertiary)] rounded shimmer" />
              <div className="h-4 w-16 bg-[var(--color-bg-tertiary)] rounded shimmer" />
            </div>
            {/* Table Header */}
            <div className="bg-[var(--color-bg-tertiary)] px-5 py-3 flex gap-4">
              <div className="h-3 w-12 bg-[var(--color-bg-elevated)] rounded shimmer" />
              <div className="h-3 w-16 bg-[var(--color-bg-elevated)] rounded shimmer flex-1" />
              <div className="h-3 w-20 bg-[var(--color-bg-elevated)] rounded shimmer" />
              <div className="h-3 w-12 bg-[var(--color-bg-elevated)] rounded shimmer" />
            </div>
            {/* Table Rows */}
            <div className="divide-y divide-[var(--color-border-default)]">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="px-5 py-4 flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-12 bg-[var(--color-bg-tertiary)] rounded shimmer" />
                    <div className="h-5 w-14 bg-[var(--color-bg-tertiary)] rounded shimmer" />
                  </div>
                  <div className="h-4 w-40 bg-[var(--color-bg-tertiary)] rounded shimmer flex-1" />
                  <div className="h-5 w-16 bg-[var(--color-bg-tertiary)] rounded shimmer" />
                  <div className="h-4 w-16 bg-[var(--color-bg-tertiary)] rounded shimmer" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column Skeleton */}
        <div className="flex flex-col gap-6">
          {/* AI Assistant Widget Skeleton */}
          <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-9 w-9 bg-[var(--color-bg-tertiary)] rounded-lg shimmer" />
              <div className="h-5 w-40 bg-[var(--color-bg-tertiary)] rounded shimmer" />
            </div>
            <div className="h-4 w-full bg-[var(--color-bg-tertiary)] rounded shimmer mb-2" />
            <div className="h-4 w-3/4 bg-[var(--color-bg-tertiary)] rounded shimmer mb-4" />
            <div className="h-10 w-full bg-[var(--color-bg-tertiary)] rounded-lg shimmer" />
          </div>

          {/* Summary Stats Skeleton */}
          <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border-default)] rounded-xl p-5 flex-1">
            <div className="h-5 w-40 bg-[var(--color-bg-tertiary)] rounded shimmer mb-4" />
            <div className="space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 bg-[var(--color-bg-primary)] rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-5 w-5 bg-[var(--color-bg-tertiary)] rounded shimmer" />
                    <div className="h-4 w-20 bg-[var(--color-bg-tertiary)] rounded shimmer" />
                  </div>
                  <div className="h-5 w-8 bg-[var(--color-bg-tertiary)] rounded shimmer" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
