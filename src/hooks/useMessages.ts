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
    if (pendingSeenRef.current && retries === 0) return // Already scheduled a batch update

    const performAction = async (currRetries: number) => {
      try {
        const { error } = await supabase.rpc('mark_messages_seen', { cid: chatId })
        if (error && (error.message?.includes('Lock') || error.details?.includes('Lock')) && currRetries < 2) {
          throw error
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
      pendingSeenRef.current = setTimeout(() => performAction(0), 1000)
    }
  }, [chatId, user])

  const markAsDelivered = useCallback(async (retries = 0) => {
    if (!chatId || !user) return
    if (pendingDeliveredRef.current && retries === 0) return // Already scheduled

    const performAction = async (currRetries: number) => {
      try {
        const { error } = await supabase.rpc('mark_messages_delivered', { cid: chatId })
        if (error && (error.message?.includes('Lock') || error.details?.includes('Lock')) && currRetries < 2) {
          throw error
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
      pendingDeliveredRef.current = setTimeout(() => performAction(0), 800)
    }
  }, [chatId, user])

  useEffect(() => {
    let isMounted = true
    const abortController = new AbortController()
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
          .select('*, reply:reply_to(id, content, sender_id)')
          .eq('chat_id', chatId)
          .order('created_at', { ascending: true })
          .abortSignal(abortController.signal)
          
        if (!isMounted) return
        
        if (!error) {
           const freshMessages = data || []
           setMessages(freshMessages)
           
           // 3. Cache the fresh data (limit to last 100 messages for storage efficiency)
           if (freshMessages.length > 0) {
             localStorage.setItem(`messages_${chatId}`, JSON.stringify(freshMessages.slice(-100)))
           }
           
           markAsSeen()
        } else {
          // If aborted by auth lock timeout, retry once after 500ms
          if ((error.message?.includes('Lock broken') || error.details?.includes('Lock broken')) && retryCount < 2) {
            console.warn(`Auth lock contention detected, retrying fetchMessages (${retryCount + 1})...`)
            setTimeout(() => fetchMessages(isBackgroundRefresh, retryCount + 1), 500)
            return
          }
          console.error("fetchMessages error:", error)
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') console.error(err)
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
                return prev.map(m => m.id === payload.new.id ? { ...m, ...payload.new } : m);
              }
              return prev;
            }

            // Match optimistic message by client_id
            const optimisticMatch = prev.find(m => 
              payload.new.client_id && m.client_id === payload.new.client_id
            );

            if (optimisticMatch) {
              // Replace optimistic with real DB record, ensure status is at least 'sent'
              const newStatus = (STATUS_ORDER[payload.new.status] ?? 0) >= (STATUS_ORDER['sent'] ?? 0) 
                ? payload.new.status 
                : 'sent';
              return prev.map(m => 
                m.client_id === payload.new.client_id 
                  ? { ...payload.new, status: newStatus } 
                  : m
              );
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
                  return { ...msg, ...payload.new, id: realId }
                }
                // Still merge non-status fields
                const { status, ...rest } = payload.new
                return { ...msg, ...rest, id: realId }
              }
              return msg
            })
          })
        }
      )
      .subscribe((status: string, err: any) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn(`Realtime subscription ${status} for chat:${chatId}`, err)
          // On error, do an immediate background fetch to catch missed messages
          if (isMounted) fetchMessages(true)
        }
      })

    // Background sync: poll every 10s to catch any messages or status changes missed by realtime.
    // This is the PERMANENT reliability fix — even if WebSocket drops silently, messages still appear.
    const syncInterval = setInterval(() => {
      if (isMounted) fetchMessages(true)
    }, 10000)

    return () => { 
      isMounted = false
      abortController.abort()
      clearInterval(syncInterval)
      document.removeEventListener('visibilitychange', handleVisibility)
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [chatId])

  const sendMessage = async (content: string, mediaUrl?: string, mediaType?: string, replyTo?: string, mediaFile?: File) => {
    if (!user || !chatId) return

    let finalMediaUrl = mediaUrl
    let finalMediaType = mediaType

    // Handle File local preview (Immediate visual feedback)
    if (mediaFile && !mediaUrl) {
      finalMediaUrl = URL.createObjectURL(mediaFile)
      finalMediaType = mediaFile.type.split('/')[0]
    }

    const tempId = `temp-${Date.now()}`
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
      const { publicUrl, mediaType: uType, error } = await uploadFile(mediaFile)
      if (error || !publicUrl) {
        setMessages((prev) => prev.filter(m => m.id !== tempId))
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
    } catch (broadcastErr) {
      console.warn("Broadcast failed, continuing with insert:", broadcastErr)
    }

    // 4. Database Persistence
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
          // Otherwise replace temp with real data
          return prev.map(m => m.id === tempId ? { ...data, client_id: tempId } : m)
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

  const uploadFile = async (file: File) => {
    if (!user) return { error: 'Not authenticated' }

    try {
      // 1. Get Signature via unified server API
      const signRes = await fetch('/api/cloudinary/sign', { method: 'POST', body: JSON.stringify({ folder: `chat/${chatId || 'general'}` }) })
      const signData = await signRes.json()
      if (!signRes.ok) throw new Error(signData.error || 'Failed to get signature')

      // 2. Upload to Cloudinary directly from Client
      const formData = new FormData()
      formData.append('file', file)
      formData.append('api_key', signData.apiKey)
      formData.append('timestamp', signData.timestamp)
      formData.append('signature', signData.signature)
      formData.append('folder', `chat/${chatId || 'general'}`)

      const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${signData.cloudName}/auto/upload`, {
        method: 'POST',
        body: formData
      })
      const uploadData = await uploadRes.json()
      if (!uploadRes.ok) throw new Error(uploadData.error?.message || 'Upload failed')

      return { publicUrl: uploadData.secure_url, mediaType: uploadData.resource_type === 'video' ? 'video' : 'image' }
    } catch (err: any) {
      console.error('Cloudinary upload error:', err)
      return { error: err.message }
    }
  }

  return { messages, loading, sendMessage, uploadFile, markAsSeen, forwardMessage, deleteMessage }
}
