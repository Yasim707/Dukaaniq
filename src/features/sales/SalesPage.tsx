/**
 * SalesPage — tab wrapper for Quick Sale and Sales History
 */
import { useState } from 'react'
import { SalePage } from './SalePage'
import { SalesHistoryPage } from './SalesHistoryPage'

type Tab = 'quick' | 'history'

export function SalesPage() {
  const [tab, setTab] = useState<Tab>('quick')

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex items-center gap-1 px-6 py-3 border-b border-border bg-card shrink-0">
        <TabBtn active={tab === 'quick'} onClick={() => setTab('quick')}>
          New Sale
        </TabBtn>
        <TabBtn active={tab === 'history'} onClick={() => setTab('history')}>
          History
        </TabBtn>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {tab === 'quick' ? <SalePage /> : <SalesHistoryPage />}
      </div>
    </div>
  )
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={[
        'px-4 py-1.5 rounded-lg text-sm font-medium transition-colors',
        active ? 'bg-brand-700 text-white' : 'text-muted hover:text-ink hover:bg-surface',
      ].join(' ')}
    >
      {children}
    </button>
  )
}
