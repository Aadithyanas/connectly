'use client'

import { useState, useEffect } from 'react'
import ChatSidebar from '@/components/ChatSidebar'
import ChatWindow from '@/components/ChatWindow'
import NewChatModal from '@/components/NewChatModal'
import InfoSidebar from '@/components/InfoSidebar'
import { createClient } from '@/utils/supabase/client'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'

export default function ChatPage() {
  useOnlineStatus() // Start heartbeat

  const [activeChatId, setActiveChatId] = useState<string | undefined>(undefined)
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false)
  const [isInfoSidebarOpen, setIsInfoSidebarOpen] = useState(false)
  const [sidebarType, setSidebarType] = useState<'profile' | 'contact' | 'group'>('profile')
  const [sidebarData, setSidebarData] = useState<any>(null)
  const [currentUser, setCurrentUser] = useState<any>(null)

  const supabase = createClient()

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
        setCurrentUser(profile)
      }
    }
    getUser()
  }, [])

  // GLOBAL LISTENER: Mark ALL incoming messages as "delivered" instantly
  // This runs for ANY chat, even if the user hasn't opened it
  useEffect(() => {
    if (!currentUser) return

    const globalChannel = supabase.channel('global-delivery')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        async (payload) => {
          const newMsg = payload.new as any
          // Only mark messages from OTHER people as delivered
          if (newMsg.sender_id !== currentUser.id && newMsg.status === 'sent') {
            try {
              await supabase.rpc('mark_messages_delivered', { cid: newMsg.chat_id })
            } catch (e) {
              // silently fail
            }
          }
        }
      )
      .subscribe()

    // Also mark all existing undelivered messages as delivered on app load
    const markAllDelivered = async () => {
      // Get all chats user belongs to
      const { data: memberOf } = await supabase
        .from('chat_members')
        .select('chat_id')
        .eq('user_id', currentUser.id)

      if (memberOf) {
        for (const m of memberOf) {
          try {
            await supabase.rpc('mark_messages_delivered', { cid: m.chat_id })
          } catch (e) {
            // silently fail
          }
        }
      }
    }
    markAllDelivered()

    return () => { supabase.removeChannel(globalChannel) }
  }, [currentUser?.id])

  const handleSelectChat = (id: string) => {
    setActiveChatId(id)
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

  return (
    <div className="flex w-full h-full relative overflow-hidden bg-[#111b21]">
      <div className={`${activeChatId ? 'hidden md:flex' : 'flex'} w-full md:w-[30%] md:min-w-[320px] h-full transition-all`}>
        <ChatSidebar
          onSelectChat={handleSelectChat}
          activeChatId={activeChatId}
          onOpenNewChat={() => setIsNewChatModalOpen(true)}
          onOpenProfile={handleOpenProfile}
        />
      </div>

      <div className={`${activeChatId ? 'flex' : 'hidden md:flex'} flex-1 h-full transition-all`}>
        <ChatWindow
          chatId={activeChatId}
          onOpenInfo={handleOpenChatInfo}
          onBack={() => setActiveChatId(undefined)}
        />
      </div>

      <InfoSidebar
        isOpen={isInfoSidebarOpen}
        onClose={() => setIsInfoSidebarOpen(false)}
        type={sidebarType}
        data={sidebarData}
      />

      <NewChatModal
        isOpen={isNewChatModalOpen}
        onClose={() => setIsNewChatModalOpen(false)}
        onChatCreated={(id) => {
          setActiveChatId(id)
          setIsNewChatModalOpen(false)
        }}
      />
    </div>
  )
}
