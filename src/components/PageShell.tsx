import type { ReactNode } from 'react'

interface PageShellProps {
  /** Optional action button / toolbar rendered top-right */
  action?: ReactNode
  children: ReactNode
}

export function PageShell({ action, children }: PageShellProps) {
  return (
    <div className="flex-1 overflow-y-auto">
      {action && (
        <div className="flex justify-end px-6 pt-5">
          {action}
        </div>
      )}
      <div className="px-4 py-5 sm:px-6 max-w-7xl mx-auto">
        {children}
      </div>
    </div>
  )
}
