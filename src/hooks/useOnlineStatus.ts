'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useAuth } from '@/context/AuthContext'

const HEARTBEAT_INTERVAL = 30000 // 30 seconds
const OFFLINE_THRESHOLD = 180000 // 180 seconds without heartbeat = offline

export function useOnlineStatus() {
  const supabase = createClient()
  const { user } = useAuth()
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    let userId: string | null = null

    const init = async () => {
      if (!user) return
      userId = user.id

      // Set online immediately
      await supabase.from('profiles').update({ 
        status: 'online', 
        last_seen: new Date().toISOString() 
      }).eq('id', userId)

      // Heartbeat: update last_seen every 30 seconds
      intervalRef.current = setInterval(async () => {
        await supabase.from('profiles').update({ 
          status: 'online',
          last_seen: new Date().toISOString() 
        }).eq('id', userId)
      }, HEARTBEAT_INTERVAL)
    }

    init()

    // Best-effort: try to set offline on tab close
    const handleBeforeUnload = () => {
      if (userId) {
        // Use sendBeacon for reliability on tab close
        const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`
        const headers = {
          'Content-Type': 'application/json',
          'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          'Prefer': 'return=minimal',
        }
        navigator.sendBeacon(url, JSON.stringify({ status: 'offline', last_seen: new Date().toISOString() }))
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      
      // Set offline on unmount
      if (userId) {
        supabase.from('profiles').update({ 
          status: 'offline', 
          last_seen: new Date().toISOString() 
        }).eq('id', userId)
      }
    }
  }, [user, supabase])
}

// Helper: static check if a user is truly online based on last_seen timestamp
export function isUserOnline(profile: { status?: string; last_seen?: string }): boolean {
  if (profile.status !== 'online') return false
  if (!profile.last_seen) return false
  
  const lastSeen = new Date(profile.last_seen).getTime()
  const now = Date.now()
  return (now - lastSeen) < OFFLINE_THRESHOLD
}

// Reactive Hook: updates the UI automatically if the user goes offline due to missing heartbeats
export function useIsUserOnline(profile: { status?: string; last_seen?: string } | null | undefined): boolean {
  const [isOnline, setIsOnline] = useState(false)

  useEffect(() => {
    if (!profile) {
      setIsOnline(false)
      return
    }

    const check = () => {
      setIsOnline(isUserOnline(profile))
    }

    // Initial check
    check()

    // Poll every 10 seconds to catch timeout
    const interval = setInterval(check, 10000)
    return () => clearInterval(interval)
  }, [profile])

  return isOnline
}
