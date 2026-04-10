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
import { Home, Compass, CircleDashed as StatusCircle, Plus, Trophy, Users } from 'lucide-react'

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
  const [activeTab, setActiveTab] = useState<'chat' | 'feed' | 'status' | 'challenges' | 'groups'>('chat')
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
    <div className="flex w-full h-full relative overflow-hidden bg-black">
      <div className={`${(activeChatId || (activeTab !== 'chat' && activeTab !== 'groups')) ? 'hidden md:flex' : 'flex'} w-full md:w-[30%] md:min-w-[320px] h-full transition-all`}>
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

      <div className={`${(activeChatId || activeTab !== 'chat') ? 'flex' : 'hidden md:flex'} flex-1 h-full min-w-0 overflow-hidden transition-all`}>
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

      {/* Mobile Floating Nav */}
      <div className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-[100] items-center justify-between px-1 h-[52px] bg-[#0a0a0a]/90 backdrop-blur-2xl border border-white/[0.08] rounded-full shadow-[0_16px_40px_rgba(0,0,0,0.6)] w-[90%] max-w-[320px] ${(!activeChatId && !isInfoSidebarOpen) ? 'flex md:hidden' : 'hidden'}`}>
          <button 
            onClick={() => setActiveTab('chat')}
            className={`relative flex items-center justify-center w-11 h-11 transition-all duration-200 ${activeTab === 'chat' ? 'text-white' : 'text-zinc-600'}`}
          >
            {activeTab === 'chat' && <div className="absolute top-[-6px] w-5 h-0.5 bg-white rounded-full" />}
            <Home className="w-[18px] h-[18px]" />
          </button>
          
          <button 
            onClick={() => setIsNewChatModalOpen(true)}
            className="flex items-center justify-center w-11 h-11 text-zinc-600 hover:text-white transition-colors"
          >
            <Plus className="w-5 h-5" />
          </button>

          <button 
            onClick={() => setActiveTab('groups')}
            className={`relative flex items-center justify-center w-11 h-11 transition-all duration-200 ${activeTab === 'groups' ? 'text-white' : 'text-zinc-600'}`}
          >
            {activeTab === 'groups' && <div className="absolute top-[-6px] w-5 h-0.5 bg-white rounded-full" />}
            <Users className="w-[18px] h-[18px]" />
          </button>

          <button 
            onClick={() => setActiveTab('feed')}
            className={`relative flex items-center justify-center w-11 h-11 transition-all duration-200 ${activeTab === 'feed' ? 'text-white' : 'text-zinc-600'}`}
          >
            {activeTab === 'feed' && <div className="absolute top-[-6px] w-5 h-0.5 bg-white rounded-full" />}
            <Compass className="w-[18px] h-[18px]" />
          </button>

          <button 
            onClick={() => setActiveTab('status')}
            className={`relative flex items-center justify-center w-11 h-11 transition-all duration-200 ${activeTab === 'status' ? 'text-white' : 'text-zinc-600'}`}
          >
            {activeTab === 'status' && <div className="absolute top-[-6px] w-5 h-0.5 bg-white rounded-full" />}
            <StatusCircle className="w-[18px] h-[18px]" />
          </button>

          <button 
            onClick={() => setActiveTab('challenges')}
            className={`relative flex items-center justify-center w-11 h-11 transition-all duration-200 ${activeTab === 'challenges' ? 'text-white' : 'text-zinc-600'}`}
          >
            {activeTab === 'challenges' && <div className="absolute top-[-6px] w-5 h-0.5 bg-white rounded-full" />}
            <Trophy className="w-[18px] h-[18px]" />
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
