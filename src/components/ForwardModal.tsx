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

      // Get user's chat IDs
      const { data: memberOf } = await supabase
        .from('chat_members')
        .select('chat_id')
        .eq('user_id', user.id)

      if (!memberOf) return
      const chatIds = memberOf.map(m => m.chat_id)

      // Get chat details
      const { data: chatData } = await supabase
        .from('chats')
        .select('id, name, is_group')
        .in('id', chatIds)

      // Get other members' profiles for 1-on-1 chat names
      const { data: allMembers } = await supabase
        .from('chat_members')
        .select('chat_id, user_id')
        .in('chat_id', chatIds)

      const otherUserIds = [...new Set((allMembers || []).filter(m => m.user_id !== user.id).map(m => m.user_id))]
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, avatar_url')
        .in('id', otherUserIds)

      const profileMap = new Map((profiles || []).map(p => [p.id, p]))

      const formatted = (chatData || []).map(chat => {
        const otherMemberId = (allMembers || []).find(m => m.chat_id === chat.id && m.user_id !== user.id)?.user_id
        const otherProfile = otherMemberId ? profileMap.get(otherMemberId) : null
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

  const filteredChats = chats.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-[#222e35] w-full max-w-md rounded-2xl overflow-hidden shadow-2xl border border-white/5"
          >
            {/* Header */}
            <div className="p-4 bg-[#202c33] flex items-center gap-3 border-b border-[#2a3942]">
              <button onClick={onClose} className="p-1 hover:bg-[#374248] rounded-full">
                <X className="w-6 h-6 text-[#8696a0]" />
              </button>
              <h2 className="text-[#e9edef] font-bold text-lg">Forward Message</h2>
            </div>

            {/* Preview */}
            <div className="px-4 py-3 bg-[#111b21] border-b border-[#2a3942]">
              <div className="bg-[#005c4b] rounded-lg px-3 py-2 max-w-[80%]">
                <p className="text-[#e9edef] text-sm truncate">{message?.content || '📎 Media'}</p>
              </div>
            </div>

            {/* Search */}
            <div className="p-3 bg-[#111b21]">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center"><Search className="h-5 w-5 text-[#8696a0]" /></div>
                <input type="text" placeholder="Search chats..." className="block w-full pl-10 pr-3 py-2 bg-[#202c33] border-none text-[#e9edef] rounded-xl focus:ring-0 text-sm" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
            </div>

            {/* Chat List */}
            <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
              {filteredChats.map((chat) => {
                const isSent = sent.includes(chat.id)
                const isSending = sending === chat.id
                return (
                  <div key={chat.id} className="flex items-center px-4 py-3 hover:bg-[#202c33] cursor-pointer border-b border-[#2a3942] transition-colors"
                    onClick={() => !isSent && !isSending && handleForward(chat.id)}
                  >
                    <div className="w-10 h-10 rounded-full bg-[#374248] flex items-center justify-center mr-3 overflow-hidden">
                      {chat.avatar ? (
                        <Image src={chat.avatar} alt={chat.name} width={40} height={40} sizes="40px" className="object-cover rounded-full" />
                      ) : (
                        <div className="w-full h-full bg-[#00a884] flex items-center justify-center text-white font-bold uppercase">{chat.initial}</div>
                      )}
                    </div>
                    <div className="flex-1">
                      <span className="text-[#e9edef] font-medium">{chat.name}</span>
                    </div>
                    {isSending ? (
                      <div className="w-5 h-5 border-2 border-[#00a884] border-t-transparent rounded-full animate-spin"></div>
                    ) : isSent ? (
                      <Check className="w-5 h-5 text-[#25d366]" />
                    ) : (
                      <Forward className="w-5 h-5 text-[#8696a0]" />
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
