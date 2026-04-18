'use client'

import { useState, useEffect, useRef } from 'react'
import ChatSidebar from '@/components/ChatSidebar'
import ChatWindow from '@/components/ChatWindow'
import NewChatModal from '@/components/NewChatModal'
import NewGroupModal from '@/components/NewGroupModal'
import InfoSidebar from '@/components/InfoSidebar'
import DiscoveryFeed from '@/components/DiscoveryFeed'
import StatusTab from '@/components/StatusTab'
import StatusViewer from '@/components/StatusViewer'
import ChallengesRoom from '@/components/ChallengesRoom'
import { useStatuses, Status } from '@/hooks/useStatuses'
import { createClient } from '@/utils/supabase/client'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import SettingsModal from '@/components/SettingsModal'
import { Home, MessageCircle, CircleDashed as StatusCircle, Plus, Trophy, Users } from 'lucide-react'

import { useAuth } from '@/context/AuthContext'

export default function ChatPage() {
  useOnlineStatus()
  const { user, signOut } = useAuth()
  const { deleteStatus } = useStatuses()

  const [activeChatSession, setActiveChatSession] = useState<{id: string, metadata?: {name: string, avatar?: string, isGroup?: boolean}} | null>(null)
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false)
  const [isNewGroupModalOpen, setIsNewGroupModalOpen] = useState(false)
  const [isInfoSidebarOpen, setIsInfoSidebarOpen] = useState(false)
  const [isArenaActive, setIsArenaActive] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [sidebarType, setSidebarType] = useState<'profile' | 'contact' | 'group'>('profile')
  const [sidebarData, setSidebarData] = useState<any>(null)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<'chat' | 'feed' | 'status' | 'challenges' | 'groups'>('feed')
  const [feedFilterUserId, setFeedFilterUserId] = useState<string | undefined>(undefined)
  const [activeStatuses, setActiveStatuses] = useState<Status[] | null>(null)
  const [isNavVisible, setIsNavVisible] = useState(true)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const isInternalScrollRef = useRef(false)

  // Use a ref for the current activeTab so the observer doesn't need to rebuild on every tab change
  const activeTabRef = useRef(activeTab)
  useEffect(() => {
    activeTabRef.current = activeTab
  }, [activeTab])

  // Use IntersectionObserver to sync activeTab with scroll position smoothly
  useEffect(() => {
    if (window.innerWidth >= 768) return

    const observer = new IntersectionObserver((entries) => {
      if (isInternalScrollRef.current) return // Skip if we scrolled via button click

      entries.forEach((entry) => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
          const tab = entry.target.getAttribute('data-tab') as any
          if (tab && tab !== activeTabRef.current) {
            setActiveTab(tab)
          }
        }
      })
    }, {
      root: scrollContainerRef.current,
      threshold: 0.5
    })

    const children = scrollContainerRef.current?.children
    if (children) {
      Array.from(children).forEach((child) => observer.observe(child))
    }

    return () => observer.disconnect()
  }, []) // Stable observer

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

  // Initial state is Feed at index 0, so no complex initial scroll is needed.
  useEffect(() => {
    if (window.innerWidth < 768 && scrollContainerRef.current) {
      // We are already at index 0 (Feed), but we can ensure it's clean
      scrollContainerRef.current.scrollTo({ left: 0 })
    }
  }, [])

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

  const handleSelectChat = (id: string, metadata?: { name: string, avatar?: string, isGroup?: boolean }) => {
    setActiveChatSession({ id, metadata })
  }

  const handleOpenProfile = () => {
    setSidebarType('profile')
    setSidebarData(currentUser)
    setIsInfoSidebarOpen(true)
  }

  const handleOpenChatInfo = async (existingProfile?: any) => {
    if (!activeChatSession?.id || !currentUser) return

    if (existingProfile) {
      setSidebarType('contact')
      setSidebarData({ ...existingProfile, chat_id: activeChatSession.id })
      setIsInfoSidebarOpen(true)
      return
    }

    try {
      const { data: chat, error: chatError } = await supabase
        .from('chats')
        .select('id, name, is_group, avatar_url, description')
        .eq('id', activeChatSession.id)
        .single()

      if (chatError) {
        console.error("Failed to fetch chat:", chatError)
      }

      if (!chat) {
         // Fallback if chat fetching fails for some RLS reason: just open the sidebar with the current activeChatId if we can grab member info.
         const { data: members } = await supabase.from('chat_members').select('user_id').eq('chat_id', activeChatSession.id).neq('user_id', currentUser.id).limit(1).single()
         if (members) {
            const { data: otherProfile } = await supabase.from('profiles').select('*').eq('id', members.user_id).single()
            setSidebarType('contact')
            setSidebarData({ ...otherProfile, chat_id: activeChatSession.id })
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
          .eq('chat_id', activeChatSession.id)
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
          setSidebarData({ ...otherProfile, chat_id: activeChatSession.id })
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
    // 1. Clear active sessions first to unmount overlays
    setActiveChatSession(null)
    setIsInfoSidebarOpen(false)
    
    // 2. Set feed filters and tab
    setFeedFilterUserId(userId)
    setActiveTab('feed')
    
    // 3. Sync scroll position for mobile tabs (Feed is at index 0)
    setTimeout(() => {
      if (scrollContainerRef.current) {
        isInternalScrollRef.current = true
        scrollContainerRef.current.scrollTo({
          left: 0,
          behavior: 'smooth'
        })
      }
    }, 50)
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
      {/* Sidebar Area — Desktop-only slot, Mobile-hidden as it uses the carousel version */}
      <div className={`hidden md:flex w-full md:w-[30%] md:min-w-[320px] h-full transition-all border-r border-white/5`}>
        <ChatSidebar
          onSelectChat={handleSelectChat}
          activeChatId={activeChatSession?.id}
          onOpenNewChat={() => setIsNewChatModalOpen(true)}
          onOpenProfile={handleOpenProfile}
          onOpenSettings={() => setShowSettingsModal(true)}
          activeTab={activeTab}
          isModalOpen={isNewChatModalOpen}
          onTabChange={(tab) => {
            const tabs = ['feed', 'chat', 'groups', 'status', 'challenges']
            const index = tabs.indexOf(tab)
            if (index !== -1 && scrollContainerRef.current) {
              isInternalScrollRef.current = true
              scrollContainerRef.current.scrollTo({
                left: index * scrollContainerRef.current.offsetWidth,
                behavior: 'smooth'
              })
            }
            setActiveTab(tab)
            if (tab !== 'chat') setActiveChatSession(null)
          }}
        />
      </div>

      <div 
        ref={scrollContainerRef}
        onScroll={() => {
          if (isInternalScrollRef.current) {
            // Increased timeout to account for smooth scroll duration
            setTimeout(() => { isInternalScrollRef.current = false }, 600)
          }
        }}
        className={`flex-1 h-full min-w-0 overflow-x-auto md:overflow-hidden overflow-y-hidden snap-x snap-mandatory no-scrollbar transition-all scroll-smooth ${activeChatSession?.id ? 'hidden md:flex' : 'flex'}`}
      >
        {/* Page 0: Discovery Feed (HOME) */}
        <div data-tab="feed" className="min-w-full h-full snap-start snap-always flex flex-col">
          <DiscoveryFeed 
            onStartChat={handleStartDirectChat} 
            filterUserId={feedFilterUserId}
            onClearFilter={() => setFeedFilterUserId(undefined)}
            onBack={() => setFeedFilterUserId(undefined)}
            onInspectUser={handleInspectUser}
          />
        </div>

        {/* Page 1: Chat List */}
        <div data-tab="chat" className="min-w-full h-full snap-start snap-always md:hidden flex flex-col bg-black">
           <ChatSidebar
            onSelectChat={handleSelectChat}
            activeChatId={activeChatSession?.id}
            onOpenNewChat={() => setIsNewChatModalOpen(true)}
            onOpenProfile={handleOpenProfile}
            onOpenSettings={() => setShowSettingsModal(true)}
            activeTab="chat"
            isModalOpen={isNewChatModalOpen}
            onTabChange={(tab) => {
              const tabs = ['feed', 'chat', 'groups', 'status', 'challenges']
              const index = tabs.indexOf(tab)
              if (index !== -1 && scrollContainerRef.current) {
                isInternalScrollRef.current = true
                scrollContainerRef.current.scrollTo({
                  left: index * scrollContainerRef.current.offsetWidth,
                  behavior: 'smooth'
                })
              }
              setActiveTab(tab)
            }}
          />
        </div>

        {/* Page 2: Groups (Communities) */}
        <div data-tab="groups" className="min-w-full h-full snap-start snap-always flex flex-col bg-black">
          <ChatSidebar
            onSelectChat={handleSelectChat}
            activeChatId={activeChatSession?.id}
            onOpenNewChat={() => setIsNewChatModalOpen(true)}
            onOpenProfile={handleOpenProfile}
            onOpenSettings={() => setShowSettingsModal(true)}
            activeTab="groups"
            isModalOpen={isNewChatModalOpen}
            onTabChange={(tab) => {
              const tabs = ['feed', 'chat', 'groups', 'status', 'challenges']
              const index = tabs.indexOf(tab)
              if (index !== -1 && scrollContainerRef.current) {
                isInternalScrollRef.current = true
                scrollContainerRef.current.scrollTo({
                  left: index * scrollContainerRef.current.offsetWidth,
                  behavior: 'smooth'
                })
              }
              setActiveTab(tab)
            }}
          />
        </div>

        {/* Page 3: Status Updates */}
        <div data-tab="status" className="min-w-full h-full snap-start snap-always flex flex-col">
          <StatusTab onStatusClick={setActiveStatuses} onBack={() => {}} />
        </div>

        {/* Page 4: Challenges (Arena) */}
        <div data-tab="challenges" className="min-w-full h-full snap-start snap-always flex flex-col">
          <ChallengesRoom onSessionChange={setIsArenaActive} />
        </div>
      </div>

      {/* Mobile-first Chat Overlay (Outside Carousel) */}
      {activeChatSession && (activeTab === 'chat' || activeTab === 'groups' || activeTab === 'feed') && (
        <div className="fixed inset-0 z-[200] bg-black md:relative md:flex-1 h-full min-w-0">
          <ChatWindow
            chatId={activeChatSession.id}
            initialData={activeChatSession.metadata}
            onOpenInfo={handleOpenChatInfo}
            onBack={() => {
              setActiveChatSession(null)
            }}
          />
        </div>
      )}

      {/* Bottom Navigation Dock - Hidden if ANY focused session is active */}
      <div className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-[100] items-center justify-between px-1 h-[58px] glass-dock rounded-full shadow-[0_16px_40px_rgba(0,0,0,0.7),0_0_0_1px_rgba(188,157,255,0.06)] w-[90%] max-w-[340px] transition-all duration-500 ease-in-out ${(!activeChatSession && !isInfoSidebarOpen && !activeStatuses && !isArenaActive) ? 'flex md:hidden' : 'hidden'} ${isNavVisible ? 'translate-y-0 opacity-100' : 'translate-y-[150%] opacity-0 pointer-events-none'}`}>
          <button 
            onClick={() => {
              isInternalScrollRef.current = true
              setActiveChatSession(null)
              setIsInfoSidebarOpen(false)
              setTimeout(() => {
                if (scrollContainerRef.current) {
                  scrollContainerRef.current.scrollTo({ left: 0, behavior: 'smooth' })
                }
                setActiveTab('feed')
              }, 10)
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
              isInternalScrollRef.current = true
              setActiveChatSession(null)
              setIsInfoSidebarOpen(false)
              setTimeout(() => {
                if (scrollContainerRef.current) {
                  scrollContainerRef.current.scrollTo({ left: scrollContainerRef.current.offsetWidth, behavior: 'smooth' })
                }
                setActiveTab('chat')
              }, 10)
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
              isInternalScrollRef.current = true
              setActiveChatSession(null)
              setIsInfoSidebarOpen(false)
              setTimeout(() => {
                if (scrollContainerRef.current) {
                  scrollContainerRef.current.scrollTo({ left: scrollContainerRef.current.offsetWidth * 2, behavior: 'smooth' })
                }
                setActiveTab('groups')
              }, 10)
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
              isInternalScrollRef.current = true
              setActiveChatSession(null)
              setIsInfoSidebarOpen(false)
              setTimeout(() => {
                if (scrollContainerRef.current) {
                  scrollContainerRef.current.scrollTo({ left: scrollContainerRef.current.offsetWidth * 3, behavior: 'smooth' })
                }
                setActiveTab('status')
              }, 10)
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
              isInternalScrollRef.current = true
              setActiveChatSession(null)
              setIsInfoSidebarOpen(false)
              setTimeout(() => {
                if (scrollContainerRef.current) {
                  scrollContainerRef.current.scrollTo({ left: scrollContainerRef.current.offsetWidth * 4, behavior: 'smooth' })
                }
                setActiveTab('challenges')
              }, 10)
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
        <StatusViewer 
          statuses={activeStatuses} 
          onClose={() => setActiveStatuses(null)} 
          onDelete={deleteStatus}
        />
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
          setActiveChatSession({ id })
          setIsNewChatModalOpen(false)
        }}
        onOpenNewGroup={() => setIsNewGroupModalOpen(true)}
        onInspectProfile={handleInspectUser}
      />

      <NewGroupModal
        isOpen={isNewGroupModalOpen}
        onClose={() => setIsNewGroupModalOpen(false)}
        onGroupCreated={(id) => {
          setActiveChatSession({ id })
          setIsNewGroupModalOpen(false)
        }}
      />

      {showSettingsModal && (
        <SettingsModal type="sidebar" onClose={() => setShowSettingsModal(false)} />
      )}
    </div>
  )
}
