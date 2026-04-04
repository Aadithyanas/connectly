import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { RealtimeChannel } from '@supabase/supabase-js'

export function useMessages(chatId?: string) {
  const [messages, setMessages] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const supabase = createClient()
  const channelRef = useRef<RealtimeChannel | null>(null)
  const currentUserRef = useRef<any>(null)

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      currentUserRef.current = user
    }
    fetchUser()

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

  const markAsSeen = useCallback(async () => {
    if (!chatId) return
    try {
      await supabase.rpc('mark_messages_seen', { cid: chatId })
    } catch (e) {
      // Silently handle if function doesn't exist yet
    }
  }, [chatId])

  useEffect(() => {
    if (!chatId) return

    const fetchMessages = async () => {
      setLoading(true)
      const { data, error } = await supabase
        .from('messages')
        .select('*, reply:reply_to(id, content, sender_id)')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true })

      if (!error) {
        setMessages(data || [])
        markAsSeen()
      }
      setLoading(false)
    }

    fetchMessages()

    const channel = supabase.channel(`chat:${chatId}`)
    channelRef.current = channel

    channel
      .on('broadcast', { event: 'new_message' }, (payload) => {
        const newMessage = payload.payload
        // Senders should ignore their own broadcasts (handled by optimistic UI)
        if (newMessage.sender_id === currentUserRef.current?.id) return

        setMessages((prev) => {
          // If message ID (database UUID) or matching content already exists, skip
          const exists = prev.find(m => 
            m.id === newMessage.id || 
            (m.content === newMessage.content && m.sender_id === newMessage.sender_id && Math.abs(new Date(m.created_at).getTime() - new Date(newMessage.created_at).getTime()) < 10000)
          );
          if (exists) return prev;
          return [...prev, newMessage];
        });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` },
        async (payload) => {
          setMessages((prev) => {
            // CRITICAL: Check if this database ID is already in our state (e.g. from Broadcast or sendMessage update)
            const idExists = prev.some(m => m.id === payload.new.id);
            if (idExists) return prev; // If ID exists, it's already updated, ignore.

            // Otherwise, check if we have a matching optimistic message to replace
            const optimisticMatch = prev.find(m => 
              m.sender_id === payload.new.sender_id && 
              m.content === payload.new.content && 
              Math.abs(new Date(m.created_at).getTime() - new Date(payload.new.created_at).getTime()) < 10000
            );

            if (optimisticMatch) {
              return prev.map(m => m.id === optimisticMatch.id ? { ...payload.new, status: 'sent' } : m);
            }

            // Finally, if it's new (not from us), append it
            return [...prev, payload.new];
          });
          
          const { data: { user } } = await supabase.auth.getUser()
          if (payload.new.sender_id !== user?.id) {
            // Play notification sound
            playNotificationSound()

            // If the document is hidden, show a browser notification
            if (document.hidden && Notification.permission === "granted") {
                new Notification("New Message", {
                    body: payload.new.content || "📎 Media attachment",
                    icon: "/next.svg"
                });
            }

            setTimeout(() => markAsSeen(), 200)
          }
        }
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` },
        (payload) => {
          setMessages((prev) => prev.map((msg) => (msg.id === payload.new.id ? { ...msg, ...payload.new } : msg)))
        }
      )
      .subscribe()

    return () => { 
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [chatId])

  const sendMessage = async (content: string, mediaUrl?: string, mediaType?: string, replyTo?: string, mediaFile?: File) => {
    const { data: { user } } = await supabase.auth.getUser()
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
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'new_message',
        payload: { ...msgData, media_url: finalMediaUrl, media_type: finalMediaType, status: 'sent' }
      })
    }

    // 4. Database Persistence
    const { data, error } = await supabase
      .from('messages')
      .insert({
        chat_id: chatId,
        sender_id: user.id,
        content,
        media_url: finalMediaUrl,
        media_type: finalMediaType,
        status: 'sent',
        reply_to: replyTo
      })
      .select()
      .single()

    if (error) {
      setMessages((prev) => prev.filter(m => m.id !== tempId))
      return { error }
    }

    if (data) {
      setMessages((prev) => {
        if (prev.some(m => m.id === data.id)) return prev.filter(m => m.id !== tempId)
        return prev.map(m => m.id === tempId ? { ...data, client_id: tempId } : m)
      })
    }

    return { error: null }
  }

  const forwardMessage = async (messageContent: string, targetChatId: string, mediaUrl?: string, mediaType?: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated' }

    const { error } = await supabase.from('messages').insert({
      chat_id: targetChatId,
      sender_id: user.id,
      content: messageContent,
      media_url: mediaUrl,
      media_type: mediaType,
      status: 'sent',
      forwarded: true,
    })
    return { error }
  }

  const uploadFile = async (file: File) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: 'Not authenticated' }

    const fileExt = file.name.split('.').pop()
    const fileName = `${Math.random()}-${Date.now()}.${fileExt}`
    const filePath = `${user.id}/${fileName}`

    const { data, error } = await supabase.storage.from('media').upload(filePath, file)
    if (error) return { error }

    const { data: { publicUrl } } = supabase.storage.from('media').getPublicUrl(filePath)
    return { publicUrl, mediaType: file.type.split('/')[0] }
  }

  return { messages, loading, sendMessage, uploadFile, markAsSeen, forwardMessage }
}
