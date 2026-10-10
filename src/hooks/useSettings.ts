import { useState, useEffect, useCallback } from 'react'
import type { ShopSettings } from '../types'
import { DEFAULT_SETTINGS } from '../types'

const STORAGE_KEY = 'dukaaniq_settings'

function loadSettings(): ShopSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) }
  } catch {
    // ignore parse errors
  }
  return { ...DEFAULT_SETTINGS }
}

function saveSettings(s: ShopSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
}

export function useSettings() {
  const [settings, setSettings] = useState<ShopSettings>(loadSettings)

  // Keep in sync across tabs
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY) setSettings(loadSettings())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const updateSettings = useCallback((patch: Partial<ShopSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...patch }
      saveSettings(next)
      return next
    })
  }, [])

  return { settings, updateSettings }
}
