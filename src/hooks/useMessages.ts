import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { RealtimeChannel } from '@supabase/supabase-js'
import { useAuth } from '@/context/AuthContext'

export function useMessages(chatId?: string) {
  const [messages, setMessages] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const { user } = useAuth()
  const supabase = createClient()
  const channelRef = useRef<RealtimeChannel | null>(null)
  const currentUserRef = useRef<any>(null)

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

  const markAsSeen = useCallback(async () => {
    if (!chatId) return
    try {
      await supabase.rpc('mark_messages_seen', { cid: chatId })
    } catch (e) {
      // Silently handle if function doesn't exist yet
    }
  }, [chatId])

  useEffect(() => {
    let isMounted = true
    setMessages([])
    
    if (!chatId) {
      setLoading(false)
      return
    }

    const fetchMessages = async () => {
      if (!isMounted) return
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('messages')
          .select('*, reply:reply_to(id, content, sender_id)')
          .eq('chat_id', chatId)
          .order('created_at', { ascending: true })
          
        if (!isMounted) return
        
        if (!error) {
          setMessages(data || [])
          markAsSeen()
        } else {
          console.error("fetchMessages error:", error)
        }
      } catch (err: any) {
        console.error(err)
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    fetchMessages()

    const channel = supabase.channel(`chat:${chatId}`)
    channelRef.current = channel

    channel
      .on('broadcast', { event: 'new_message' }, (payload: any) => {
        const newMessage = payload.payload
        if (newMessage.sender_id === currentUserRef.current?.id) return

        setMessages((prev) => {
          // STRICT DEDUPLICATION: Check if this CLIENT_ID already exists
          const exists = prev.find(m => 
            (newMessage.client_id && m.client_id === newMessage.client_id) ||
            m.id === newMessage.id
          );
          if (exists) return prev;
          return [...prev, newMessage];
        });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` },
        async (payload: any) => {
          setMessages((prev) => {
            // Check if this database ID is already in our state
            const idExists = prev.some(m => m.id === payload.new.id);
            if (idExists) return prev;

            // Use CLIENT_ID to match the optimistic message perfectly
            const optimisticMatch = prev.find(m => 
              payload.new.client_id && m.client_id === payload.new.client_id
            );

            if (optimisticMatch) {
              return prev.map(m => m.id === optimisticMatch.id ? { ...payload.new, status: 'sent' } : m);
            }

            // Finally, if it's new (not from us), append it
            return [...prev, payload.new];
          });
          
          if (payload.new.sender_id !== currentUserRef.current?.id) {
            playNotificationSound()
            // Document hidden check...
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
        (payload: any) => {
          setMessages((prev) => prev.map((msg) => (msg.id === payload.new.id ? { ...msg, ...payload.new } : msg)))
        }
      )
      .subscribe()

    return () => { 
      isMounted = false
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
        reply_to: replyTo,
        client_id: tempId
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
