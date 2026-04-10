'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { MessageSquare, ShieldCheck, Smartphone, Laptop, Search, MoreVertical, ChevronLeft, Users, Settings, Plus, Check, X, Loader2, Lock } from 'lucide-react'
import MessageList from './MessageList'
import MessageInput from './MessageInput'
import ForwardModal from './ForwardModal'
import { useMessages } from '@/hooks/useMessages'
import { useGroups } from '@/hooks/useGroups'
import GroupSettingsModal from './GroupSettingsModal'
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
  const { messages, loading, sendMessage, uploadFile, markAsSeen, forwardMessage, deleteMessage } = useMessages(chatId)
  const { onlineUsers, typingUsers, sendTypingStatus } = usePresence(chatId || 'global')
  const { acceptInvitation } = useGroups()
  const { user } = useAuth()
  const [otherUser, setOtherUser] = useState<any>(null)
  const [chatDetails, setChatDetails] = useState<any>(null)
  const [myMembership, setMyMembership] = useState<any>(null)
  const [replyingTo, setReplyingTo] = useState<any>(null)
  const [forwardingMessage, setForwardingMessage] = useState<any>(null)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showGroupSettings, setShowGroupSettings] = useState(false)
  const [groupMemberCount, setGroupMemberCount] = useState<number>(0)
  const [accepting, setAccepting] = useState(false)
  const supabase = createClient()
  const { settings, isLoaded } = useSettings()

  useEffect(() => {
    if (!chatId || !user) return

    const fetchDetails = async () => {
      // Fetch Chat Details
      const { data: chat } = await supabase
        .from('chats')
        .select('*')
        .eq('id', chatId)
        .single()
      
      if (chat) setChatDetails(chat)

      // Fetch My Membership
      const { data: member } = await supabase
        .from('chat_members')
        .select('*')
        .eq('chat_id', chatId)
        .eq('user_id', user.id)
        .single()
      
      if (member) setMyMembership(member)

      // Fetch Total Member Count for groups
      if (chat?.is_group) {
        const { count } = await supabase
          .from('chat_members')
          .select('*', { count: 'exact', head: true })
          .eq('chat_id', chatId)
        if (count !== null) setGroupMemberCount(count)
      }
    }

    fetchDetails()
  }, [chatId, user, supabase])

  useEffect(() => {
    if (chatId) {
      const cached = localStorage.getItem(`profile_${chatId}`)
      if (cached) {
        const parsed = JSON.parse(cached)
        // Use cached profile as-is for instant display (including status/last_seen)
        // The fresh fetch below will overwrite with latest data
        setOtherUser(parsed)
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
          const { data: members, error: membersError } = await supabase
            .from('chat_members')
            .select('user_id')
            .eq('chat_id', chatId)
            .neq('user_id', user.id)
            .limit(1)

          if (members && members.length > 0) {
            otherUserId = members[0].user_id
          } else if (membersError) {
             console.error("Error fetching other member:", membersError)
          }
        }

        if (otherUserId) {
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('id, name, email, avatar_url, status, last_seen, availability_status, role')
            .eq('id', otherUserId)
            .maybeSingle()
          
          if (profile) {
            setOtherUser(profile)
            localStorage.setItem(`profile_${chatId}`, JSON.stringify(profile))
            return
          } else if (profileError) {
             console.error("Error fetching profile:", profileError)
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
    if (!otherUserId) return
    const channel = supabase.channel(`header-${chatId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${otherUserId}` }, (payload: any) => {
        setOtherUser((prev: any) => {
          if (prev && prev.id === payload.new.id) {
            return { ...prev, ...payload.new }
          }
          return prev
        })
      })
      .subscribe((status: string) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
           fetchOtherUser()
        }
      })

    // Poll profile every 10s to match checking interval (failsafe if realtime drops)
    const statusPoll = setInterval(() => fetchOtherUser(), 10000)

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

  const handleAcceptInvite = async () => {
    if (!chatId) return
    setAccepting(true)
    const { error } = await acceptInvitation(chatId)
    if (!error) {
       setMyMembership((prev: any) => ({ ...prev, status: 'joined' }))
    }
    setAccepting(false)
  }

  const handleDeclineInvite = async () => {
    if (!chatId || !user) return
    const { error } = await supabase
      .from('chat_members')
      .delete()
      .eq('chat_id', chatId)
      .eq('user_id', user.id)
    if (!error) onBack?.()
  }

  const headerDisplay = chatDetails?.is_group ? {
    name: chatDetails.name || 'Group',
    avatar: chatDetails.avatar_url,
    status: `${groupMemberCount || 0} members`,
    isGroup: true
  } : {
    name: otherUser?.name || 'Chat',
    avatar: otherUser?.avatar_url,
    status: isOtherTyping ? 'typing...' : (isOtherOnline ? 'online' : (otherUser?.last_seen ? `last seen ${new Date(otherUser.last_seen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'offline')),
    isGroup: false
  }

  if (!chatId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#0a0a0a] relative overflow-hidden min-w-0">
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
    <div className="flex-1 flex flex-col bg-black h-full overflow-hidden min-w-0">
      {/* Header */}
      <div className="h-[56px] bg-[#0a0a0a] flex items-center justify-between px-4 sticky top-0 z-20 border-b border-white/[0.04] shrink-0">
        <div 
          className="flex items-center gap-3 cursor-pointer group min-w-0 flex-1 h-full"
          onClick={() => onOpenInfo?.()}
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
                {headerDisplay.avatar ? (
                  <img src={headerDisplay.avatar} alt="" className="w-9 h-9 object-cover rounded-full" />
                ) : (
                  <div className="w-full h-full bg-white/[0.08] flex items-center justify-center text-zinc-400 font-bold uppercase text-sm">
                    {headerDisplay.isGroup ? <Users className="w-4 h-4" /> : headerDisplay.name[0]}
                  </div>
                )}
              </div>
              {!headerDisplay.isGroup && isOtherOnline && otherUser?.availability_status !== false && (
                <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-white rounded-full border-2 border-[#0a0a0a]"></div>
              )}
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <h3 className="text-white text-[14px] font-semibold leading-none mb-1 group-hover:text-zinc-300 transition-colors truncate">{headerDisplay.name}</h3>
              <div className="flex items-center gap-1.5 overflow-hidden">
                {!headerDisplay.isGroup && (
                  <>
                    <span className="text-[10px] font-bold tracking-tighter uppercase whitespace-nowrap text-zinc-500">
                      {otherUser?.role === 'professional' ? 'Professional' : 'Student'}
                    </span>
                    <span className="text-zinc-800">·</span>
                  </>
                )}
                <span className={`text-[11px] font-medium truncate ${headerDisplay.status === 'online' || headerDisplay.status === 'typing...' ? 'text-[#22c55e]' : 'text-zinc-500'}`}>
                  {headerDisplay.status}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-1">
          {headerDisplay.isGroup && myMembership?.role === 'admin' && (
            <button 
              onClick={(e) => { e.stopPropagation(); setShowGroupSettings(true); }}
              className="p-2 text-zinc-500 hover:text-white transition-colors"
              title="Community Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}
          <button className="p-2 text-zinc-500 hover:text-white transition-colors">
            <Search className="w-4 h-4" />
          </button>
          <button 
            onClick={() => setShowSettingsModal(true)}
            className="p-2 text-zinc-500 hover:text-white transition-colors"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Invitation Banner */}
      {myMembership?.status === 'invited' && (
        <div className="bg-white text-black p-4 flex flex-col md:flex-row items-center justify-between gap-4 z-30 shadow-2xl relative">
          <div className="flex items-center gap-3">
             <div className="p-2.5 bg-black/5 rounded-full">
               <Users className="w-5 h-5" />
             </div>
             <div className="flex flex-col">
                <span className="text-sm font-black tracking-tight">Community Invitation</span>
                <span className="text-[11px] opacity-70 font-medium">Accept to see messages and participate.</span>
             </div>
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <button 
              onClick={handleDeclineInvite}
              className="flex-1 md:flex-none px-6 py-2 rounded-xl text-black bg-black/5 hover:bg-black/10 font-bold text-xs transition-all"
            >
               Decline
            </button>
            <button 
              onClick={handleAcceptInvite}
              disabled={accepting}
              className="flex-1 md:flex-none px-6 py-2 rounded-xl bg-black text-white hover:scale-105 active:scale-95 font-bold text-xs transition-all flex items-center justify-center gap-2"
            >
               {accepting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
               Join Community
            </button>
          </div>
        </div>
      )}

      {/* Main Area */}
      <div className="flex-1 relative overflow-hidden flex flex-col">
        {(myMembership?.status === 'joined' || !chatDetails?.is_group) ? (
          <>
            <div className="flex-1 relative bg-cover bg-center overflow-hidden flex flex-col bg-black">
              <MessageList 
                messages={messages} 
                loading={loading}
                currentUserId={user?.id || ''} 
                otherUserAvatar={otherUser?.avatar_url}
                currentUserAvatar={user?.user_metadata?.avatar_url}
                onReply={handleReply}
                onForward={handleForward}
                onDelete={deleteMessage}
              />
            </div>

            {/* Input area */}
            {(!chatDetails?.is_group && otherUser?.role === 'professional' && otherUser?.availability_status === false) ? (
              <div className="bg-[#0a0a0a] px-5 py-3 flex flex-col items-center gap-2 border-t border-white/[0.04]">
                <div className="bg-white/[0.04] rounded-full px-4 py-1 flex items-center gap-2">
                  <span className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Privacy Shield Active</span>
                </div>
                <p className="text-zinc-600 text-xs text-center max-w-sm">
                  This professional is currently unavailable. You can still send a message.
                </p>
                <div className="w-full opacity-50 pointer-events-none">
                  <MessageInput 
                    onSendMessage={sendMessage} 
                    onTyping={(isT) => { sendTypingStatus(isT) }}
                    onFileUpload={uploadFile}
                    replyingTo={replyingTo}
                    onCancelReply={() => setReplyingTo(null)}
                  />
                </div>
              </div>
            ) : (
              <MessageInput 
                onSendMessage={sendMessage} 
                onTyping={(isT) => { sendTypingStatus(isT) }}
                onFileUpload={uploadFile}
                replyingTo={replyingTo}
                onCancelReply={() => setReplyingTo(null)}
              />
            )}
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#0a0a0a]/40 backdrop-blur-md">
             <div className="w-16 h-16 bg-white/[0.03] rounded-[24px] flex items-center justify-center mb-6 border border-white/[0.05]">
                <Lock className="w-8 h-8 text-zinc-600" />
             </div>
             <h3 className="text-lg font-bold text-white mb-2">Private Community</h3>
             <p className="text-[13px] text-zinc-500 max-w-[240px] leading-relaxed mx-auto">
               {myMembership?.status === 'requesting' 
                 ? "Your join request is pending approval from the admin."
                 : "This community is private. You must be invited or join via community tab to view messages."}
             </p>
           </div>
        )}
      </div>

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

      <GroupSettingsModal
        isOpen={showGroupSettings}
        onClose={() => setShowGroupSettings(false)}
        chatId={chatId}
        onDetailsUpdated={(details) => setChatDetails(details)}
      />
    </div>
  )
}
