import { useEffect, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useAuth } from '@/context/AuthContext'

/**
 * useNotify Hook
 * 
 * Subscribes to a lightweight personal broadcast channel to receive 
 * instant 'ping' notifications for UI refreshes (e.g. sidebar updates).
 * This avoids expensive Postgres Change listeners while maintaining 
 * the feel of real-time message delivery.
 */
export function useNotify(onNotify: (payload: any) => void) {
  const { user } = useAuth()
  const supabase = createClient()
  const callbackRef = useRef(onNotify)

  useEffect(() => {
    callbackRef.current = onNotify
  }, [onNotify])

  useEffect(() => {
    if (!user?.id) return

    const channelName = `notifications:${user.id}`
    const channel = supabase.channel(channelName)

    channel
      .on('broadcast', { event: 'ping' }, (payload) => {
        // Re-check visibility or other conditions if needed
        callbackRef.current(payload.payload)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id, supabase])
}
