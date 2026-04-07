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
  onOpenInfo?: () => void
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

  // Fetch other user's profile
  useEffect(() => {
    if (!chatId || !user) return

    const fetchOtherUser = async () => {
      try {
        const { data: members, error: memError } = await supabase
          .from('chat_members')
          .select('user_id')
          .eq('chat_id', chatId)
          .neq('user_id', user.id)
          .limit(1)
          .single()

        if (members) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, name, email, avatar_url, status, last_seen, availability_status, role')
            .eq('id', members.user_id)
            .single()
          
          if (profile) setOtherUser(profile)
        }
      } catch (err: any) {
        console.error("fetchOtherUser error:", err)
        setOtherUser({ name: "Error Loading" })
      }
    }
    fetchOtherUser()

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

    return () => { supabase.removeChannel(channel) }
  }, [chatId, user?.id])

  // Mark as seen
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

  // Handle reply
  const handleReply = (message: any) => {
    setReplyingTo({
      id: message.id,
      content: message.content,
      sender_id: message.sender_id,
      senderName: message.sender_id === user?.id ? 'You' : (otherUser?.name || 'Them'),
    })
  }

  // Handle forward
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
      <div className="flex-1 flex flex-col items-center justify-center bg-[#222e35] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#00a884] opacity-5 blur-[128px] -mr-32 -mt-32"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#00a884] opacity-5 blur-[128px] -ml-32 -mb-32"></div>
        <div className="max-w-md w-full text-center space-y-8 px-4">
          <div className="flex justify-center">
            <div className="w-24 h-24 bg-[#00a884]/10 rounded-full flex items-center justify-center">
              <MessageSquare className="w-12 h-12 text-[#00a884]" />
            </div>
          </div>
          <div className="space-y-3">
            <h2 className="text-3xl font-bold text-[#e9edef]">Connectly Desktop</h2>
            <p className="text-[#8696a0] text-sm max-w-[280px] mx-auto">Send and receive messages without keeping your phone online.</p>
          </div>
          <div className="flex items-center justify-center gap-4 text-[#8696a0] opacity-50"><Smartphone className="w-4 h-4" /><div className="w-1 h-1 bg-[#8696a0] rounded-full"></div><Laptop className="w-4 h-4" /></div>
        </div>
        <div className="absolute bottom-10 left-0 right-0 flex justify-center items-center gap-2 text-[#8696a0] text-[12px]"><ShieldCheck className="w-3 h-3 text-[#00a884]" /><span>End-to-end encrypted</span></div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col bg-[#0b141a] h-full overflow-hidden">
      {/* Header */}
      <div className="h-[60px] bg-[#202c33] flex items-center justify-between px-4 sticky top-0 z-10 border-b border-[#222e35] shrink-0">
        <div className="flex items-center gap-3 cursor-pointer group min-w-0">
          {onBack && (
            <button 
              onClick={(e) => { e.stopPropagation(); onBack(); }}
              className="md:hidden p-1 mr-1 hover:bg-[#374248] rounded-full text-[#8696a0]"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}
          <div className="flex items-center gap-3 min-w-0" onClick={onOpenInfo}>
            <div className="relative shrink-0">
              <div className="w-10 h-10 rounded-full bg-[#374248] flex items-center justify-center overflow-hidden group-hover:scale-105 transition-transform">
              {otherUser?.avatar_url ? (
                <Image src={otherUser.avatar_url} alt={otherUser.name || ''} width={40} height={40} sizes="40px" className="object-cover rounded-full" />
              ) : (
                <div className="w-full h-full bg-[#00a884] flex items-center justify-center text-white font-bold uppercase">{otherUser?.name?.[0] || 'C'}</div>
              )}
            </div>
            {isOtherOnline && otherUser?.availability_status !== false && (
              <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[#25d366] rounded-full border-2 border-[#202c33]"></div>
            )}
          </div>
          <div className="flex flex-col">
            <h3 className="text-[#e9edef] text-[15.5px] font-medium leading-none mb-1 group-hover:text-[#00c99e] transition-colors">{otherUser?.name || 'Loading...'}</h3>
            <span className="text-[12px] font-medium">
              {otherUser?.role === 'professional' && otherUser?.availability_status === false ? (
                <span className="text-[#8696a0] italic flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-[#8696a0] rounded-full"></span>
                  unavailable
                </span>
              ) : (
                isOtherTyping ? <span className="text-[#25d366]">typing...</span> : isOtherOnline ? <span className="text-[#00a884]">online</span> : <span className="text-[#8696a0]">offline</span>
              )}
            </span>
          </div>
        </div>
      </div>
        <div className="flex items-center gap-4 text-[#aebac1]">
          <Search className="w-5 h-5 cursor-pointer hover:text-[#e9edef]" />
          <MoreVertical onClick={() => setShowSettingsModal(true)} className="w-5 h-5 cursor-pointer hover:text-[#e9edef] active:opacity-50" />
        </div>
      </div>

      {/* Messages */}
      <div 
        className="flex-1 relative bg-cover bg-center overflow-hidden flex flex-col" 
        style={isLoaded ? { 
          ...(settings.chatBg.startsWith('http') || settings.chatBg.startsWith('/') 
            ? { backgroundImage: `url('${settings.chatBg}')` } 
            : { backgroundColor: settings.chatBg })
        } : { backgroundColor: '#0b141a' }}
      >
        {isLoaded && (settings.chatBg.startsWith('http') || settings.chatBg.startsWith('/')) && (
          <div className="absolute inset-0 bg-[#0b141a]/60 z-0 pointer-events-none"></div>
        )}
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
        <div className="bg-[#202c33] px-6 py-4 flex flex-col items-center gap-2 border-t border-[#2a3942]">
          <div className="bg-[#374248] rounded-full px-4 py-1.5 flex items-center gap-2">
            <span className="text-[#00a884] text-xs font-bold uppercase tracking-widest">Privacy Shield Active</span>
          </div>
          <p className="text-[#8696a0] text-sm text-center">
            This professional is currently **Unavailable for messages**. <br/>
            You can still send a message, but they may not see it until they return.
          </p>
          <div className="w-full opacity-60 grayscale pointer-events-none">
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

      {/* Forward Modal */}
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
