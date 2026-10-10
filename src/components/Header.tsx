import { Menu, Bell } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { useSettingsContext } from '../app/SettingsContext'
import { useT } from '../i18n'

const ROUTE_TITLE_MAP: Record<string, string> = {
  '/': 'nav.dashboard',
  '/inventory': 'nav.inventory',
  '/sales': 'nav.sales',
  '/customers': 'nav.customers',
  '/udhaar': 'nav.udhaar',
  '/insights': 'nav.insights',
  '/settings': 'nav.settings',
}

interface HeaderProps {
  onMenuClick: () => void
}

export function Header({ onMenuClick }: HeaderProps) {
  const { settings } = useSettingsContext()
  const tr = useT(settings.language)
  const location = useLocation()

  const routeKey = Object.keys(ROUTE_TITLE_MAP).find(k =>
    k === '/'
      ? location.pathname === '/'
      : location.pathname.startsWith(k)
  )
  const titleKey = routeKey ? ROUTE_TITLE_MAP[routeKey] : 'nav.dashboard'

  return (
    <header className="h-14 bg-card border-b border-border flex items-center px-4 gap-3 sticky top-0 z-10">
      {/* Mobile hamburger */}
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 rounded-lg text-ink-light hover:bg-surface transition-colors"
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>

      {/* Page title */}
      <h1 className="text-base font-semibold text-ink flex-1">
        {tr(titleKey)}
      </h1>

      {/* Right side actions */}
      <button
        className="p-2 rounded-lg text-ink-light hover:bg-surface transition-colors relative"
        aria-label="Notifications"
      >
        <Bell size={18} />
      </button>
    </header>
  )
}
