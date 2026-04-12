'use client'

import { useState, useEffect } from 'react'
import ChatSidebar from '@/components/ChatSidebar'
import ChatWindow from '@/components/ChatWindow'
import NewChatModal from '@/components/NewChatModal'
import NewGroupModal from '@/components/NewGroupModal'
import InfoSidebar from '@/components/InfoSidebar'
import DiscoveryFeed from '@/components/DiscoveryFeed'
import StatusTab from '@/components/StatusTab'
import StatusViewer from '@/components/StatusViewer'
import ChallengesRoom from '@/components/ChallengesRoom'
import { Status } from '@/hooks/useStatuses'
import { createClient } from '@/utils/supabase/client'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import SettingsModal from '@/components/SettingsModal'
import { Home, MessageCircle, CircleDashed as StatusCircle, Plus, Trophy, Users } from 'lucide-react'

import { useAuth } from '@/context/AuthContext'

export default function ChatPage() {
  useOnlineStatus()
  const { user, signOut } = useAuth()

  const [activeChatId, setActiveChatId] = useState<string | undefined>(undefined)
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false)
  const [isNewGroupModalOpen, setIsNewGroupModalOpen] = useState(false)
  const [isInfoSidebarOpen, setIsInfoSidebarOpen] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [sidebarType, setSidebarType] = useState<'profile' | 'contact' | 'group'>('profile')
  const [sidebarData, setSidebarData] = useState<any>(null)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<'chat' | 'feed' | 'status' | 'challenges' | 'groups'>('feed')
  const [feedFilterUserId, setFeedFilterUserId] = useState<string | undefined>(undefined)
  const [activeStatuses, setActiveStatuses] = useState<Status[] | null>(null)
  const [isNavVisible, setIsNavVisible] = useState(true)

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

  useEffect(() => {
    if (!currentUser) return

    // Mark all existing undelivered messages as delivered on mount
    const markAllDelivered = async () => {
      try {
        await supabase.rpc('mark_all_messages_delivered')
      } catch (e) {}
    }
    markAllDelivered()
    // Note: Real-time delivery marking is handled by ChatSidebar to avoid duplicate listeners
  }, [currentUser?.id])

  const handleSelectChat = (id: string) => {
    setActiveChatId(id)
    // Only switch to 'chat' tab if we are not already in 'groups' tab
    if (activeTab !== 'groups') {
      setActiveTab('chat')
    }
  }

  const handleOpenProfile = () => {
    setSidebarType('profile')
    setSidebarData(currentUser)
    setIsInfoSidebarOpen(true)
  }

  const handleOpenChatInfo = async (existingProfile?: any) => {
    if (!activeChatId || !currentUser) return

    if (existingProfile) {
      setSidebarType('contact')
      setSidebarData({ ...existingProfile, chat_id: activeChatId })
      setIsInfoSidebarOpen(true)
      return
    }

    try {
      const { data: chat, error: chatError } = await supabase
        .from('chats')
        .select('id, name, is_group, avatar_url')
        .eq('id', activeChatId)
        .single()

      if (chatError) {
        console.error("Failed to fetch chat:", chatError)
      }

      if (!chat) {
         // Fallback if chat fetching fails for some RLS reason: just open the sidebar with the current activeChatId if we can grab member info.
         const { data: members } = await supabase.from('chat_members').select('user_id').eq('chat_id', activeChatId).neq('user_id', currentUser.id).limit(1).single()
         if (members) {
            const { data: otherProfile } = await supabase.from('profiles').select('*').eq('id', members.user_id).single()
            setSidebarType('contact')
            setSidebarData({ ...otherProfile, chat_id: activeChatId })
            setIsInfoSidebarOpen(true)
         }
         return
      }

      if (chat.is_group) {
        setSidebarType('group')
        setSidebarData(chat)
      } else {
        const { data: members, error: memErr } = await supabase
          .from('chat_members')
          .select('user_id')
          .eq('chat_id', activeChatId)
          .neq('user_id', currentUser.id)
          .limit(1)
          .single()

        if (memErr) console.error("Failed to fetch members:", memErr)

        if (members) {
          const { data: otherProfile, error: profErr } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', members.user_id)
            .single()

          if (profErr) console.error("Failed to fetch profile:", profErr)

          setSidebarType('contact')
          setSidebarData({ ...otherProfile, chat_id: activeChatId })
        }
      }
      setIsInfoSidebarOpen(true)
    } catch (err) {
      console.error("Exception in handleOpenChatInfo:", err)
    }
  }

  const handleInspectUser = async (userId: string) => {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
        
      if (profile && !error) {
        setSidebarType('contact')
        setSidebarData(profile)
        setIsInfoSidebarOpen(true)
        setIsNewChatModalOpen(false)
      }
    } catch (err) {
      console.error("Exception in handleInspectUser:", err)
    }
  }

  const handleStartDirectChat = async (otherUserId: string, post?: any) => {
    try {
      const { data: chatId, error } = await supabase.rpc('create_dm_chat', {
        other_user_id: otherUserId
      })

      if (error) throw error

      if (chatId) {
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
    <div className="flex w-full h-[100dvh] relative overflow-hidden bg-black">
      <div className={`${(activeChatId || (activeTab !== 'chat' && activeTab !== 'groups')) ? 'hidden md:flex' : 'flex'} w-full md:w-[30%] md:min-w-[320px] h-full transition-all`}>
        <ChatSidebar
          onSelectChat={handleSelectChat}
          activeChatId={activeChatId}
          onOpenNewChat={() => setIsNewChatModalOpen(true)}
          onOpenProfile={handleOpenProfile}
          onOpenSettings={() => setShowSettingsModal(true)}
          activeTab={activeTab}
          isModalOpen={isNewChatModalOpen}
          onTabChange={(tab) => {
            setActiveTab(tab)
            if (tab !== 'chat') setActiveChatId(undefined)
          }}
        />
      </div>

      <div className={`${(activeChatId || activeTab !== 'chat') ? 'flex' : 'hidden md:flex'} flex-1 h-full min-w-0 overflow-hidden transition-all`}>
        {activeTab === 'feed' ? (
          <DiscoveryFeed 
            onStartChat={handleStartDirectChat} 
            filterUserId={feedFilterUserId}
            onClearFilter={() => setFeedFilterUserId(undefined)}
            onBack={() => {
              setActiveTab('chat')
              setFeedFilterUserId(undefined)
              setIsNavVisible(true) // Ensure nav is visible when returning
            }}
            onScrollToggle={(visible) => setIsNavVisible(visible)}
          />
        ) : activeTab === 'status' ? (
          <StatusTab 
            onStatusClick={(statuses: Status[]) => setActiveStatuses(statuses)} 
            onBack={() => setActiveTab('chat')}
          />
        ) : activeTab === 'challenges' ? (
          <ChallengesRoom />
        ) : (
          <ChatWindow
            chatId={activeChatId}
            onOpenInfo={handleOpenChatInfo}
            onBack={() => setActiveChatId(undefined)}
          />
        )}
      </div>

      {/* Mobile Floating Nav — The Nocturnal glass dock */}
      <div className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-[100] items-center justify-between px-1 h-[58px] glass-dock rounded-full shadow-[0_16px_40px_rgba(0,0,0,0.7),0_0_0_1px_rgba(188,157,255,0.06)] w-[90%] max-w-[340px] transition-all duration-500 ease-in-out ${(!activeChatId && !isInfoSidebarOpen) ? 'flex md:hidden' : 'hidden'} ${isNavVisible ? 'translate-y-0 opacity-100' : 'translate-y-[150%] opacity-0 pointer-events-none'}`}>
          <button 
            onClick={() => {
              setActiveTab('chat')
              setIsNewChatModalOpen(false)
              setIsNewGroupModalOpen(false)
            }}
            className={`relative flex items-center justify-center w-12 h-12 transition-all duration-200 rounded-2xl ${
              activeTab === 'chat' ? 'text-[#bc9dff]' : 'text-[#767575] hover:text-[#adaaaa]'
            }`}
          >
            {activeTab === 'chat' && <div className="absolute bottom-[6px] w-1 h-1 rounded-full bg-[#bc9dff]" />}
            <MessageCircle className="w-[20px] h-[20px]" />
          </button>

          <button 
            onClick={() => {
              setActiveTab('groups')
              setIsNewChatModalOpen(false)
              setIsNewGroupModalOpen(false)
            }}
            className={`relative flex items-center justify-center w-12 h-12 transition-all duration-200 rounded-2xl ${
              activeTab === 'groups' ? 'text-[#bc9dff]' : 'text-[#767575] hover:text-[#adaaaa]'
            }`}
          >
            {activeTab === 'groups' && <div className="absolute bottom-[6px] w-1 h-1 rounded-full bg-[#bc9dff]" />}
            <Users className="w-[20px] h-[20px]" />
          </button>

          <button 
            onClick={() => {
              setActiveTab('feed')
              setIsNewChatModalOpen(false)
              setIsNewGroupModalOpen(false)
            }}
            className={`relative flex items-center justify-center w-12 h-12 transition-all duration-200 rounded-2xl ${
              activeTab === 'feed' ? 'text-[#bc9dff]' : 'text-[#767575] hover:text-[#adaaaa]'
            }`}
          >
            {activeTab === 'feed' && <div className="absolute bottom-[6px] w-1 h-1 rounded-full bg-[#bc9dff]" />}
            <Home className="w-[20px] h-[20px]" />
          </button>

          <button 
            onClick={() => {
              setActiveTab('status')
              setIsNewChatModalOpen(false)
              setIsNewGroupModalOpen(false)
            }}
            className={`relative flex items-center justify-center w-12 h-12 transition-all duration-200 rounded-2xl ${
              activeTab === 'status' ? 'text-[#bc9dff]' : 'text-[#767575] hover:text-[#adaaaa]'
            }`}
          >
            {activeTab === 'status' && <div className="absolute bottom-[6px] w-1 h-1 rounded-full bg-[#bc9dff]" />}
            <StatusCircle className="w-[20px] h-[20px]" />
          </button>

          <button 
            onClick={() => {
              setActiveTab('challenges')
              setIsNewChatModalOpen(false)
              setIsNewGroupModalOpen(false)
            }}
            className={`relative flex items-center justify-center w-12 h-12 transition-all duration-200 rounded-2xl ${
              activeTab === 'challenges' ? 'text-[#bc9dff]' : 'text-[#767575] hover:text-[#adaaaa]'
            }`}
          >
            {activeTab === 'challenges' && <div className="absolute bottom-[6px] w-1 h-1 rounded-full bg-[#bc9dff]" />}
            <Trophy className="w-[20px] h-[20px]" />
          </button>
        </div>

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
        onOpenNewGroup={() => setIsNewGroupModalOpen(true)}
        onInspectProfile={handleInspectUser}
      />

      <NewGroupModal
        isOpen={isNewGroupModalOpen}
        onClose={() => setIsNewGroupModalOpen(false)}
        onGroupCreated={(id) => {
          setActiveChatId(id)
          setIsNewGroupModalOpen(false)
        }}
      />

      {showSettingsModal && (
        <SettingsModal type="sidebar" onClose={() => setShowSettingsModal(false)} />
      )}
    </div>
  )
}
