'use client'

import { useState, useEffect } from 'react'
import ChatSidebar from '@/components/ChatSidebar'
import ChatWindow from '@/components/ChatWindow'
import NewChatModal from '@/components/NewChatModal'
import InfoSidebar from '@/components/InfoSidebar'
import DiscoveryFeed from '@/components/DiscoveryFeed'
import StatusTab from '@/components/StatusTab'
import StatusViewer from '@/components/StatusViewer'
import { Status } from '@/hooks/useStatuses'
import { createClient } from '@/utils/supabase/client'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import SettingsModal from '@/components/SettingsModal'
import { Home, Compass, CircleDashed as StatusCircle, MessageSquarePlus, LogOut, Plus } from 'lucide-react'

import { useAuth } from '@/context/AuthContext'

export default function ChatPage() {
  useOnlineStatus() // Start heartbeat
  const { user, signOut } = useAuth()

  const [activeChatId, setActiveChatId] = useState<string | undefined>(undefined)
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false)
  const [isInfoSidebarOpen, setIsInfoSidebarOpen] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [sidebarType, setSidebarType] = useState<'profile' | 'contact' | 'group'>('profile')
  const [sidebarData, setSidebarData] = useState<any>(null)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<'chat' | 'feed' | 'status'>('chat')
  const [feedFilterUserId, setFeedFilterUserId] = useState<string | undefined>(undefined)
  const [activeStatuses, setActiveStatuses] = useState<Status[] | null>(null)

  const supabase = createClient()

  useEffect(() => {
    const fetchProfile = async () => {
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setCurrentUser(profile)
      }
    }
    fetchProfile()
  }, [user])

  // GLOBAL LISTENER: Mark ALL incoming messages as "delivered" instantly
  useEffect(() => {
    if (!currentUser) return

    const globalChannel = supabase.channel('global-delivery')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        async (payload: any) => {
          const newMsg = payload.new as any
          if (newMsg.sender_id !== currentUser.id && newMsg.status === 'sent') {
             try {
               await supabase.rpc('mark_messages_delivered', { cid: newMsg.chat_id })
             } catch (e) {
               console.error("Marking message delivered failed:", e)
             }
          }
        }
      )
      .subscribe()

    // Highly optimized batch execution instead of the loop that crashed the browser
    const markAllDelivered = async () => {
      try {
        await supabase.rpc('mark_all_messages_delivered')
      } catch (e) {
        // Silently fail if they haven't applied the SQL patch yet
      }
    }
    markAllDelivered()

    return () => { supabase.removeChannel(globalChannel) }
  }, [currentUser?.id, supabase])

  const handleSelectChat = (id: string) => {
    setActiveChatId(id)
    setActiveTab('chat')
  }

  const handleOpenProfile = () => {
    setSidebarType('profile')
    setSidebarData(currentUser)
    setIsInfoSidebarOpen(true)
  }

  const handleOpenChatInfo = async () => {
    if (!activeChatId || !currentUser) return

    const { data: chat } = await supabase
      .from('chats')
      .select('id, name, is_group, avatar_url')
      .eq('id', activeChatId)
      .single()

    if (!chat) return

    if (chat.is_group) {
      setSidebarType('group')
      setSidebarData(chat)
    } else {
      const { data: members } = await supabase
        .from('chat_members')
        .select('user_id')
        .eq('chat_id', activeChatId)
        .neq('user_id', currentUser.id)
        .limit(1)
        .single()

      if (members) {
        const { data: otherProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', members.user_id)
          .single()

        setSidebarType('contact')
        setSidebarData({ ...otherProfile, chat_id: activeChatId })
      }
    }
    setIsInfoSidebarOpen(true)
  }

  const handleStartDirectChat = async (otherUserId: string, post?: any) => {
    try {
      const { data: chatId, error } = await supabase.rpc('create_dm_chat', {
        other_user_id: otherUserId
      })

      if (error) throw error

      if (chatId) {
        // If coming from a post, send an automated "Forward/Reference" message
        if (post && user) {
          const contextMsg = `📢 Context: Regarding your achievement "${post.title || 'Tech Post'}"\n\n${post.content || ''}`
          
          await supabase.from('messages').insert({
            chat_id: chatId,
            sender_id: user.id,
            content: contextMsg,
            media_url: post.media_urls?.[0] || null,
            media_type: post.media_types?.[0] || 'image',
            status: 'sent'
          })
        }

        handleSelectChat(chatId)
      }
    } catch (err) {
      console.error("Error starting direct chat:", err)
      alert("Could not start conversation.")
    }
  }

  const handleViewUserPosts = (userId: string) => {
    setFeedFilterUserId(userId)
    setActiveTab('feed')
    setIsInfoSidebarOpen(false)
  }

  const handleLogout = async () => {
    if (user) {
      await supabase.from('profiles').update({ status: 'offline', last_seen: new Date().toISOString() }).eq('id', user.id)
    }
    await signOut()
    window.location.href = '/login'
  }

  return (
    <div className="flex w-full h-full relative overflow-hidden bg-[#111b21]">
      <div className={`${(activeChatId || activeTab !== 'chat') ? 'hidden md:flex' : 'flex'} w-full md:w-[30%] md:min-w-[320px] h-full transition-all`}>
        <ChatSidebar
          onSelectChat={handleSelectChat}
          activeChatId={activeChatId}
          onOpenNewChat={() => setIsNewChatModalOpen(true)}
          onOpenProfile={handleOpenProfile}
          onOpenSettings={() => setShowSettingsModal(true)}
          activeTab={activeTab}
          onTabChange={(tab) => {
            setActiveTab(tab)
            if (tab !== 'chat') setActiveChatId(undefined)
          }}
        />
      </div>

      <div className={`${(activeChatId || activeTab !== 'chat') ? 'flex' : 'hidden md:flex'} flex-1 h-full transition-all`}>
        {activeTab === 'feed' ? (
          <DiscoveryFeed 
            onStartChat={handleStartDirectChat} 
            filterUserId={feedFilterUserId}
            onClearFilter={() => setFeedFilterUserId(undefined)}
            onBack={() => {
              setActiveTab('chat')
              setFeedFilterUserId(undefined)
            }}
          />
        ) : activeTab === 'status' ? (
          <StatusTab 
            onStatusClick={(statuses: Status[]) => setActiveStatuses(statuses)} 
            onBack={() => setActiveTab('chat')}
          />
        ) : (
          <ChatWindow
            chatId={activeChatId}
            onOpenInfo={handleOpenChatInfo}
            onBack={() => setActiveChatId(undefined)}
          />
        )}
      </div>

      {/* Persistent Mobile Floating Navigation */}
      {!activeChatId && (
        <div className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center justify-between px-2 h-[56px] bg-[#1a2227]/80 backdrop-blur-2xl border border-white/10 rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.5)] w-[85%] max-w-[320px]">
          <button 
            onClick={() => setActiveTab('chat')}
            className={`relative flex flex-col items-center justify-center w-12 h-12 transition-all duration-300 ${activeTab === 'chat' ? 'text-blue-400' : 'text-[#8696a0]'}`}
          >
            {activeTab === 'chat' && (
              <>
                <div className="absolute top-[-8px] w-6 h-1 bg-blue-500 rounded-full shadow-[0_0_10px_#3b82f6]"></div>
                <div className="absolute inset-0 bg-blue-500/10 rounded-full scale-75"></div>
              </>
            )}
            <Home className="w-5 h-5 z-10" />
          </button>
          
          <button 
            onClick={() => setIsNewChatModalOpen(true)}
            className="flex flex-col items-center justify-center w-12 h-12 text-[#8696a0] hover:text-[#00a884] transition-colors"
          >
            <Plus className="w-6 h-6" />
          </button>

          <button 
            onClick={() => setActiveTab('feed')}
            className={`relative flex flex-col items-center justify-center w-12 h-12 transition-all duration-300 ${activeTab === 'feed' ? 'text-blue-400' : 'text-[#8696a0]'}`}
          >
            {activeTab === 'feed' && (
              <>
                <div className="absolute top-[-8px] w-6 h-1 bg-blue-500 rounded-full shadow-[0_0_10px_#3b82f6]"></div>
                <div className="absolute inset-0 bg-blue-500/10 rounded-full scale-75"></div>
              </>
            )}
            <Compass className="w-5 h-5 z-10" />
          </button>

          <button 
            onClick={() => setActiveTab('status')}
            className={`relative flex flex-col items-center justify-center w-12 h-12 transition-all duration-300 ${activeTab === 'status' ? 'text-blue-400' : 'text-[#8696a0]'}`}
          >
            {activeTab === 'status' && (
              <>
                <div className="absolute top-[-8px] w-6 h-1 bg-blue-500 rounded-full shadow-[0_0_10px_#3b82f6]"></div>
                <div className="absolute inset-0 bg-blue-500/10 rounded-full scale-75"></div>
              </>
            )}
            <StatusCircle className="w-5 h-5 z-10" />
          </button>
        </div>
      )}

      {activeStatuses && (
        <StatusViewer statuses={activeStatuses} onClose={() => setActiveStatuses(null)} />
      )}

      <InfoSidebar
        isOpen={isInfoSidebarOpen}
        onClose={() => setIsInfoSidebarOpen(false)}
        type={sidebarType}
        data={sidebarData}
        onViewPosts={handleViewUserPosts}
      />

      <NewChatModal
        isOpen={isNewChatModalOpen}
        onClose={() => setIsNewChatModalOpen(false)}
        onChatCreated={(id) => {
          setActiveChatId(id)
          setIsNewChatModalOpen(false)
        }}
      />

      {showSettingsModal && (
        <SettingsModal type="sidebar" onClose={() => setShowSettingsModal(false)} />
      )}
    </div>
  )
}
