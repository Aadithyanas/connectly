import { useState, useEffect } from 'react'

export interface AppSettings {
  sidebarBg: string
  chatBg: string
  sentBubbleColor: string
  receivedBubbleColor: string
  textSize: 'small' | 'medium' | 'large'
}

const defaultSettings: AppSettings = {
  sidebarBg: '#111b21',
  chatBg: '#0b141a',
  sentBubbleColor: '#005c4b',
  receivedBubbleColor: '#202c33',
  textSize: 'medium'
}

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    // Load from local storage on mount
    try {
      const stored = localStorage.getItem('connectly_settings')
      if (stored) {
        setSettings({ ...defaultSettings, ...JSON.parse(stored) })
      }
    } catch (e) {
      console.error('Failed to load settings', e)
    }
    setIsLoaded(true)

    // Setup listener for cross-tab sync if needed
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'connectly_settings' && e.newValue) {
        setSettings({ ...defaultSettings, ...JSON.parse(e.newValue) })
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  const updateSettings = (newSettings: Partial<AppSettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings }
      localStorage.setItem('connectly_settings', JSON.stringify(updated))
      // Dispatch a custom event so other components in the same tab can react immediately
      window.dispatchEvent(new Event('connectly_settings_updated'))
      return updated
    })
  }

  // Effect to listen for updates from other components in the same tab
  useEffect(() => {
    const handleLocalUpdate = () => {
      try {
        const stored = localStorage.getItem('connectly_settings')
        if (stored) {
          setSettings({ ...defaultSettings, ...JSON.parse(stored) })
        }
      } catch (e) {
        console.error('Failed to parse settings event', e)
      }
    }
    window.addEventListener('connectly_settings_updated', handleLocalUpdate)
    return () => window.removeEventListener('connectly_settings_updated', handleLocalUpdate)
  }, [])

  return { settings, updateSettings, isLoaded }
}
