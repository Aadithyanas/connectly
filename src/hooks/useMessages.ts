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
          // Fetch the full message with reply data
          const { data: fullMsg } = await supabase
            .from('messages')
            .select('*, reply:reply_to(id, content, sender_id)')
            .eq('id', payload.new.id)
            .single()
          
          setMessages((prev) => [...prev, fullMsg || payload.new])
          
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

    const msgData: any = {
      chat_id: chatId,
      sender_id: user.id,
      content,
      media_url: mediaUrl,
      media_type: mediaType,
      status: 'sent',
    }
    if (replyTo) msgData.reply_to = replyTo

    const { error } = await supabase.from('messages').insert(msgData)
    return { error }
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
