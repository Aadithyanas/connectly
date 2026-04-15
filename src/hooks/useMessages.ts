import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { RealtimeChannel } from '@supabase/supabase-js'
import { useAuth } from '@/context/AuthContext'

const STATUS_ORDER: Record<string, number> = { sending: 0, sent: 1, delivered: 2, seen: 3 }

function isStatusForward(oldStatus: string, newStatus: string): boolean {
  return (STATUS_ORDER[newStatus] ?? 0) > (STATUS_ORDER[oldStatus] ?? 0)
}

export function useMessages(chatId?: string) {
  const [messages, setMessages] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const { user } = useAuth()
  const supabase = createClient()
  const channelRef = useRef<RealtimeChannel | null>(null)
  const currentUserRef = useRef<any>(null)
  const pendingDeliveredRef = useRef<NodeJS.Timeout | null>(null)
  const pendingSeenRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    currentUserRef.current = user
  }, [user])

  useEffect(() => {
    // Request Notification permission
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission()
    }
  }, [])

  const playNotificationSound = useCallback(() => {
    try {
      // Standard notification sound
      const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3')
      audio.volume = 0.5
      audio.play().catch(e => console.log("Sound play blocked by browser policy until user interaction."))
    } catch (e) {
      console.error("Audio error", e)
    }
  }, [])

  const markAsSeen = useCallback(async (retries = 0) => {
    if (!chatId || !user) return
    if (pendingSeenRef.current && retries === 0) return

    const performAction = async (currRetries: number) => {
      try {
        const { error } = await supabase.rpc('mark_messages_seen', { cid: chatId })
        if (error && (error.message?.includes('Lock') || error.details?.includes('Lock')) && currRetries < 2) {
          throw error
        }
        // Broadcast "chat read" so sender gets INSTANT purple ticks
        // No need to pass IDs — receiver marks all sender's messages, sender updates all own
        if (channelRef.current) {
          channelRef.current.send({
            type: 'broadcast',
            event: 'chat_read',
            payload: { readerId: user.id, status: 'seen' }
          }).catch(() => {})
        }
      } catch (e) {
        if (currRetries < 2) setTimeout(() => performAction(currRetries + 1), 600)
      } finally {
        pendingSeenRef.current = null
      }
    }

    if (retries > 0) {
      performAction(retries)
    } else {
      pendingSeenRef.current = setTimeout(() => performAction(0), 800)
    }
  }, [chatId, user])

  const markAsDelivered = useCallback(async (retries = 0) => {
    if (!chatId || !user) return
    if (pendingDeliveredRef.current && retries === 0) return

    const performAction = async (currRetries: number) => {
      try {
        const { error } = await supabase.rpc('mark_messages_delivered', { cid: chatId })
        if (error && (error.message?.includes('Lock') || error.details?.includes('Lock')) && currRetries < 2) {
          throw error
        }
        // Broadcast "delivered" so sender gets instant double-tick
        if (channelRef.current) {
          channelRef.current.send({
            type: 'broadcast',
            event: 'chat_read',
            payload: { readerId: user.id, status: 'delivered' }
          }).catch(() => {})
        }
      } catch (e) {
        if (currRetries < 2) setTimeout(() => performAction(currRetries + 1), 600)
      } finally {
        pendingDeliveredRef.current = null
      }
    }

    if (retries > 0) {
      performAction(retries)
    } else {
      pendingDeliveredRef.current = setTimeout(() => performAction(0), 600)
    }
  }, [chatId, user])

  useEffect(() => {
    let isMounted = true
    const abortController = new AbortController()

    // FIX #1: Clear any stale pending timers from the previous chat.
    // Without this, switching chats can leave pendingSeenRef set, causing
    // markAsSeen() to return early (the `if (pendingSeenRef.current && retries === 0) return` guard)
    // and the recipient never marks messages as seen in the new chat.
    if (pendingDeliveredRef.current) {
      clearTimeout(pendingDeliveredRef.current)
      pendingDeliveredRef.current = null
    }
    if (pendingSeenRef.current) {
      clearTimeout(pendingSeenRef.current)
      pendingSeenRef.current = null
    }

    // 1. Try to load from cache immediately for instant UI
    const cached = localStorage.getItem(`messages_${chatId}`)
    if (cached) {
      const parsed = JSON.parse(cached)
      if (Array.isArray(parsed) && parsed.length > 0) {
        setMessages(parsed)
      }
    } else {
      setMessages([])
    }
    
    if (!chatId) {
      setLoading(false)
      return
    }

    const fetchMessages = async (isBackgroundRefresh = false, retryCount = 0) => {
      if (!isMounted) return
      
      // 2. Only show skeleton if we have NO messages at all (no cache)
      const hasNoMessages = !cached
      if (!isBackgroundRefresh && hasNoMessages && retryCount === 0) setLoading(true)
      
      try {
        const { data, error } = await supabase
          .from('messages')
          .select('*, sender:profiles!sender_id(name, avatar_url), reply:reply_to(id, content, sender_id)')
          .eq('chat_id', chatId)
          .order('created_at', { ascending: false })
          .limit(100)
          .abortSignal(abortController.signal)
          
        if (!isMounted) return
        
        if (!error) {
           const currentId = currentUserRef.current?.id
           const freshMessages = (data || []).filter((m: any) => {
             // Don't show messages deleted for me
             if (currentId && m.deleted_for?.includes(currentId)) return false
             return true
           }).reverse() // Since we fetched DESC for the limit, reverse to maintain chronological top-to-bottom flow
           
           setMessages((prev) => {
             const sendingMessages = prev.filter(m => m.status === 'sending')
             const final = [...freshMessages]
             
             sendingMessages.forEach(sending => {
               const alreadyInDb = freshMessages.some((dbMsg: any) => 
                 (sending.client_id && dbMsg.client_id === sending.client_id) || 
                 dbMsg.id === sending.id
               )
               if (!alreadyInDb) {
                 final.push(sending)
               }
             })
             
             return final.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
           })
           
           // 3. Cache the fresh data (limit to last 100 messages for storage efficiency)
           if (freshMessages.length > 0) {
             localStorage.setItem(`messages_${chatId}`, JSON.stringify(freshMessages.slice(-100)))
           }
           
           markAsSeen()
        } else {
          // Silently ignore abort errors (expected when switching chats)
          if (error.message?.includes('AbortError') || error.code === '20') return
          // If aborted by auth lock timeout, retry once after 500ms
          if ((error.message?.includes('Lock broken') || error.details?.includes('Lock broken')) && retryCount < 2) {
            console.warn(`Auth lock contention detected, retrying fetchMessages (${retryCount + 1})...`)
            setTimeout(() => fetchMessages(isBackgroundRefresh, retryCount + 1), 500)
            return
          }
          const hasDetails = error.message || error.details || error.hint || error.code
          if (hasDetails) {
            console.error('fetchMessages error:', { message: error.message, details: error.details, hint: error.hint, code: error.code })
          } else {
            console.error('fetchMessages unknown error:', error)
          }
        }
      } catch (err: any) {
        // AbortError is expected when switching chats — suppress it
        if (err?.name === 'AbortError' || err?.message?.includes('AbortError')) return
        console.error('fetchMessages catch error:', err?.message || err)
      } finally {
        if (isMounted && !isBackgroundRefresh && retryCount === 0) {
          setLoading(false)
        }
      }
    }

    fetchMessages()

    // When returning to the app, the tab wakes up. 
    // We fetch missing messages silently in background to repair the connection state.
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && isMounted) {
        fetchMessages(true)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    const channel = supabase.channel(`chat:${chatId}`)
    channelRef.current = channel

    channel
      // ── Instant status updates: receiver broadcasts "chat was read" ────────
      // When receiver opens chat, they mark sender's messages as seen/delivered
      // and broadcast here so sender's UI updates ticks IMMEDIATELY
      .on('broadcast', { event: 'chat_read' }, (payload: any) => {
        const { readerId, status: newStatus } = payload.payload as { readerId: string, status: string }
        const me = currentUserRef.current
        // FIX #2: Guard against null user ref (auth not ready yet) AND own reads
        if (!me?.id || readerId === me.id) return
        // Update all OWN messages (sender = me) to the new status
        setMessages((prev) =>
          prev.map((m) =>
            m.sender_id === me.id && isStatusForward(m.status, newStatus)
              ? { ...m, status: newStatus }
              : m
          )
        )
      })
      // ── Legacy status_update fallback (postgres_changes driven) ─────────────
      .on('broadcast', { event: 'status_update' }, (payload: any) => {
        const { ids, status: newStatus } = payload.payload as { ids: any[], status: string }
        if (!ids?.length) return
        // Extract UUID strings (SETOF uuid returns [{fn_name: 'uuid'}])
        const idStrings: string[] = ids.map((d: any) =>
          typeof d === 'string' ? d : (Object.values(d)[0] as string)
        ).filter(Boolean)
        setMessages((prev) =>
          prev.map((m) =>
            idStrings.includes(m.id) && isStatusForward(m.status, newStatus)
              ? { ...m, status: newStatus }
              : m
          )
        )
      })
      // ── New messages broadcast by sender ─────────────────────────────────────
      .on('broadcast', { event: 'new_message' }, (payload: any) => {
        const newMessage = payload.payload
        if (newMessage.sender_id === currentUserRef.current?.id) return

        setMessages((prev) => {
          if (newMessage.is_deleted_everyone || (newMessage.deleted_for && newMessage.deleted_for.includes(currentUserRef.current?.id))) {
             return prev.filter(m => m.id !== newMessage.id)
          }
          const exists = prev.find(m => 
            (newMessage.client_id && m.client_id === newMessage.client_id) ||
            m.id === newMessage.id
          );
          if (exists) return prev.map(m => m.id === newMessage.id ? newMessage : m);
          return [...prev, newMessage];
        });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` },
        async (payload: any) => {
          if (payload.new.deleted_for?.includes(currentUserRef.current?.id)) return;
          
          setMessages((prev) => {
            // Check if this database ID is already in our state
            const existingById = prev.find(m => m.id === payload.new.id);
            if (existingById) {
              // Already exists — only update if status goes forward
              if (isStatusForward(existingById.status, payload.new.status)) {
                return prev.map(m => m.id === payload.new.id ? { ...m, ...payload.new, client_id: m.client_id || payload.new.client_id } : m);
              }
              return prev;
            }

            // Match optimistic message by client_id
            const optimisticMatch = prev.find(m => 
              payload.new.client_id && m.client_id === payload.new.client_id
            );

            if (optimisticMatch) {
              // Replace optimistic with real DB record
              // CRITICAL: preserve any forward-progressed local status (seen/delivered)
              // set by the chat_read broadcast before DB insert fires
              const dbStatus = (STATUS_ORDER[payload.new.status] ?? 0) >= (STATUS_ORDER['sent'] ?? 0)
                ? payload.new.status : 'sent'
              return prev.map(m => {
                if (m.client_id !== payload.new.client_id) return m
                // Keep local status if it's already ahead of db insert payload
                const bestStatus = isStatusForward(dbStatus, m.status) ? m.status : dbStatus
                return { ...payload.new, client_id: m.client_id, status: bestStatus }
              })
            }

            // New message from someone else
            return [...prev, payload.new];
          });
          
          if (payload.new.sender_id !== currentUserRef.current?.id) {
            playNotificationSound()
            if (document.hidden && Notification.permission === "granted") {
                new Notification("New Message", {
                    body: payload.new.content || "📎 Media attachment",
                    icon: "/next.svg"
                });
            }
            // 1. Mark as delivered immediately
            markAsDelivered()
            // 2. Mark as seen after a short delay (recipient is in chat)
            setTimeout(() => markAsSeen(), 500)
          }
        }
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` },
        (payload: any) => {
          setMessages((prev) => {
            if (payload.new.is_deleted_everyone) {
              return prev.map(m => m.id === payload.new.id ? { ...m, ...payload.new, content: '', media_url: null } : m)
            }
            if (payload.new.deleted_for?.includes(currentUserRef.current?.id)) {
              return prev.filter(m => m.id !== payload.new.id)
            }

            return prev.map((msg) => {
              // Match by real DB id OR by the optimistic client_id if the HTTP response hasn't returned yet
              if (msg.id === payload.new.id || (payload.new.client_id && msg.client_id === payload.new.client_id)) {
                // Ensure we update to the real DB id if we matched by client_id
                const realId = payload.new.id
                
                // Only apply update if status goes forward (never go backwards)
                if (isStatusForward(msg.status, payload.new.status)) {
                  return { ...msg, ...payload.new, id: realId, client_id: msg.client_id }
                }
                // Still merge non-status fields
                const { status, ...rest } = payload.new
                return { ...msg, ...rest, id: realId, client_id: msg.client_id }
              }
              return msg
            })
          })
        }
      )
      .subscribe((status: string, err: any) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn(`Realtime ${status} for chat:${chatId} — re-fetching & re-subscribing`, err)
          if (isMounted) {
            fetchMessages(true)
            // Auto-reconnect after a brief pause
            setTimeout(() => {
              if (isMounted && channelRef.current) {
                channelRef.current.subscribe()
              }
            }, 2000)
          }
        }
      })

    // ── Lightweight status-only sync (2s) for own messages ───────────────────
    // Only fetches id+status — tiny query, never overwrites message content
    // This is the PRIMARY mechanism for showing blue ticks reliably
    // ── Fallback status-only sync (30s) for own messages ───────────────────
    // Only fetches id+status — tiny query, never overwrites message content.
    // Relaxed from 2s to 30s as we now primarily rely on Broadcasts for ticks.
    const statusSyncInterval = setInterval(async () => {
      const meId = currentUserRef.current?.id
      // FIX #3: Also guard against missing chatId to avoid querying wrong chat
      if (!isMounted || !meId || !chatId) return
      try {
        const { data: statusRows } = await supabase
          .from('messages')
          .select('id, status')
          .eq('chat_id', chatId)
          .eq('sender_id', meId)

        if (!statusRows?.length) return

        setMessages((prev) => {
          const map = new Map<string, string>(statusRows.map((r: any) => [r.id as string, r.status as string]))
          let changed = false
          const next = prev.map((m) => {
            const freshStatus = map.get(m.id)
            if (freshStatus && isStatusForward(m.status, freshStatus)) {
              changed = true
              return { ...m, status: freshStatus }
            }
            return m
          })
          return changed ? next : prev
        })
      } catch (_) {/* silently skip */}
    }, 30000)

    // ── Safety message sync (60s) — relaxed to minimize query egress ─────────
    const syncInterval = setInterval(() => {
      if (isMounted) fetchMessages(true)
    }, 60000)

    return () => { 
      isMounted = false
      abortController.abort()
      clearInterval(statusSyncInterval)
      clearInterval(syncInterval)
      document.removeEventListener('visibilitychange', handleVisibility)
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [chatId])

  const sendMessage = async (content: string, mediaUrl?: string, mediaType?: string, replyTo?: string, mediaFile?: File, recipientId?: string) => {
    if (!user || !chatId) return

    let finalMediaUrl = mediaUrl
    let finalMediaType = mediaType

    // Handle File local preview (Immediate visual feedback)
    if (mediaFile && !mediaUrl) {
      finalMediaUrl = URL.createObjectURL(mediaFile)
      const type = mediaFile.type.split('/')[0]
      finalMediaType = type === 'image' || type === 'video' || type === 'audio' ? type : 'file'
    }

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const msgData: any = {
      id: tempId,
      client_id: tempId,
      chat_id: chatId,
      sender_id: user.id,
      content,
      media_url: finalMediaUrl,
      media_type: finalMediaType,
      status: 'sending',
      created_at: new Date().toISOString(),
    }
    if (replyTo) msgData.reply_to = replyTo

    // 1. Optimistic Update (Sender's UI instantly sees the local file)
    setMessages((prev) => [...prev, msgData])

    // 2. Perform File Upload if needed
    if (mediaFile) {
      const { publicUrl, mediaType: uType, error } = await uploadFile(mediaFile, (pct) => {
        setMessages((prev) => prev.map(m => m.id === tempId ? { ...m, uploadPct: pct } : m))
      })
      if (error || !publicUrl) {
        // Mark message as failed so user can see the error (don't silently remove it)
        setMessages((prev) => prev.map(m => m.id === tempId
          ? { ...m, status: 'failed', uploadError: error || 'Upload failed' }
          : m
        ))
        console.error('Upload failed:', error)
        return { error }
      }
      finalMediaUrl = publicUrl
      finalMediaType = uType
    }

    // 3. Broadcast (Receiver's UI)
    try {
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'new_message',
          payload: { ...msgData, media_url: finalMediaUrl, media_type: finalMediaType, status: 'sent' }
        })
      }
      
      // 4. Notification Broadcast (Recipient's Sidebar)
      // We send a lightweight ping to the recipient's personal notification channel
      // This triggers their sidebar to refresh instantly.
      if (recipientId) {
        const notifyChannel = supabase.channel(`notifications:${recipientId}`)
        notifyChannel.subscribe((status: string) => {
          if (status === 'SUBSCRIBED') {
            notifyChannel.send({
              type: 'broadcast',
              event: 'ping',
              payload: { chatId, senderId: user.id }
            }).finally(() => {
              // Clean up immediately to keep active connections low
              supabase.removeChannel(notifyChannel)
            })
          }
        })
      }
    } catch (broadcastErr) {
      console.warn("Broadcast failed, continuing with insert:", broadcastErr)
    }

    // 5. Database Persistence
    const uiTimeout = setTimeout(() => {
      setMessages((prev) => prev.map(m => 
        m.id === tempId && m.status === 'sending' ? { ...m, status: 'sent' } : m
      ))
    }, 5000)

    try {
      const res = await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          content,
          media_url: finalMediaUrl,
          media_type: finalMediaType,
          reply_to: replyTo,
          client_id: tempId
        })
      })
      const result = await res.json()
      clearTimeout(uiTimeout)

      if (!res.ok || result.error) {
        throw new Error(result.error || 'Send failed')
      }

      const data = result.message
      if (data) {
        setMessages((prev) => {
          // If realtime already replaced the optimistic message with the real one, remove the temp
          if (prev.some(m => m.id === data.id)) return prev.filter(m => m.id !== tempId)
          // Replace temp with real data, but PRESERVE any forward-progressed local status
          // (e.g. chat_read broadcast may have already set 'seen' before API responded)
          const localMsg = prev.find(m => m.id === tempId)
          const bestStatus = localMsg && isStatusForward(data.status, localMsg.status)
            ? localMsg.status
            : data.status
          return prev.map(m => m.id === tempId ? { ...data, client_id: tempId, status: bestStatus } : m)
        })
      }

      return { error: null }
    } catch (err: any) {
      clearTimeout(uiTimeout)
      console.error("Insert error:", err)
      setMessages((prev) => prev.filter(m => m.id !== tempId))
      return { error: err.message }
    }
  }

  const forwardMessage = async (messageContent: string, targetChatId: string, mediaUrl?: string, mediaType?: string) => {
    if (!user) return { error: 'Not authenticated' }

    try {
      const res = await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: targetChatId,
          content: messageContent,
          media_url: mediaUrl,
          media_type: mediaType,
          forwarded: true
        })
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Forward failed')
      return { error: null }
    } catch (err: any) {
      return { error: err.message }
    }
  }

  const deleteMessage = async (messageId: string, type: 'me' | 'everyone') => {
    if (!user) return { error: 'Not authenticated' }

    if (type === 'everyone') {
      const { error } = await supabase
        .from('messages')
        .update({ 
          content: '', 
          media_url: null, 
          media_type: null,
          is_deleted_everyone: true 
        })
        .eq('id', messageId)
        .eq('sender_id', user.id) // Security: Only sender can delete for everyone
      
      if (error) return { error }
    } else {
      // Delete for me: append user ID to deleted_for array
      // First get current array
      const { data: msg } = await supabase.from('messages').select('deleted_for').eq('id', messageId).single()
      const newDeletedFor = [...(msg?.deleted_for || []), user.id]
      
      const { error } = await supabase
        .from('messages')
        .update({ deleted_for: newDeletedFor })
        .eq('id', messageId)
      
      if (error) return { error }
      
      // Update local state immediately for better UX
      setMessages(prev => prev.filter(m => m.id !== messageId))
    }

    return { error: null }
  }

  const uploadFile = async (file: File, onProgress?: (pct: number) => void) => {
    if (!user) return { error: 'Not authenticated' }

    // 1. Determine resource type and limits
    const isVideo = file.type.startsWith('video/')
    const isAudio = file.type.startsWith('audio/') || ['mp3', 'wav', 'webm', 'ogg', 'm4a'].some(ext => file.name.toLowerCase().endsWith(`.${ext}`))
    const resourceType = (isVideo || isAudio) ? 'video' : (file.type.startsWith('image/') ? 'image' : 'raw')
    const limit = (resourceType === 'video') ? 100 * 1024 * 1024 : 10 * 1024 * 1024

    if (file.size > limit) {
      return { error: `File is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Max limit is ${limit / (1024 * 1024)}MB.` }
    }

    try {
      // 2. Get Signature
      const signRes = await fetch('/api/cloudinary/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder: `chat/${chatId || 'general'}` })
      })
      const signData = await signRes.json()
      if (!signRes.ok) throw new Error(signData.error || 'Failed to get signature')

      // 3. Upload with XHR for progress tracking
      const formData = new FormData()
      formData.append('file', file)
      formData.append('api_key', signData.apiKey)
      formData.append('timestamp', signData.timestamp)
      formData.append('signature', signData.signature)
      formData.append('folder', `chat/${chatId || 'general'}`)

      const uploadData = await new Promise<any>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('POST', `https://api.cloudinary.com/v1_1/${signData.cloudName}/${resourceType}/upload`)
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable && onProgress) {
            onProgress(Math.round((e.loaded / e.total) * 100))
          }
        })
        xhr.addEventListener('load', () => {
          try {
            const data = JSON.parse(xhr.responseText)
            if (xhr.status >= 200 && xhr.status < 300) resolve(data)
            else reject(new Error(data?.error?.message || `Upload failed (${xhr.status})`))
          } catch {
            reject(new Error('Invalid response from Cloudinary'))
          }
        })
        xhr.addEventListener('error', () => reject(new Error('Network error during upload')))
        xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')))
        xhr.send(formData)
      })

      let mediaType = 'image'
      if (uploadData.resource_type === 'video') {
        mediaType = isAudio ? 'audio' : 'video'
      } else if (uploadData.resource_type === 'raw' || file.type.includes('pdf')) {
        mediaType = 'file'
      }

      return { publicUrl: uploadData.secure_url, mediaType }
    } catch (err: any) {
      console.error('Cloudinary upload error:', err)
      return { error: err.message }
    }
  }

  return { messages, loading, sendMessage, uploadFile, markAsSeen, forwardMessage, deleteMessage }
}
