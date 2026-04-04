'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { RealtimeChannel } from '@supabase/supabase-js'

export function usePresence(channelName: string = 'global') {
  const [onlineUsers, setOnlineUsers] = useState<Record<string, any>>({})
  const [typingUsers, setTypingUsers] = useState<Record<string, boolean>>({})
  const supabase = createClient()

  useEffect(() => {
    let channel: RealtimeChannel

    const initPresence = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      channel = supabase.channel(`presence:${channelName}`, {
        config: {
          presence: {
            key: user.id,
          },
        },
      })

      channel
        .on('presence', { event: 'sync' }, () => {
          const state = channel.presenceState()
          setOnlineUsers(state)
        })
        .on('presence', { event: 'join' }, ({ key, newPresences }) => {
          console.log('join', key, newPresences)
        })
        .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
          console.log('leave', key, leftPresences)
        })
        .on('broadcast', { event: 'typing' }, ({ payload }) => {
          setTypingUsers((prev) => ({
            ...prev,
            [payload.userId]: payload.isTyping,
          }))
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await channel.track({
              userId: user.id,
              online_at: new Date().toISOString(),
            })
          }
        })
    }

    initPresence()

    return () => {
      if (channel) {
        channel.unsubscribe()
      }
    }
  }, [channelName])

  const sendTypingStatus = async (isTyping: boolean) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const channel = supabase.channel(`presence:${channelName}`)
    // Using broadcast for typing to keep it ephemeral
    await channel.send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId: user.id, isTyping },
    })
  }

  return { onlineUsers, typingUsers, sendTypingStatus }
}
