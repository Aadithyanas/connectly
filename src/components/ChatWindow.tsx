'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { MessageSquare, ShieldCheck, Smartphone, Laptop, Search, MoreVertical, ChevronLeft } from 'lucide-react'
import MessageList from './MessageList'
import MessageInput from './MessageInput'
import ForwardModal from './ForwardModal'
import { useMessages } from '@/hooks/useMessages'
import { usePresence } from '@/hooks/usePresence'
import { isUserOnline, useIsUserOnline } from '@/hooks/useOnlineStatus'
import Image from 'next/image'
import SettingsModal from './SettingsModal'
import { useSettings } from '@/hooks/useSettings'

interface ChatWindowProps {
  chatId?: string
  onOpenInfo?: (existingProfile?: any) => void
  onBack?: () => void
}

import { useAuth } from '@/context/AuthContext'

export default function ChatWindow({ chatId, onOpenInfo, onBack }: ChatWindowProps) {
  const { messages, loading, sendMessage, uploadFile, markAsSeen, forwardMessage } = useMessages(chatId)
  const { onlineUsers, typingUsers, sendTypingStatus } = usePresence(chatId || 'global')
  const { user } = useAuth()
  const [otherUser, setOtherUser] = useState<any>(null)
  const [replyingTo, setReplyingTo] = useState<any>(null)
  const [forwardingMessage, setForwardingMessage] = useState<any>(null)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const supabase = createClient()
  const { settings, isLoaded } = useSettings()

  useEffect(() => {
    if (chatId) {
      const cached = localStorage.getItem(`profile_${chatId}`)
      if (cached) {
        const parsed = JSON.parse(cached)
        // Don't use stale status/last_seen from cache - only use display fields
        setOtherUser({ ...parsed, status: undefined, last_seen: undefined })
      }
      else setOtherUser(null)
    } else {
      setOtherUser(null)
    }
    
    setReplyingTo(null)
    setForwardingMessage(null)
    
    if (!chatId || !user) return

    let otherUserId: string | null = null

    const fetchOtherUser = async () => {
      try {
        if (!otherUserId) {
          const { data: members } = await supabase
            .from('chat_members')
            .select('user_id')
            .eq('chat_id', chatId)
            .neq('user_id', user.id)
            .limit(1)
            .single()

          if (members) {
            otherUserId = members.user_id
          }
        }

        if (otherUserId) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, name, email, avatar_url, status, last_seen, availability_status, role')
            .eq('id', otherUserId)
            .single()
          
          if (profile) {
            setOtherUser(profile)
            localStorage.setItem(`profile_${chatId}`, JSON.stringify(profile))
            return
          }
        }
        
        // If no other member found, check if it's a self-chat
        if (!otherUserId) {
          const { data: selfMembers } = await supabase
            .from('chat_members')
            .select('user_id')
            .eq('chat_id', chatId)
            .eq('user_id', user.id)
          
          if (selfMembers && selfMembers.length > 0) {
            setOtherUser({ name: 'Just You (Saved Messages)' })
          } else {
            setOtherUser({ name: 'Unknown Chat' })
          }
        }
      } catch (err: any) {
        console.error("fetchOtherUser error:", err)
        setOtherUser({ name: 'Unknown User' })
      }
    }
    fetchOtherUser()

    // Realtime profile updates (for instant status changes)
    const channel = supabase.channel(`header-${chatId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, (payload: any) => {
        setOtherUser((prev: any) => {
          if (prev && prev.id === payload.new.id) {
            return { ...prev, ...payload.new }
          }
          return prev
        })
      })
      .subscribe()

    // Poll profile every 30s to match heartbeat cycle (failsafe if realtime misses an update)
    const statusPoll = setInterval(() => fetchOtherUser(), 30000)

    // Also refresh when tab becomes visible
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchOtherUser()
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => { 
      supabase.removeChannel(channel)
      clearInterval(statusPoll)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [chatId, user?.id])

  useEffect(() => {
    if (!chatId) return
    markAsSeen()
    const handleFocus = () => markAsSeen()
    const handleVisibility = () => { if (document.visibilityState === 'visible') markAsSeen() }
    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [chatId, markAsSeen])

  const handleReply = (message: any) => {
    setReplyingTo({
      id: message.id,
      content: message.content,
      sender_id: message.sender_id,
      senderName: message.sender_id === user?.id ? 'You' : (otherUser?.name || 'Them'),
    })
  }

  const handleForward = (message: any) => {
    setForwardingMessage(message)
  }

  const handleForwardToChat = async (targetChatId: string) => {
    if (!forwardingMessage) return
    await forwardMessage(forwardingMessage.content, targetChatId, forwardingMessage.media_url, forwardingMessage.media_type)
  }

  const isOtherOnline = useIsUserOnline(otherUser)
  const isOtherTyping = Object.entries(typingUsers).some(([uid, isT]) => uid !== user?.id && isT)

  if (!chatId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#0a0a0a] relative overflow-hidden">
        <div className="max-w-md w-full text-center space-y-6 px-4">
          <div className="flex justify-center">
            <div className="w-20 h-20 bg-white/[0.04] rounded-full flex items-center justify-center">
              <MessageSquare className="w-10 h-10 text-zinc-600" />
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-white">Nexus</h2>
            <p className="text-zinc-600 text-sm max-w-[260px] mx-auto">Send and receive messages in real-time.</p>
          </div>
          <div className="flex items-center justify-center gap-4 text-zinc-700 opacity-50"><Smartphone className="w-4 h-4" /><div className="w-1 h-1 bg-zinc-700 rounded-full"></div><Laptop className="w-4 h-4" /></div>
        </div>
        <div className="absolute bottom-8 left-0 right-0 flex justify-center items-center gap-2 text-zinc-700 text-[11px]"><ShieldCheck className="w-3 h-3" /><span>End-to-end encrypted</span></div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col bg-black h-full overflow-hidden">
      {/* Header */}
      <div className="h-[56px] bg-[#0a0a0a] flex items-center justify-between px-4 sticky top-0 z-10 border-b border-white/[0.04] shrink-0">
        <div 
          className="flex items-center gap-3 cursor-pointer group min-w-0 flex-1 h-full"
          onClick={() => onOpenInfo?.(otherUser)}
        >
          {onBack && (
            <button 
              onClick={(e) => { e.stopPropagation(); onBack(); }}
              className="md:hidden p-1 mr-1 hover:bg-white/[0.06] rounded-full text-zinc-500"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative shrink-0">
              <div className="w-9 h-9 rounded-full bg-white/[0.06] flex items-center justify-center overflow-hidden group-hover:ring-1 group-hover:ring-white/20 transition-all">
                {otherUser?.avatar_url ? (
                  <img src={otherUser.avatar_url} alt={otherUser.name || ''} className="w-9 h-9 object-cover rounded-full" />
                ) : (
                  <div className="w-full h-full bg-white/[0.08] flex items-center justify-center text-zinc-400 font-bold uppercase text-sm">{otherUser?.name?.[0] || 'N'}</div>
                )}
              </div>
              {isOtherOnline && otherUser?.availability_status !== false && (
                <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-white rounded-full border-2 border-[#0a0a0a]"></div>
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <h3 className="text-white text-[14px] font-semibold leading-none mb-0.5 group-hover:text-zinc-300 transition-colors truncate">{otherUser?.name || 'Loading...'}</h3>
              <span className="text-[11px] font-medium truncate">
                {otherUser?.role === 'professional' && otherUser?.availability_status === false ? (
                  <span className="text-zinc-600 italic flex items-center gap-1">
                    <span className="w-1.5 h-1.5 bg-zinc-600 rounded-full"></span>
                    unavailable
                  </span>
                ) : (
                  isOtherTyping ? <span className="text-zinc-400">typing...</span> : isOtherOnline ? <span className="text-zinc-400">online</span> : <span className="text-zinc-600">offline</span>
                )}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 text-zinc-500">
          <Search className="w-4 h-4 cursor-pointer hover:text-white transition-colors" />
          <MoreVertical onClick={() => setShowSettingsModal(true)} className="w-4 h-4 cursor-pointer hover:text-white transition-colors" />
        </div>
      </div>

      {/* Messages */}
      <div 
        className="flex-1 relative bg-cover bg-center overflow-hidden flex flex-col bg-black" 
      >
        <MessageList 
          messages={messages} 
          loading={loading}
          currentUserId={user?.id || ''} 
          otherUserAvatar={otherUser?.avatar_url}
          currentUserAvatar={user?.user_metadata?.avatar_url}
          onReply={handleReply}
          onForward={handleForward}
        />
      </div>

      {/* Banner / Input */}
      {otherUser?.role === 'professional' && otherUser?.availability_status === false ? (
        <div className="bg-[#0a0a0a] px-5 py-3 flex flex-col items-center gap-2 border-t border-white/[0.04]">
          <div className="bg-white/[0.04] rounded-full px-4 py-1 flex items-center gap-2">
            <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Privacy Shield Active</span>
          </div>
          <p className="text-zinc-600 text-xs text-center max-w-sm">
            This professional is currently unavailable. You can still send a message.
          </p>
          <div className="w-full opacity-50 pointer-events-none">
            <MessageInput 
              onSendMessage={async (content, mUrl, mType, replyTo, mFile) => { await sendMessage(content, mUrl, mType, replyTo, mFile) }} 
              onTyping={(isT) => { sendTypingStatus(isT) }}
              onFileUpload={async (file) => { return await uploadFile(file) }}
              replyingTo={replyingTo}
              onCancelReply={() => setReplyingTo(null)}
            />
          </div>
        </div>
      ) : (
        <MessageInput 
          onSendMessage={async (content, mUrl, mType, replyTo, mFile) => { await sendMessage(content, mUrl, mType, replyTo, mFile) }} 
          onTyping={(isT) => { sendTypingStatus(isT) }}
          onFileUpload={async (file) => { return await uploadFile(file) }}
          replyingTo={replyingTo}
          onCancelReply={() => setReplyingTo(null)}
        />
      )}

      <ForwardModal
        isOpen={!!forwardingMessage}
        onClose={() => setForwardingMessage(null)}
        message={forwardingMessage}
        onForward={handleForwardToChat}
      />

      {showSettingsModal && (
        <SettingsModal 
          type="chat" 
          onClose={() => setShowSettingsModal(false)} 
          otherUserId={otherUser?.id}
          otherUserName={otherUser?.name}
        />
      )}
    </div>
  )
}
