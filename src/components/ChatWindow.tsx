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
  initialData?: { name: string, avatar?: string, isGroup?: boolean }
  onOpenInfo?: (existingProfile?: any) => void
  onBack?: () => void
}

import { useAuth } from '@/context/AuthContext'

export default function ChatWindow({ chatId, initialData, onOpenInfo, onBack }: ChatWindowProps) {
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
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const supabase = createClient()
  const { settings, isLoaded } = useSettings()
  const [currentUserProfile, setCurrentUserProfile] = useState<any>(null)
  const [isLoadingMembership, setIsLoadingMembership] = useState(true)

  // Fetch current user's own profile from DB (auth metadata lags behind)
  useEffect(() => {
    if (!user?.id) return
    supabase
      .from('profiles')
      .select('avatar_url')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }: { data: { avatar_url: string } | null }) => { if (data) setCurrentUserProfile(data) })
  }, [user?.id])

  useEffect(() => {
    if (!chatId || !user) {
      setChatDetails(null)
      setOtherUser(null)
      setMyMembership(null)
      setIsLoadingMembership(false)
      return
    }

    // Apply initial data immediately if provided
    if (initialData) {
      if (initialData.isGroup) {
        setChatDetails({ name: initialData.name, avatar_url: initialData.avatar, is_group: true })
        setOtherUser(null)
      } else {
        setOtherUser({ name: initialData.name, avatar_url: initialData.avatar })
        setChatDetails({ is_group: false })
      }
    }

    setReplyingTo(null)
    setForwardingMessage(null)

    const initChat = async () => {
      // 1. Instantly restore from cache for immediate UI rendering
      const cachedChat = localStorage.getItem(`chat_${chatId}`)
      let isKnownGroup = false
      if (cachedChat) {
        try {
          const parsed = JSON.parse(cachedChat)
          setChatDetails(parsed)
          isKnownGroup = parsed.is_group
        } catch(e) {}
      } else {
        setChatDetails(null)
      }

      // Restore membership from cache
      const cachedMembership = localStorage.getItem(`membership_${chatId}`)
      if (cachedMembership) {
        try {
          setMyMembership(JSON.parse(cachedMembership))
          setIsLoadingMembership(false)
        } catch(e) {
          setIsLoadingMembership(true)
        }
      } else {
        setIsLoadingMembership(true)
      }

      // ONLY load cached profile if it's NOT a known group (prevents DM header flashing in groups)
      if (!isKnownGroup) {
        const cachedProfile = localStorage.getItem(`profile_${chatId}`)
        if (cachedProfile) {
          try {
            setOtherUser(JSON.parse(cachedProfile))
          } catch(e) {}
        } else {
          setOtherUser(null)
        }
      } else {
        setOtherUser(null)
      }

      // 2. Fetch fresh chat details (synchronizes our knowledge of is_group)
      const { data: chat } = await supabase
        .from('chats')
        .select('*')
        .eq('id', chatId)
        .single()

      if (chat) {
        setChatDetails(chat)
        localStorage.setItem(`chat_${chatId}`, JSON.stringify(chat))

        if (chat.is_group) {
          // It's a group: fetch members and membership details
          const { count } = await supabase
            .from('chat_members')
            .select('*', { count: 'exact', head: true })
            .eq('chat_id', chatId)
          if (count !== null) setGroupMemberCount(count)

          const { data: member } = await supabase
            .from('chat_members')
            .select('*')
            .eq('chat_id', chatId)
            .eq('user_id', user.id)
            .single()
          if (member) {
            setMyMembership(member)
            localStorage.setItem(`membership_${chatId}`, JSON.stringify(member))
          } else {
            setMyMembership(null)
            localStorage.removeItem(`membership_${chatId}`)
          }
          setIsLoadingMembership(false)
        } else {
          // It's a DM: fetch the other user's profile
          const { data: members, error: membersError } = await supabase
            .from('chat_members')
            .select('user_id')
            .eq('chat_id', chatId)
            .neq('user_id', user.id)
            .limit(1)

          if (members && members.length > 0) {
            const uid = members[0].user_id
            const { data: profile, error: profileError } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', uid)
              .maybeSingle()
            
            if (profile) {
              setOtherUser(profile)
              localStorage.setItem(`profile_${chatId}`, JSON.stringify(profile))
            } else if (profileError) {
              console.error("Error fetching profile:", profileError)
            }
          } else {
             // If no other member found, check if it's a self-chat
             const { data: selfMembers } = await supabase
               .from('chat_members')
               .select('user_id')
               .eq('chat_id', chatId)
               .eq('user_id', user.id)
             if (selfMembers && selfMembers.length > 0) {
               setOtherUser({ id: user.id, name: 'Just You (Saved Messages)' })
             } else {
               setOtherUser({ name: 'Unknown Chat' })
             }
          }
        }
      }
    }

    initChat()
  }, [chatId, user?.id, supabase])

  useEffect(() => {
    // Realtime profile updates (for instant status changes)
    const targetUserId = otherUser?.id
    if (!targetUserId || !chatId) return

    const fetchProfileState = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('status, last_seen, availability_status')
        .eq('id', targetUserId)
        .maybeSingle()
      if (data) {
        setOtherUser((prev: any) => ({ ...prev, ...data }))
      }
    }

    const channel = supabase.channel(`header-${chatId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${targetUserId}` }, (payload: any) => {
        setOtherUser((prev: any) => {
          if (prev && prev.id === payload.new.id) {
            return { ...prev, ...payload.new }
          }
          return prev
        })
      })
      .subscribe((status: string) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
           fetchProfileState()
        }
      })

    // Poll profile every 10s to match checking interval (failsafe if realtime drops)
    const statusPoll = setInterval(() => fetchProfileState(), 10000)

    // Also refresh when tab becomes visible
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchProfileState()
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => { 
      supabase.removeChannel(channel)
      clearInterval(statusPoll)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [otherUser?.id, chatId, supabase])


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
    name: chatDetails.name,
    avatar: chatDetails.avatar_url,
    status: `${groupMemberCount || 0} members`,
    isGroup: true
  } : {
    name: otherUser?.name,
    avatar: otherUser?.avatar_url,
    status: isOtherTyping ? 'typing...' : (isOtherOnline ? 'online' : (otherUser?.last_seen ? `last seen ${new Date(otherUser.last_seen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'offline')),
    isGroup: false
  }

  const isLoadingHeader = !headerDisplay.name

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
    <div className="flex-1 flex flex-col bg-[#0e0e0e] h-[100dvh] overflow-hidden min-w-0">
      {/* Header — The Nocturnal style */}
      <div className="glass-header flex items-center justify-between px-4 sticky top-0 z-20 border-b border-white/[0.04] shrink-0" style={{minHeight:'60px'}}>
        <div 
          className="flex items-center gap-3 cursor-pointer group min-w-0 flex-1 h-full py-3"
          onClick={() => onOpenInfo?.(otherUser)}
        >
          {onBack && (
            <button 
              onClick={(e) => { e.stopPropagation(); onBack(); }}
              className="md:hidden p-1.5 mr-1 hover:bg-white/[0.06] rounded-full text-[#adaaaa] transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative shrink-0">
              <div className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden transition-all" style={{border: isLoadingHeader ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(188,157,255,0.2)'}}>
                {isLoadingHeader ? (
                  <div className="w-full h-full bg-white/5 animate-pulse" />
                ) : headerDisplay.avatar ? (
                  <img src={headerDisplay.avatar} alt="" className="w-10 h-10 object-cover rounded-full" />
                ) : (
                  <div className="w-full h-full primary-gradient flex items-center justify-center text-white font-bold uppercase text-sm">
                    {headerDisplay.isGroup ? <Users className="w-4 h-4" /> : headerDisplay.name?.[0] || '?'}
                  </div>
                )}
              </div>
              {!isLoadingHeader && !headerDisplay.isGroup && isOtherOnline && otherUser?.availability_status !== false && (
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-[#bc9dff] rounded-full border-2 border-[#0e0e0e] animate-glow-pulse"></div>
              )}
            </div>
              <div className="flex flex-col min-w-0 flex-1">
                {/* Name + role badge on same row */}
                <div className="flex items-center gap-1.5 min-w-0">
                  {isLoadingHeader ? (
                    <div className="h-4 w-32 bg-white/5 rounded-md animate-pulse" />
                  ) : (
                    <>
                      <h3 className="font-headline text-[#bc9dff] text-[15px] leading-none truncate">{headerDisplay.name}</h3>
                      {!headerDisplay.isGroup && otherUser?.role && (
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0 uppercase tracking-wider ${
                          otherUser.role === 'professional'
                            ? 'bg-[#bc9dff]/15 text-[#bc9dff]'
                            : 'bg-white/[0.06] text-[#adaaaa]'
                        }`}>
                          {otherUser.role === 'professional' ? 'pro' : 'stu'}
                        </span>
                      )}
                    </>
                  )}
                </div>
                {/* Status / last seen below name */}
                {isLoadingHeader ? (
                  <div className="h-3 w-20 bg-white/5 rounded-md animate-pulse mt-1.5" />
                ) : (
                  <span className={`text-[11px] font-medium truncate mt-0.5 ${
                    headerDisplay.status === 'online' || headerDisplay.status === 'typing...' 
                      ? 'text-[#bc9dff]' 
                      : 'text-[#666]'
                  }`}>
                    {headerDisplay.status}
                  </span>
                )}
              </div>
          </div>
        </div>
        <div className="flex items-center gap-1 px-1">
          {headerDisplay.isGroup && myMembership?.role === 'admin' && (
            <button 
              onClick={(e) => { e.stopPropagation(); setShowGroupSettings(true); }}
              className="p-2 text-[#adaaaa] hover:text-[#bc9dff] transition-colors"
              title="Community Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
          )}
          <button 
              className="p-2 text-[#adaaaa] hover:text-[#bc9dff] transition-colors"
              onClick={(e) => { e.stopPropagation(); setIsSearchOpen(v => !v); setSearchQuery(''); }}
            >
              <Search className="w-4 h-4" />
            </button>
          <button 
            onClick={() => setShowSettingsModal(true)}
            className="p-2 text-[#adaaaa] hover:text-[#bc9dff] transition-colors"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Search Bar */}
      {isSearchOpen && (
        <div className="px-4 py-2 border-b border-white/[0.04] bg-[#0e0e0e] flex items-center gap-2 shrink-0">
          <Search className="w-3.5 h-3.5 text-[#666] shrink-0" />
          <input
            autoFocus
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search messages…"
            className="flex-1 bg-transparent text-white text-sm placeholder-[#444] outline-none"
          />
          {searchQuery && (
            <span className="text-[10px] text-[#555] whitespace-nowrap">
              {messages.filter(m => m.content?.toLowerCase()?.includes(searchQuery.toLowerCase())).length} results
            </span>
          )}
          <button onClick={() => { setIsSearchOpen(false); setSearchQuery(''); }} className="text-[#666] hover:text-white transition-colors ml-1">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

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
                messages={searchQuery ? messages.filter(m => m.content?.toLowerCase()?.includes(searchQuery.toLowerCase())) : messages} 
                loading={loading}
                chatId={chatId}
                currentUserId={user?.id || ''} 
                otherUserAvatar={otherUser?.avatar_url}
                currentUserAvatar={currentUserProfile?.avatar_url || user?.user_metadata?.avatar_url}
                isGroup={chatDetails?.is_group}
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
        ) : isLoadingMembership ? (
          <div className="flex-1 flex items-center justify-center bg-black">
            <Loader2 className="w-8 h-8 text-white/20 animate-spin" />
          </div>
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
