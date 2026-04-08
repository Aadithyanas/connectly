import { useState, useEffect } from 'react'

export interface AppSettings {
  sidebarBg: string
  chatBg: string
  sentBubbleColor: string
  receivedBubbleColor: string
  textSize: 'small' | 'medium' | 'large'
}

const defaultSettings: AppSettings = {
  sidebarBg: '#000000',
  chatBg: '#000000',
  sentBubbleColor: '#1a1a1a',
  receivedBubbleColor: '#0a0a0a',
  textSize: 'medium'
}

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem('connectly_settings_v2')
      if (stored) {
        setSettings({ ...defaultSettings, ...JSON.parse(stored) })
      } else {
        // Migration: If they have v1 settings (old green colors), we ignore them and use new black&white default
        localStorage.setItem('connectly_settings_v2', JSON.stringify(defaultSettings))
        setSettings(defaultSettings)
      }
    } catch (e) {
      console.error('Failed to load settings', e)
    }
    setIsLoaded(true)

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'connectly_settings_v2' && e.newValue) {
        setSettings({ ...defaultSettings, ...JSON.parse(e.newValue) })
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  const updateSettings = (newSettings: Partial<AppSettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings }
      localStorage.setItem('connectly_settings_v2', JSON.stringify(updated))
      window.dispatchEvent(new Event('connectly_settings_updated'))
      return updated
    })
  }

  useEffect(() => {
    const handleLocalUpdate = () => {
      try {
        const stored = localStorage.getItem('connectly_settings_v2')
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
