'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'

export function useMessages(chatId?: string) {
  const [messages, setMessages] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

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

    const channel = supabase
      .channel(`chat:${chatId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` },
        async (payload) => {
          // If we already have this message (optimistic update), we just update its status
          setMessages((prev) => {
            const exists = prev.find(m => m.id === payload.new.id || (m.status === 'sending' && m.content === payload.new.content && m.sender_id === payload.new.sender_id));
            if (exists) {
              return prev.map(m => m.id === exists.id ? { ...payload.new, status: 'sent' } : m);
            }
            return [...prev, payload.new];
          });
          
          const { data: { user } } = await supabase.auth.getUser()
          if (payload.new.sender_id !== user?.id) {
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

    return () => { supabase.removeChannel(channel) }
  }, [chatId])

  const sendMessage = async (content: string, mediaUrl?: string, mediaType?: string, replyTo?: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !chatId) return

    const tempId = `temp-${Date.now()}`
    const msgData: any = {
      chat_id: chatId,
      sender_id: user.id,
      content,
      media_url: mediaUrl,
      media_type: mediaType,
      status: 'sending',
      created_at: new Date().toISOString(),
    }
    if (replyTo) msgData.reply_to = replyTo

    // Optimistic Update
    setMessages((prev) => [...prev, msgData])

    const { data, error } = await supabase
      .from('messages')
      .insert({
        chat_id: chatId,
        sender_id: user.id,
        content,
        media_url: mediaUrl,
        media_type: mediaType,
        status: 'sent',
        reply_to: replyTo
      })
      .select()
      .single()

    if (error) {
      // Remove optimistic message on error
      setMessages((prev) => prev.filter(m => m.id !== tempId))
      return { error }
    }

    if (data) {
      // Update the optimistic message with the real data
      setMessages((prev) => prev.map(m => m.status === 'sending' && m.content === content ? data : m))
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
