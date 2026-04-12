'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Search, UserCircle, Home, Plus, Compass, CircleDashed, Trophy, Users, Globe } from 'lucide-react'
import Image from 'next/image'
import { isUserOnline } from '@/hooks/useOnlineStatus'

import SettingsModal from './SettingsModal'
import { useSettings } from '@/hooks/useSettings'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { Status } from '@/hooks/useStatuses'
import { useAuth } from '@/context/AuthContext'
import GroupDiscovery from './GroupDiscovery'

interface ChatSidebarProps {
  onSelectChat: (chatId: string) => void
  activeChatId?: string
  onOpenNewChat: () => void
  onOpenProfile: () => void
  onOpenSettings: () => void
  activeTab: 'chat' | 'feed' | 'status' | 'challenges' | 'groups'
  onTabChange: (tab: 'chat' | 'feed' | 'status' | 'challenges' | 'groups') => void
  isModalOpen?: boolean
}

export default function ChatSidebar({ onSelectChat, activeChatId, onOpenNewChat, onOpenProfile, onOpenSettings, activeTab, onTabChange, isModalOpen }: ChatSidebarProps) {
  usePushNotifications()
  const [chats, setChats] = useState<any[] | null>(null)
  const [groupSubTab, setGroupSubTab] = useState<'my' | 'community'>('my')
  const [loading, setLoading] = useState(false) // Start as false to prevent immediate skeleton flash
  const [search, setSearch] = useState('')
  const { user, signOut, loading: authLoading, profile: authProfile } = useAuth()
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [imageError, setImageError] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [isMounted, setIsMounted] = useState(false)
  const supabase = createClient()
  
  const { settings, isLoaded } = useSettings()

  const fetchUserAndChats = useCallback(async (showSkeleton = false) => {
    if (!user) {
      if (!authLoading) {
        setChats([])
        setLoading(false)
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
        setChats([])
        return
      }
      
      const chatIds = memberOf.map((m: any) => m.chat_id).filter(Boolean)
      if (chatIds.length === 0) { 
        setChats([])
        return 
      }

      const { data: chatData, error: chatError } = await supabase
        .from('chats')
        .select('id, name, is_group, avatar_url')
        .in('id', chatIds)

      if (chatError || !chatData) {
        setChats([])
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
          .select('id, name, email, avatar_url, status, last_seen, availability_status, role')
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
          display_email: chat.is_group ? '' : (otherProfile?.email || ''),
          display_avatar: chat.is_group ? chat.avatar_url : otherProfile?.avatar_url,
          other_profile: otherProfile,
          unread_count: unreadCount,
          last_message: lastMsgContent,
          last_time: lastTime || 'Now',
          last_msg_time: lastMsgTime,
        }
      })

      formattedChats.sort((a: any, b: any) => (b.last_msg_time || '').localeCompare(a.last_msg_time || ''))
      setChats(formattedChats)
      
      if (user?.id) {
        localStorage.setItem(`chats_${user.id}`, JSON.stringify(formattedChats))
        // Background: mark all messages as delivered since we just loaded the sidebar
        // Avoid .catch() on the builder itself
        const markDelivered = async () => {
          try {
            await supabase.rpc('mark_all_messages_delivered')
          } catch (e) {
            console.warn('mark_all_messages_delivered error', e)
          }
        }
        markDelivered()
      }
    } catch (err) {
      console.error('Fetch chats error:', err)
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
    if (user && chats === null) {
      try {
        const cached = localStorage.getItem(`chats_${user.id}`)
        if (cached) {
          const parsed = JSON.parse(cached)
          if (Array.isArray(parsed) && parsed.length > 0) {
            setChats(parsed)
            setLoading(false)
          }
        }
      } catch (e) {
        console.error('Cache load error:', e)
      }
    }
  }, [user])

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

    // Unique channel per user to prevent cross-tab interference
    const channelName = `sidebar-sync:${user.id}`
    const channel = supabase.channel(channelName)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload: any) => {
         debouncedFetch()
         // Mark as delivered via RPC
          if (payload.new && payload.new.sender_id !== userIdRef.current && payload.new.status === 'sent') {
            const chatId = payload.new.chat_id
            
            // If already scheduled for this chat, don't schedule again
            if (pendingBatchDelivered.current.has(chatId)) return

            const markWithRetry = async (retries = 0) => {
              try {
                const { error } = await supabase.rpc('mark_messages_delivered', { cid: chatId })
                if (error && (error.message?.includes('Lock') || error.details?.includes('Lock')) && retries < 2) {
                  throw error
                }
              } catch (err) {
                if (retries < 2) {
                  setTimeout(() => markWithRetry(retries + 1), 600)
                } else {
                  console.warn('mark_messages_delivered failed after retries:', err)
                }
              } finally {
                pendingBatchDelivered.current.delete(chatId)
              }
            }

            // Batch window: 1.2 seconds for sidebar updates
            const timeout = setTimeout(() => markWithRetry(), 1200)
            pendingBatchDelivered.current.set(chatId, timeout)
          }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, () => debouncedFetch())
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, () => debouncedFetch())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, (payload: any) => {
         // Dynamically patch profile data in existing chats without re-fetching
         setChats(prevChats => {
           if (!prevChats) return prevChats
           return prevChats.map(chat => {
             if (chat.other_profile && chat.other_profile.id === payload.new.id) {
               return { ...chat, other_profile: { ...chat.other_profile, ...payload.new } }
             }
             return chat
           })
         })
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_members' }, () => debouncedFetch())
      .subscribe((status: string) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
           console.warn(`Sidebar Realtime ${status}, triggering fallback fetch...`)
           debouncedFetch()
        }
      })

    // Clock only - don't clone chats array every second
    const clockInterval = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    // Periodic synchronization (fallback for silent WebSocket drop or lock recovery)
    const syncInterval = setInterval(() => {
      fetchUserAndChats(false) // Background sync (no skeletons)
    }, 45000) // Slightly longer window as we have multiple realtime triggers now

    // Add storage event listener to refresh nicknames if changed in other tabs/components
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key && e.key.startsWith('nickname_')) {
        // Refresh local state to reflect new nickname
        fetchUserAndChats(false)
      }
    }
    window.addEventListener('storage', handleStorageChange)

    return () => { 
      supabase.removeChannel(channel)
      window.removeEventListener('storage', handleStorageChange)
      clearInterval(clockInterval)
      clearInterval(syncInterval)
      if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current)
      if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current)
    }
  }, [user?.id, authLoading])

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
                onClick={() => onTabChange('status')}
                className={`p-2 rounded-full transition-all duration-300 ${activeTab === 'status' ? 'bg-white text-black' : 'text-zinc-500 hover:text-white hover:bg-white/10'}`}
                title="Statuses"
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
        ) : loading || authLoading ? (
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
          filteredChats.map((chat) => (
            <div key={chat.id} onClick={() => onSelectChat(chat.id)}
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
          ))
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
