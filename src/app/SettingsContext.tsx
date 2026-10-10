import { useEffect } from 'react'
import { createContext, useContext, type ReactNode } from 'react'
import { useSettings } from '../hooks/useSettings'
import type { ShopSettings } from '../types'

interface SettingsContextValue {
  settings: ShopSettings
  updateSettings: (patch: Partial<ShopSettings>) => void
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const value = useSettings()
  
  // Apply RTL layout for Urdu
  useEffect(() => {
    const dir = value.settings.language === 'ur' ? 'rtl' : 'ltr'
    document.documentElement.setAttribute('dir', dir)
    document.documentElement.setAttribute('lang', value.settings.language)
  }, [value.settings.language])

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettingsContext(): SettingsContextValue {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettingsContext must be used inside SettingsProvider')
  return ctx
}
