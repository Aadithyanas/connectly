'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { X, Search, Forward, Check } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import { useAuth } from '@/context/AuthContext'

interface ForwardModalProps {
  isOpen: boolean
  onClose: () => void
  message: any
  onForward: (targetChatId: string) => Promise<void>
}

export default function ForwardModal({ isOpen, onClose, message, onForward }: ForwardModalProps) {
  const [chats, setChats] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [sending, setSending] = useState<string | null>(null)
  const [sent, setSent] = useState<string[]>([])
  const { user } = useAuth()
  const supabase = createClient()

  useEffect(() => {
    if (!isOpen || !user) return

    const fetchChats = async () => {
      if (!user) return
      const { data: memberOf } = await supabase.from('chat_members').select('chat_id').eq('user_id', user.id)
      if (!memberOf) return
      const chatIds = memberOf.map((m: any) => m.chat_id)
      const { data: chatData } = await supabase.from('chats').select('id, name, is_group').in('id', chatIds)
      const { data: allMembers } = await supabase.from('chat_members').select('chat_id, user_id').in('chat_id', chatIds)
      const otherUserIds = [...new Set((allMembers || []).filter((m: any) => m.user_id !== user.id).map((m: any) => m.user_id))]
      const { data: profiles } = await supabase.from('profiles').select('id, name, avatar_url').in('id', otherUserIds)
      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]))

      const formatted = (chatData || []).map((chat: any) => {
        const otherMemberId = (allMembers || []).find((m: any) => m.chat_id === chat.id && m.user_id !== user.id)?.user_id
        const otherProfile: any = otherMemberId ? profileMap.get(otherMemberId) : null
        return {
          id: chat.id,
          name: chat.is_group ? chat.name : (otherProfile?.name || 'Unknown'),
          avatar: otherProfile?.avatar_url || null,
          initial: (chat.is_group ? chat.name?.[0] : otherProfile?.name?.[0]) || '?',
        }
      })
      setChats(formatted)
    }

    fetchChats()
    setSent([])
    setSearch('')
  }, [isOpen])

  const handleForward = async (chatId: string) => {
    setSending(chatId)
    await onForward(chatId)
    setSending(null)
    setSent(prev => [...prev, chatId])
  }

  const filteredChats = chats.filter((c: any) => c.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-[#0a0a0a] w-full max-w-md rounded-2xl overflow-hidden shadow-2xl border border-white/[0.06]"
          >
            <div className="p-4 flex items-center gap-3 border-b border-white/[0.04]">
              <button onClick={onClose} className="p-1 hover:bg-white/[0.06] rounded-full">
                <X className="w-5 h-5 text-zinc-500" />
              </button>
              <h2 className="text-white font-bold text-base">Forward Message</h2>
            </div>

            <div className="px-4 py-3 border-b border-white/[0.04]">
              <div className="bg-white/[0.04] rounded-lg px-3 py-2 max-w-[80%]">
                <p className="text-zinc-300 text-sm truncate">{message?.content || '📎 Media'}</p>
              </div>
            </div>

            <div className="p-3 border-b border-white/[0.03]">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center"><Search className="h-4 w-4 text-zinc-600" /></div>
                <input type="text" placeholder="Search chats..." className="block w-full pl-10 pr-3 py-2 bg-white/[0.03] border border-white/[0.04] text-white rounded-xl focus:ring-1 focus:ring-white/10 text-sm placeholder-zinc-700 outline-none" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
            </div>

            <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
              {filteredChats.map((chat: any) => {
                const isSent = sent.includes(chat.id)
                const isSending = sending === chat.id
                return (
                  <div key={chat.id} className="flex items-center px-4 py-3 hover:bg-white/[0.03] cursor-pointer border-b border-white/[0.03] transition-colors"
                    onClick={() => !isSent && !isSending && handleForward(chat.id)}
                  >
                    <div className="w-10 h-10 rounded-full bg-white/[0.06] flex items-center justify-center mr-3 overflow-hidden">
                      {chat.avatar ? (
                        <img src={chat.avatar} alt={chat.name} className="w-10 h-10 object-cover rounded-full" />
                      ) : (
                        <div className="w-full h-full bg-white/[0.08] flex items-center justify-center text-zinc-400 font-bold uppercase">{chat.initial}</div>
                      )}
                    </div>
                    <div className="flex-1">
                      <span className="text-white font-medium text-sm">{chat.name}</span>
                    </div>
                    {isSending ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : isSent ? (
                      <Check className="w-4 h-4 text-white" />
                    ) : (
                      <Forward className="w-4 h-4 text-zinc-600" />
                    )}
                  </div>
                )
              })}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
