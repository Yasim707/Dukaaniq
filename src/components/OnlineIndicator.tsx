import { useState, useEffect } from 'react'
import { Wifi, WifiOff } from 'lucide-react'

export function OnlineIndicator() {
  const [online, setOnline] = useState(navigator.onLine)

  useEffect(() => {
    function handleOnline() { setOnline(true) }
    function handleOffline() { setOnline(false) }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Only show when offline or briefly when coming back online
  const [showOnline, setShowOnline] = useState(false)
  useEffect(() => {
    if (online) {
      setShowOnline(true)
      const timer = setTimeout(() => setShowOnline(false), 3000)
      return () => clearTimeout(timer)
    }
  }, [online])

  if (online && !showOnline) return null

  return (
    <div className={`fixed bottom-4 right-4 z-50 flex items-center gap-2 px-3 py-2 rounded-lg shadow-lg text-xs font-medium ${online ? 'bg-green-600 text-white' : 'bg-amber-600 text-white'}`}>
      {online ? <Wifi size={14} /> : <WifiOff size={14} />}
      {online ? 'Online' : 'Offline Mode'}
    </div>
  )
}
