'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Search, MoreVertical, MessageSquarePlus, UserCircle, LogOut, CircleDashed as StatusCircle } from 'lucide-react'
import Image from 'next/image'
import { isUserOnline } from '@/hooks/useOnlineStatus'

import SettingsModal from './SettingsModal'
import { useSettings } from '@/hooks/useSettings'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import StatusTab from './StatusTab'
import StatusViewer from './StatusViewer'
import { Status } from '@/hooks/useStatuses'

interface ChatSidebarProps {
  onSelectChat: (chatId: string) => void
  activeChatId?: string
  onOpenNewChat: () => void
  onOpenProfile: () => void
}

import { useAuth } from '@/context/AuthContext'

export default function ChatSidebar({ onSelectChat, activeChatId, onOpenNewChat, onOpenProfile }: ChatSidebarProps) {
  usePushNotifications()
  const [chats, setChats] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const { user, signOut } = useAuth()
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [currentView, setCurrentView] = useState<'chats' | 'status'>('chats')
  const [activeStatuses, setActiveStatuses] = useState<Status[] | null>(null)
  const supabase = createClient()
  
  const { settings, isLoaded } = useSettings()

  const fetchUserAndChats = async () => {
    try {
      if (!user) {
        return
      }

      // Step 1: Get all chat IDs the user belongs to
      const { data: memberOf, error: memberError } = await supabase
        .from('chat_members')
        .select('chat_id')
        .eq('user_id', user.id)

      if (memberError || !memberOf) {
        return
      }
      
      const chatIds = memberOf.map(m => m.chat_id).filter(Boolean)
      if (chatIds.length === 0) { 
        setChats([])
        return 
      }

      // Step 2: Get chat details
      const { data: chatData, error: chatError } = await supabase
        .from('chats')
        .select('id, name, is_group, avatar_url')
        .in('id', chatIds)

      if (chatError || !chatData) {
        return
      }

      // Step 3: Get all members of these chats with their profiles
      const { data: allMembers } = await supabase
        .from('chat_members')
        .select('chat_id, user_id')
        .in('chat_id', chatIds)

      // Step 4: Get all unique user IDs and fetch their profiles
      const allUserIds = [...new Set((allMembers || []).map(m => m.user_id))].filter(Boolean)
      let allProfiles = []
      
      if (allUserIds.length > 0) {
        const { data } = await supabase
          .from('profiles')
          .select('id, name, email, avatar_url, status, last_seen, availability_status, role')
          .in('id', allUserIds)
        if (data) allProfiles = data
      }

      const profileMap = new Map(allProfiles.map(p => [p.id, p]))

      // Step 5: Get recent messages for each chat
      const { data: recentMessages } = await supabase
        .from('messages')
        .select('chat_id, content, created_at, sender_id, status')
        .in('chat_id', chatIds)
        .order('created_at', { ascending: false })

      // Group messages by chat
      const messagesByChatId = new Map<string, any[]>()
      for (const msg of (recentMessages || [])) {
        if (!messagesByChatId.has(msg.chat_id)) messagesByChatId.set(msg.chat_id, [])
        messagesByChatId.get(msg.chat_id)!.push(msg)
      }

      // Step 6: Build the final chat list
      const formattedChats = chatData.map((chat) => {
        // Find the OTHER person in 1-on-1 chats
        const chatMembers = (allMembers || []).filter(m => m.chat_id === chat.id)
        const otherMemberId = chatMembers.find(m => m.user_id !== user.id)?.user_id
        const otherProfile = otherMemberId ? profileMap.get(otherMemberId) : null

        // Messages
        const msgs = messagesByChatId.get(chat.id) || []
        const lastMsg = msgs[0]

        // Unread count
        const unreadCount = msgs.filter(
          m => m.sender_id !== user.id && m.status !== 'seen'
        ).length

        // Format time
        let lastTime = ''
        if (lastMsg?.created_at) {
          const date = new Date(lastMsg.created_at)
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
          display_name: chat.is_group ? (chat.name || 'Group') : (otherProfile?.name || 'Unknown User'),
          display_email: chat.is_group ? '' : (otherProfile?.email || ''),
          display_avatar: chat.is_group ? chat.avatar_url : otherProfile?.avatar_url,
          other_profile: otherProfile,
          unread_count: unreadCount,
          last_message: lastMsg?.content || 'No messages yet',
          last_time: lastTime || 'Now',
          last_msg_time: lastMsg?.created_at || '',
        }
      })

      // Sort by most recent message
      formattedChats.sort((a, b) => (b.last_msg_time || '').localeCompare(a.last_msg_time || ''))
      setChats(formattedChats)
    } catch (err) {
      console.error('Fetch chats error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUserAndChats()

    const channel = supabase.channel('sidebar-sync')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, async (payload) => {
         fetchUserAndChats()
         // Acknowledge delivery if the message is for the current user and it is 'sent'
         if (payload.new && payload.new.sender_id !== user?.id && payload.new.status === 'sent') {
           try {
             // Mark message as delivered
             await supabase.from('messages').update({ status: 'delivered' }).eq('id', payload.new.id)
           } catch (err) {}
         }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, () => fetchUserAndChats())
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, () => fetchUserAndChats())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => fetchUserAndChats())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_members' }, () => fetchUserAndChats())
      .subscribe()

    const interval = setInterval(() => {
      setChats(prev => [...prev]) // Force re-render to evaluate dynamic isUserOnline
    }, 10000)

    return () => { 
      supabase.removeChannel(channel)
      clearInterval(interval)
    }
  }, [user, supabase])

  const handleLogout = async () => {
    if (user) {
      await supabase.from('profiles').update({ status: 'offline', last_seen: new Date().toISOString() }).eq('id', user.id)
    }
    await signOut()
    window.location.href = '/login'
  }

  const filteredChats = chats.filter(c =>
    (c.display_name?.toLowerCase() || '').includes(search.toLowerCase()) ||
    (c.display_email?.toLowerCase() || '').includes(search.toLowerCase())
  )

  const isImg = isLoaded && (settings.sidebarBg.startsWith('http') || settings.sidebarBg.startsWith('/'))
  const bgStyle = isLoaded ? (isImg ? { backgroundImage: `url('${settings.sidebarBg}')`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundColor: '#111b21' } : { backgroundColor: settings.sidebarBg }) : { backgroundColor: '#111b21' }

  const textSizeClass = settings.textSize === 'small' ? 'text-sm' : settings.textSize === 'large' ? 'text-lg' : 'text-base'

  return (
    <div className="w-full flex flex-col border-r border-[#222e35] h-full shrink-0 relative transition-all" style={bgStyle}>
      {/* Header */}
      <div className="h-[60px] bg-[#202c33]/95 backdrop-blur-sm flex items-center justify-between px-4 sticky top-0 z-10">
        <div className="flex items-center gap-3 cursor-pointer" onClick={onOpenProfile}>
          {user?.user_metadata?.avatar_url ? (
            <Image src={user.user_metadata.avatar_url} alt="Profile" width={40} height={40} sizes="40px"
              className="rounded-full hover:opacity-80 transition-opacity border border-[#222e35]" />
          ) : (
            <UserCircle className="w-10 h-10 text-[#8696a0] cursor-pointer" />
          )}
        </div>
        <div className="flex items-center gap-2 text-[#aebac1]">
          <button 
            onClick={() => setCurrentView(currentView === 'chats' ? 'status' : 'chats')} 
            title="Status Updates" 
            className={`p-2 hover:bg-[#374248] rounded-full transition-colors ${currentView === 'status' ? 'text-[#00a884] bg-[#2a3942]' : ''}`}
          >
            <StatusCircle className="w-6 h-6" />
          </button>
          <button onClick={onOpenNewChat} title="New Chat" className="p-2 hover:bg-[#374248] rounded-full transition-colors"><MessageSquarePlus className="w-6 h-6" /></button>
          <button onClick={() => setShowSettingsModal(true)} title="More Settings" className="p-2 hover:bg-[#374248] rounded-full transition-colors active:bg-[#435158]"><MoreVertical className="w-6 h-6" /></button>
          <button onClick={handleLogout} title="Logout" className="p-2 hover:bg-[#374248] rounded-full transition-colors text-[#ef4444]"><LogOut className="w-6 h-6" /></button>
        </div>
      </div>

      {currentView === 'status' ? (
        <StatusTab onStatusClick={(statuses) => setActiveStatuses(statuses)} />
      ) : (
        <>
          <div className="p-3 bg-[#111b21]/80 backdrop-blur-sm border-b border-[#222e35]">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#8696a0]"><Search className="h-5 w-5" /></div>
              <input type="text" placeholder="Search or start new chat" className="block w-full pl-10 pr-3 py-2 bg-[#202c33] border-none text-[#e9edef] rounded-xl focus:ring-0 text-sm placeholder-[#8696a0]" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar bg-black/40 backdrop-blur-sm">
            {loading ? (
              <div className="flex flex-col">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="flex items-center px-4 py-3 border-b border-[#222e35]/50 animate-pulse">
                    <div className="w-12 h-12 rounded-full bg-[#202c33] shrink-0 mr-3 animate-skeleton"></div>
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="h-4 w-1/3 bg-[#202c33] rounded mb-2 animate-skeleton"></div>
                      <div className="h-3 w-3/4 bg-[#202c33] rounded animate-skeleton"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredChats.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                <p className="text-[#8696a0] text-sm italic bg-black/50 px-4 py-2 rounded-lg">{search ? 'No conversations matching your search.' : 'No chats yet. Click + to start.'}</p>
              </div>
            ) : (
              filteredChats.map((chat) => (
                <div key={chat.id} onClick={() => onSelectChat(chat.id)}
                  className={`group flex items-center px-4 py-3 cursor-pointer transition-all border-b border-[#222e35]/50 ${activeChatId === chat.id ? 'bg-[#2a3942]/90 backdrop-blur-sm' : 'hover:bg-[#202c33]/80'}`}>
                  
                  <div className="relative w-12 h-12 shrink-0 mr-3">
                    <div className="w-12 h-12 rounded-full bg-[#374248] flex items-center justify-center overflow-hidden group-hover:scale-105 transition-transform">
                      {chat.display_avatar ? (
                        <Image src={chat.display_avatar} alt="Avatar" width={48} height={48} sizes="48px" className="object-cover rounded-full" />
                      ) : (
                        <div className="w-full h-full bg-[#00a884] flex items-center justify-center text-white font-bold uppercase text-lg">
                          {chat.display_name?.[0] || '?'}
                        </div>
                      )}
                    </div>
                    {chat.other_profile && isUserOnline(chat.other_profile) && chat.other_profile?.availability_status !== false && (
                      <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-[#25d366] rounded-full border-2 border-[#111b21] shadow-[0_0_6px_rgba(37,211,102,0.6)]"></div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0 pr-2">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <h3 className={`${textSizeClass} font-medium truncate leading-tight flex items-center gap-1.5 ${activeChatId === chat.id ? 'text-[#00a884]' : 'text-[#e9edef]'}`}>
                        {chat.display_name}
                        {chat.other_profile?.role === 'professional' && chat.other_profile?.availability_status === false && (
                          <span className="text-[10px] bg-[#374248] text-[#8696a0] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wider">Unavailable</span>
                        )}
                      </h3>
                      <span className={`text-xs whitespace-nowrap shrink-0 ${chat.unread_count > 0 ? 'text-[#25d366]' : 'text-[#e9edef]/80 drop-shadow-md'}`}>
                        {chat.last_time}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[#e9edef]/70 drop-shadow-md text-sm truncate leading-tight flex-1">{chat.last_message}</p>
                      {chat.unread_count > 0 && (
                        <div className="min-w-[20px] h-5 px-1.5 bg-[#25d366] rounded-full flex items-center justify-center shrink-0 shadow-[0_0_8px_rgba(37,211,102,0.4)]">
                          <span className="text-[#111b21] text-[11px] font-bold">{chat.unread_count > 99 ? '99+' : chat.unread_count}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {activeStatuses && <StatusViewer statuses={activeStatuses} onClose={() => setActiveStatuses(null)} />}

      {showSettingsModal && (
        <SettingsModal type="sidebar" onClose={() => setShowSettingsModal(false)} />
      )}
    </div>
  )
}
