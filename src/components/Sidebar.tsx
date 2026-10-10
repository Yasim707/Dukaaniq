import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  Landmark,
  BarChart3,
  Settings,
  Store,
  X,
} from 'lucide-react'
import { useSettingsContext } from '../app/SettingsContext'
import { useT } from '../i18n'

const NAV_ITEMS = [
  { to: '/', key: 'nav.dashboard', icon: LayoutDashboard, end: true },
  { to: '/inventory', key: 'nav.inventory', icon: Package },
  { to: '/sales', key: 'nav.sales', icon: ShoppingCart },
  { to: '/customers', key: 'nav.customers', icon: Users },
  { to: '/udhaar', key: 'nav.udhaar', icon: Landmark },
  { to: '/insights', key: 'nav.insights', icon: BarChart3 },
  { to: '/settings', key: 'nav.settings', icon: Settings },
]

interface SidebarProps {
  open: boolean
  onClose: () => void
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const { settings } = useSettingsContext()
  const tr = useT(settings.language)

  // Close sidebar on route change on mobile
  const handleNavClick = () => {
    if (window.innerWidth < 1024) onClose()
  }

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-20 bg-black/30 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={[
          'fixed top-0 left-0 z-30 h-full w-64 bg-brand-900 flex flex-col',
          'transition-transform duration-200 ease-in-out',
          'lg:translate-x-0 lg:static lg:z-auto',
          open ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        {/* Logo / shop name */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center">
              <Store size={16} className="text-white" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm leading-tight">DukaanIQ</p>
              <p className="text-brand-300 text-xs truncate max-w-[130px]">
                {settings.shopName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden text-brand-300 hover:text-white p-1 rounded"
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          <ul className="space-y-0.5">
            {NAV_ITEMS.map(({ to, key, icon: Icon, end }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  onClick={handleNavClick}
                  className={({ isActive }) =>
                    [
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-brand-700 text-white'
                        : 'text-brand-200 hover:bg-brand-800 hover:text-white',
                    ].join(' ')
                  }
                >
                  <Icon size={18} strokeWidth={1.8} />
                  <span>{tr(key)}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-white/10">
          <p className="text-brand-400 text-xs">
            DukaanIQ · Islamabad Hack 2026
          </p>
        </div>
      </aside>
    </>
  )
}

