'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Search, UserCircle, Home, Plus, Compass, CircleDashed, Trophy, Users, Globe } from 'lucide-react'
import Image from 'next/image'
import { isUserOnline } from '@/hooks/useOnlineStatus'

import SettingsModal from './SettingsModal'
import { useSettings } from '@/hooks/useSettings'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { useNotify } from '@/hooks/useNotify'
import { Status } from '@/hooks/useStatuses'
import { useAuth } from '@/context/AuthContext'
import GroupDiscovery from './GroupDiscovery'
import { usePWAInstall } from '@/hooks/usePWAInstall'
import { Download } from 'lucide-react'

// Global lock to prevent multiple sidebar instances from hammering the DB simultaneously
let globalMarkDeliveredLock = false;
let lastMarkDeliveredTime = 0;

interface ChatSidebarProps {
  onSelectChat: (chatId: string, metadata?: { name: string, avatar?: string, isGroup?: boolean }) => void
  activeChatId?: string
  onOpenNewChat: () => void
  onOpenProfile: () => void
  onOpenSettings: () => void
  activeTab: 'chat' | 'feed' | 'initiative' | 'challenges' | 'groups'
  onTabChange: (tab: 'chat' | 'feed' | 'initiative' | 'challenges' | 'groups') => void
  isModalOpen?: boolean
}

export default function ChatSidebar({ onSelectChat, activeChatId, onOpenNewChat, onOpenProfile, onOpenSettings, activeTab, onTabChange, isModalOpen }: ChatSidebarProps) {
  usePushNotifications()
  const [chats, setChats] = useState<any[] | null>(null)
  const [groupSubTab, setGroupSubTab] = useState<'my' | 'community'>('my')
  const [loading, setLoading] = useState(false)
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [search, setSearch] = useState('')
  const { user, signOut, loading: authLoading, profile: authProfile } = useAuth()
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [imageError, setImageError] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [isMounted, setIsMounted] = useState(false)
  const supabase = createClient()
  const { isInstallable, installApp } = usePWAInstall()
  
  const { settings, isLoaded } = useSettings()
  // Unique ID for this instance to prevent channel name collisions when multiple sidebars mount (e.g. mobile carousel)
  const instanceId = useRef(Math.random().toString(36).substring(7))

  const fetchUserAndChats = useCallback(async (showSkeleton = false) => {
    if (!user) {
      if (!authLoading) {
        setChats([])
        setLoading(false)
        setIsInitialLoading(false)
      }
      return
    }
    
    // Only show skeleton on first load, not on background refreshes
    if (showSkeleton) setLoading(true)
    try {

      const { data: memberOf, error: memberError } = await supabase
        .from('chat_members')
        .select('chat_id')
        .eq('user_id', user.id)

      if (memberError || !memberOf) {
        console.error('Member fetch error:', memberError)
        setIsInitialLoading(false)
        return
      }
      
      const chatIds = memberOf.map((m: any) => m.chat_id).filter(Boolean)
      if (chatIds.length === 0) { 
        setChats([])
        setIsInitialLoading(false)
        return 
      }

      const { data: chatData, error: chatError } = await supabase
        .from('chats')
        .select('id, name, description, is_group, avatar_url')
        .in('id', chatIds)

      if (chatError || !chatData) {
        console.error('Chat fetch error:', chatError)
        setIsInitialLoading(false)
        return
      }

      const { data: allMembers } = await supabase
        .from('chat_members')
        .select('chat_id, user_id')
        .in('chat_id', chatIds)

      const allUserIds = [...new Set((allMembers || []).map((m: any) => m.user_id))].filter(Boolean)
      let allProfiles = []
      
      if (allUserIds.length > 0) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .in('id', allUserIds)
        if (data) {
          allProfiles = data
        }
      }

      const profileMap = new Map(allProfiles.map((p: any) => [p.id, p]))

      const { data: summaries } = await supabase.rpc('get_user_chat_summaries', { p_user_id: user.id })
      const summaryMap = new Map((summaries as any[] || []).map((s: any) => [s.res_chat_id, s]))

      const formattedChats = chatData.map((chat: any) => {
        const chatMembers = (allMembers || []).filter((m: any) => m.chat_id === chat.id)
        const otherMemberId = chatMembers.find((m: any) => m.user_id !== user.id)?.user_id
        const otherProfile: any = otherMemberId ? profileMap.get(otherMemberId) : null

        // Get nickname from localStorage if exists
        let displayName = chat.is_group ? (chat.name || 'Group') : (otherProfile?.name || 'Chat')
        if (!chat.is_group && otherMemberId) {
          const savedNickname = localStorage.getItem(`nickname_${otherMemberId}`)
          if (savedNickname) displayName = savedNickname
        }

        const summary = summaryMap.get(chat.id)
        const unreadCount = Number(summary?.res_unread_count) || 0
        const lastMsgContent = summary?.res_last_message_content || (summary?.res_last_message_media_type ? '📎 Media' : 'No messages yet')
        const lastMsgTime = summary?.res_last_message_created_at || ''

        let lastTime = ''
        if (lastMsgTime) {
          const date = new Date(lastMsgTime)
          const now = new Date()
          if (date.toDateString() === now.toDateString()) {
            lastTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          } else {
            const yesterday = new Date(now)
            yesterday.setDate(yesterday.getDate() - 1)
            lastTime = date.toDateString() === yesterday.toDateString() ? 'Yesterday' : date.toLocaleDateString([], { month: 'short', day: 'numeric' })
          }
        }

        return {
          id: chat.id,
          is_group: chat.is_group,
          display_name: displayName,
          display_avatar: chat.is_group ? chat.avatar_url : otherProfile?.avatar_url,
          description: chat.description,
          group_members: chat.is_group ? chatMembers.map((m: any) => profileMap.get(m.user_id)).filter(Boolean) : [],
          other_profile: otherProfile,
          unread_count: unreadCount,
          last_message: lastMsgContent,
          last_time: lastTime || 'Now',
          last_msg_time: lastMsgTime,
        }
      })

      formattedChats.sort((a: any, b: any) => (b.last_msg_time || '').localeCompare(a.last_msg_time || ''))
      setChats(formattedChats)
      
      if (user?.id && formattedChats.length > 0) {
        localStorage.setItem(`chats_${user.id}`, JSON.stringify(formattedChats))
        
        // Restore double tick: mark messages delivered, but precisely gated
        // to prevent 3 concurrent updates per client.
        if (!globalMarkDeliveredLock && Date.now() - lastMarkDeliveredTime > 3000) {
          globalMarkDeliveredLock = true;
          supabase.rpc('mark_all_messages_delivered')
            .then(() => { lastMarkDeliveredTime = Date.now() })
            .catch((e: any) => console.warn('mark_all_messages_delivered error', e))
            .finally(() => { globalMarkDeliveredLock = false })
        }
      }
      setIsInitialLoading(false)
    } catch (err) {
      console.error('Fetch chats error:', err)
      setIsInitialLoading(false)
    } finally {
      setLoading(false)
    }
  }, [user, authLoading])

  const userIdRef = useRef<string | null>(null)
  const pendingBatchDelivered = useRef<Map<string, NodeJS.Timeout>>(new Map())
  const fetchTimerRef = useRef<NodeJS.Timeout | null>(null)
  const fetchRef = useRef<any>(null)

  useEffect(() => {
    userIdRef.current = user?.id || null
    fetchRef.current = fetchUserAndChats
  }, [user, fetchUserAndChats])

  const getGreeting = () => {
    const hour = currentTime.getHours()
    if (hour < 12) return 'Good Morning'
    if (hour < 17) return 'Good Afternoon'
    return 'Good Evening'
  }

  const formatDateTime = () => {
    return {
      day: currentTime.toLocaleDateString('en-US', { day: '2-digit' }),
      month: currentTime.toLocaleDateString('en-US', { month: '2-digit' }),
      weekday: currentTime.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
      hours: currentTime.toLocaleTimeString('en-US', { hour: '2-digit', hour12: true }).split(' ')[0],
      minutes: currentTime.toLocaleTimeString('en-US', { minute: '2-digit' }).padStart(2, '0'),
      seconds: currentTime.toLocaleTimeString('en-US', { second: '2-digit' }).padStart(2, '0'),
      ampm: currentTime.toLocaleTimeString('en-US', { hour12: true }).slice(-2)
    }
  }

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    // Fail-safe to hide skeletons after 8 seconds
    const timeoutId = setTimeout(() => {
      setLoading(false)
      setIsInitialLoading(false)
    }, 8000)

    if (user && chats === null) {
      try {
        const cached = localStorage.getItem(`chats_${user.id}`)
        if (cached) {
          const parsed = JSON.parse(cached)
          if (Array.isArray(parsed) && parsed.length > 0) {
            setChats(parsed)
            setLoading(false)
            setIsInitialLoading(false)
          }
        }
      } catch (e) {
        console.error('Cache load error:', e)
      }
    }

    return () => clearTimeout(timeoutId)
  }, [user])

  useEffect(() => {
    const handleChatUpdated = (e: any) => {
      const updatedChat = e.detail
      setChats(prev => (prev || []).map(c => 
        c.id === updatedChat.id 
          ? { ...c, display_name: updatedChat.name, description: updatedChat.description, display_avatar: updatedChat.avatar_url || c.display_avatar }
          : c
      ))
    }

    const handleAppRefresh = () => {
      fetchUserAndChats(false)
    }
    
    window.addEventListener('chat-updated', handleChatUpdated)
    window.addEventListener('app:refresh', handleAppRefresh)
    return () => {
      window.removeEventListener('chat-updated', handleChatUpdated)
      window.removeEventListener('app:refresh', handleAppRefresh)
    }
  }, [])

  // Debounced fetch: prevents stacking 10+ simultaneous fetches when many events fire
  fetchRef.current = fetchUserAndChats

  const debouncedFetch = useCallback(() => {
    if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current)
    // Always background refresh (false) when triggered by realtime events
    fetchTimerRef.current = setTimeout(() => fetchRef.current(false), 400)
  }, [])

  userIdRef.current = user?.id || null

  useEffect(() => {
    if (!user) {
      if (!authLoading) {
        setChats([])
        setLoading(false)
      }
      return
    }

    // Show skeleton only if we have NO messages and NO local state
    // If we have data in state or cache, do a background refresh instead
    const hasData = chats && chats.length > 0
    fetchUserAndChats(!hasData)

    // Safety timeout: never stay stuck in loading for more than 8 seconds
    loadingTimeoutRef.current = setTimeout(() => {
      setLoading(false)
    }, 8000)

    // Transitioned to "Fake Realtime" Polling for sidebar updates
    let syncIntervalId: NodeJS.Timeout

    const startSync = () => {
      const isIdle = document.visibilityState === 'hidden'
      const interval = isIdle ? 120000 : 30000 // 30s active / 120s idle
      
      syncIntervalId = setInterval(() => {
        fetchUserAndChats(false)
      }, interval)
    }

    startSync()

    const handleVisibilityChange = () => {
      clearInterval(syncIntervalId)
      if (document.visibilityState === 'visible') {
        fetchUserAndChats(false)
      }
      startSync()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Clock only - don't clone chats array every second
    const clockInterval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)


    // Add storage event listener to refresh nicknames if changed in other tabs/components
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key && e.key.startsWith('nickname_')) {
        // Refresh local state to reflect new nickname
        fetchUserAndChats(false)
      }
    }
    window.addEventListener('storage', handleStorageChange)

    return () => { 
      window.removeEventListener('storage', handleStorageChange)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      clearInterval(clockInterval)
      clearInterval(syncIntervalId)
      if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current)
      if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current)
    }
  }, [user?.id, authLoading])

  // Instant Sidebar Updates via Broadcast Pings
  useNotify(() => {
    // When we get a ping, trigger a debounced fetch to update unread counts/order
    debouncedFetch()
  })

  const handleLogout = async () => {
    if (user) {
      await supabase.from('profiles').update({ status: 'offline', last_seen: new Date().toISOString() }).eq('id', user.id)
    }
    await signOut()
    window.location.href = '/login'
  }

  const filteredChats = chats ? chats.filter((c: any) => {
    const matchesSearch = (c.display_name?.toLowerCase() || '').includes(search.toLowerCase()) ||
                         (c.display_email?.toLowerCase() || '').includes(search.toLowerCase())
    
    if (activeTab === 'chat') return matchesSearch && !c.is_group
    if (activeTab === 'groups' && groupSubTab === 'my') return matchesSearch && c.is_group
    
    return false // Community tab handled separately
  }) : []

  const textSizeClass = settings.textSize === 'small' ? 'text-sm' : settings.textSize === 'large' ? 'text-lg' : 'text-base'
  const rawAvatarSrc = authProfile?.avatar_url || user?.user_metadata?.avatar_url || null
  const avatarSource = imageError ? null : rawAvatarSrc

  return (
    <div className="w-full flex flex-col border-r border-white/[0.04] h-full shrink-0 relative transition-all bg-[#000] overflow-hidden min-w-0">

      <div className="h-[60px] bg-[#0a0a0a] flex items-center justify-between px-4 sticky top-0 z-10 border-b border-white/[0.04]">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3 cursor-pointer" onClick={onOpenProfile}>
            {avatarSource ? (
              <img 
                src={avatarSource} 
                alt="Profile" 
                onError={() => setImageError(true)}
                className="w-10 h-10 rounded-full hover:opacity-80 transition-opacity border border-white/[0.08] object-cover" 
              />
            ) : (
              <UserCircle className="w-10 h-10 text-zinc-600 cursor-pointer" />
            )}
          </div>
          <div className="flex flex-col">
            <h2 className="text-zinc-500 text-[11px] font-medium tracking-tight leading-tight">
              {getGreeting()}
            </h2>
            <span className="text-white text-[14px] font-bold">
              {authProfile?.name || user?.user_metadata?.full_name || 'User'}
            </span>
          </div>
        </div>

        {isMounted && (
          <>
            <div className="flex md:hidden flex-col items-center min-w-[120px]">
              <div className="flex items-center gap-1.5 text-zinc-600 text-[10px] font-mono font-bold tracking-widest border-b border-white/[0.04] pb-1 mb-1 w-full justify-center">
                <span>{formatDateTime().day}</span>
                <span className="opacity-30">.</span>
                <span>{formatDateTime().month}</span>
                <span className="opacity-30">.</span>
                <span className="text-zinc-500">{formatDateTime().weekday}</span>
              </div>
              
              <div className="flex items-baseline gap-1">
                <div className="text-white text-[18px] font-mono font-black tracking-[-0.1em] tabular-nums flex items-baseline">
                  {formatDateTime().hours}
                  <span className="mx-0.5 opacity-30">:</span>
                  {formatDateTime().minutes}
                  <span className="text-[13px] opacity-20 ml-1">.{formatDateTime().seconds}</span>
                </div>
                <div className="text-zinc-600 text-[9px] font-mono font-bold uppercase ml-1">
                  {formatDateTime().ampm}
                </div>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-2">
            <button 
              onClick={() => onTabChange('chat')}
              className={`p-2 rounded-full transition-all duration-300 ${activeTab === 'chat' ? 'bg-white text-black' : 'text-zinc-500 hover:text-white hover:bg-white/10'}`}
              title="Direct Messages"
            >
              <Home className="w-4 h-4" />
            </button>
            <button 
              onClick={() => onTabChange('groups')}
              className={`p-2 rounded-full transition-all duration-300 ${activeTab === 'groups' ? 'bg-white text-black' : 'text-zinc-500 hover:text-white hover:bg-white/10'}`}
              title="Group Communities"
            >
              <Users className="w-4 h-4" />
            </button>
            <button 
              onClick={onOpenNewChat}
              className="p-2 rounded-full text-zinc-500 hover:text-white hover:bg-white/10 transition-all duration-300"
              title="New Conversation"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button 
              onClick={() => onTabChange('feed')}
              className={`p-2 rounded-full transition-all duration-300 ${activeTab === 'feed' ? 'bg-white text-black' : 'text-zinc-500 hover:text-white hover:bg-white/10'}`}
              title="Discovery Feed"
            >
              <Compass className="w-4 h-4" />
            </button>
              <button 
                onClick={() => onTabChange('initiative')}
                className={`p-2 rounded-full transition-all duration-300 ${activeTab === 'initiative' ? 'bg-white text-black' : 'text-zinc-500 hover:text-white hover:bg-white/10'}`}
                title="Initiatives"
              >
                <CircleDashed className="w-4 h-4" />
              </button>
              <button 
                onClick={() => onTabChange('challenges')}
                className={`p-2 rounded-full transition-all duration-300 ${activeTab === 'challenges' ? 'bg-white text-black' : 'text-zinc-500 hover:text-white hover:bg-white/10'}`}
                title="Connectly Challenges"
              >
                <Trophy className="w-4 h-4" />
              </button>
            </div>
          </>
        )}
      </div>

      <div className="p-3 bg-black/60 border-b border-white/[0.04] space-y-3">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-600"><Search className="h-4 w-4" /></div>
          <input type="text" placeholder={activeTab === 'groups' ? "Search for communities..." : "Search or start new chat"} className="block w-full pl-10 pr-3 py-2 bg-white/[0.03] border border-white/[0.04] text-white rounded-xl focus:ring-1 focus:ring-white/10 text-sm placeholder-zinc-700 outline-none transition-all" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        {activeTab === 'groups' && (
          <div className="flex bg-white/[0.03] p-1 rounded-lg border border-white/[0.04]">
            <button 
              onClick={() => setGroupSubTab('my')}
              className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-[11px] font-bold rounded-md transition-all ${groupSubTab === 'my' ? 'bg-white/[0.08] text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              <Users className="w-3 h-3" />
              My Groups
            </button>
            <button 
              onClick={() => setGroupSubTab('community')}
              className={`flex-1 flex items-center justify-center gap-2 py-1.5 text-[11px] font-bold rounded-md transition-all ${groupSubTab === 'community' ? 'bg-white/[0.08] text-white shadow-lg' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              <Globe className="w-3 h-3" />
              Community
            </button>
          </div>
        )}
      </div>


      <div className="flex-1 overflow-y-auto custom-scrollbar pb-24 md:pb-0">
        {activeTab === 'groups' && groupSubTab === 'community' ? (
          <GroupDiscovery currentUserId={user?.id || ''} onSelectChat={onSelectChat} />
        ) : (loading && isInitialLoading && (!chats || chats.length === 0)) || authLoading ? (
          <div className="flex flex-col">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center px-4 py-3 border-b border-white/[0.03] animate-pulse">
                <div className="w-11 h-11 rounded-full bg-white/[0.04] shrink-0 mr-3 animate-skeleton"></div>
                <div className="flex-1 min-w-0 pr-2">
                  <div className="h-3.5 w-1/3 bg-white/[0.04] rounded mb-2 animate-skeleton"></div>
                  <div className="h-3 w-3/4 bg-white/[0.04] rounded animate-skeleton"></div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredChats.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <p className="text-zinc-700 text-sm">{search ? 'No conversations found.' : 'No chats yet. Tap + to start.'}</p>
          </div>
        ) : (
          <div className={activeTab === 'groups' ? "flex flex-col gap-5 p-4" : ""}>
            {filteredChats.map((chat) => {
              if (activeTab === 'groups') {
                const memberProfiles = chat.group_members || [];
                const displayMembers = memberProfiles.slice(0, 3);
                const extraCount = memberProfiles.length > 3 ? memberProfiles.length - 3 : 0;

                return (
                  <div key={chat.id} className="relative bg-[#09090b] rounded-3xl p-5 border border-white/[0.04] overflow-hidden flex flex-col hover:border-white/10 transition-all duration-300 cursor-pointer shadow-[0_8px_30px_rgba(0,0,0,0.5)]" onClick={() => onSelectChat(chat.id, { name: chat.display_name, avatar: chat.display_avatar, isGroup: true })}>

                    {/* Title & Unread Count */}
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="text-[20px] font-bold text-white pr-4 tracking-tight leading-[1.1] truncate flex-1 min-w-0">
                        {chat.display_name}
                      </h3>
                      {chat.unread_count > 0 && (
                         <div className="min-w-[22px] h-[22px] px-1.5 bg-[#10b981] rounded-full flex items-center justify-center shrink-0 shadow-[0_0_10px_rgba(16,185,129,0.3)]">
                          <span className="text-white text-[11px] font-bold">{chat.unread_count > 99 ? '99+' : chat.unread_count}</span>
                        </div>
                      )}
                    </div>

                    {/* Avatars */}
                    <div className="flex items-center justify-between mb-5">
                      <div className="flex -space-x-3">
                        {displayMembers.length > 0 ? (
                          displayMembers.map((profile: any, i: number) => {
                            const gradients = [
                              'from-[#ff7eb3] to-[#ff758c]',
                              'from-[#bc9dff] to-[#4c1d95]',
                              'from-[#4facfe] to-[#00f2fe]',
                            ]
                            const avatar = profile?.avatar_url;
                            
                            return (
                              <div key={i} className={`w-9 h-9 rounded-full border-[2.5px] border-[#09090b] bg-gradient-to-br ${gradients[i % gradients.length]} shrink-0 shadow-md flex items-center justify-center overflow-hidden`} style={{ zIndex: 10 - i }}>
                                  {avatar ? (
                                    <img src={avatar} className="w-full h-full object-cover" alt="Member" onError={(e) => e.currentTarget.style.display = 'none'} />
                                  ) : (
                                    <Users className="w-4 h-4 text-white/50" />
                                  )}
                              </div>
                            )
                          })
                        ) : (
                          <div className="w-9 h-9 rounded-full border-[2.5px] border-[#09090b] bg-white/[0.05] shrink-0 shadow-md flex items-center justify-center overflow-hidden z-10">
                            {chat.display_avatar ? (
                              <img src={chat.display_avatar} className="w-full h-full object-cover" alt="Group" />
                            ) : (
                              <Users className="w-4 h-4 text-white/40" />
                            )}
                          </div>
                        )}
                        {extraCount > 0 && (
                          <div className="w-9 h-9 rounded-full border-[2.5px] border-[#09090b] bg-white/[0.05] flex items-center justify-center shrink-0 z-0">
                            <span className="text-[10px] font-bold text-white/60">+{extraCount}</span>
                          </div>
                        )}
                      </div>
                      <span className={`text-[11px] whitespace-nowrap shrink-0 text-zinc-500`}>
                        {chat.last_time}
                      </span>
                    </div>

                    <p className="text-[13.5px] text-white/50 leading-relaxed mb-6 line-clamp-2 min-h-[40px]">
                      {chat.description || chat.last_message || 'No messages yet.'}
                    </p>

                    <button 
                      className="w-full py-3.5 rounded-xl bg-white/[0.04] border border-white/[0.05] hover:bg-white/[0.08] transition-all duration-300 text-white/80 hover:text-white text-sm font-semibold active:scale-[0.98]"
                    >
                      Open Chat
                    </button>
                  </div>
                )
              }

              return (
                <div key={chat.id} onClick={() => onSelectChat(chat.id, { name: chat.display_name, avatar: chat.display_avatar, isGroup: chat.is_group })}
                  className={`group flex items-center px-4 py-3 cursor-pointer transition-all duration-150 border-b border-white/[0.03] ${activeChatId === chat.id ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]'}`}>
                  
                  <div className="relative w-11 h-11 shrink-0 mr-3">
                    <div className="w-11 h-11 rounded-full bg-white/[0.05] flex items-center justify-center overflow-hidden">
                      {chat.display_avatar ? (
                        <img src={chat.display_avatar} alt="Avatar" className="w-full h-full object-cover rounded-full" />
                      ) : (
                        <div className="w-full h-full bg-white/[0.08] flex items-center justify-center text-zinc-400 font-bold uppercase text-base">
                          {chat.display_name?.[0] || '?'}
                        </div>
                      )}
                    </div>
                    {chat.other_profile && isUserOnline(chat.other_profile) && chat.other_profile?.availability_status !== false && (
                      <div className="absolute bottom-0 right-0 w-3 h-3 bg-white rounded-full border-2 border-black"></div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0 pr-2">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <h3 className={`${textSizeClass} font-medium truncate leading-tight flex items-center gap-1.5 ${activeChatId === chat.id ? 'text-white' : 'text-zinc-200'}`}>
                        {chat.display_name}
                        {chat.other_profile?.role === 'professional' && chat.other_profile?.availability_status === false && (
                          <span className="text-[9px] bg-white/[0.06] text-zinc-500 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Away</span>
                        )}
                      </h3>
                      <span className={`text-[11px] whitespace-nowrap shrink-0 ${chat.unread_count > 0 ? 'text-white font-bold' : 'text-zinc-600'}`}>
                        {chat.last_time}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-zinc-500 text-sm truncate leading-tight flex-1">{chat.last_message}</p>
                      {chat.unread_count > 0 && (
                         <div className="min-w-[19px] h-[19px] px-1.5 bg-[#10b981] rounded-full flex items-center justify-center shrink-0 shadow-[0_0_10px_rgba(16,185,129,0.3)]">
                          <span className="text-white text-[10px] font-bold">{chat.unread_count > 99 ? '99+' : chat.unread_count}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Floating Action Button for New Chat (Mobile) */}
      <div className={`absolute bottom-24 right-5 z-[90] md:hidden transition-all duration-300 ${isModalOpen ? 'opacity-0 scale-75 pointer-events-none' : 'opacity-100 scale-100'}`}>
        <button
          onClick={onOpenNewChat}
          className="w-14 h-14 bg-[#1e1e1e] rounded-full flex items-center justify-center shadow-[0_8px_32px_rgba(0,0,0,0.6)] border border-white/[0.08] hover:bg-[#2a2a2a] hover:scale-105 active:scale-95 transition-all text-white"
        >
          <Plus className="w-7 h-7" strokeWidth={2.5} />
        </button>
      </div>

    </div>
  )
}
