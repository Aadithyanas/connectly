'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { X, Search, Check, Users, Globe, Send } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/context/AuthContext'
import { Post } from '@/hooks/usePosts'

interface SharePostModalProps {
  isOpen: boolean
  onClose: () => void
  post: Post
}

export default function SharePostModal({ isOpen, onClose, post }: SharePostModalProps) {
  const [chats, setChats] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  
  const [activeTab, setActiveTab] = useState<'people' | 'groups'>('people')
  const [selected, setSelected] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [justSent, setJustSent] = useState(false)

  const { user } = useAuth()
  const supabase = createClient()

  useEffect(() => {
    if (!isOpen || !user) return

    const fetchChatsAndConnections = async () => {
      setLoading(true)
      try {
        // 1. Fetch Existing Chats
        const { data: memberOf } = await supabase.from('chat_members').select('chat_id').eq('user_id', user.id)
        let chatIds: string[] = []
        let chatData: any[] = []
        let allMembers: any[] = []
        let otherUserIds: string[] = []

        if (memberOf && memberOf.length > 0) {
          chatIds = memberOf.map((m: any) => m.chat_id)
          const { data: fetchedChats } = await supabase.from('chats').select('id, name, is_group').in('id', chatIds)
          const { data: members } = await supabase.from('chat_members').select('chat_id, user_id').in('chat_id', chatIds)
          chatData = fetchedChats || []
          allMembers = members || []
          otherUserIds = [...new Set(allMembers.filter((m: any) => m.user_id !== user.id).map((m: any) => m.user_id))]
        }

        // 2. Fetch Connections (Followers & Following)
        const { data: following } = await supabase.from('user_connections').select('following_id').eq('follower_id', user.id)
        const { data: followers } = await supabase.from('user_connections').select('follower_id').eq('following_id', user.id)
        
        const followingIds = (following || []).map((f: any) => f.following_id)
        const followerIds = (followers || []).map((f: any) => f.follower_id)
        const allConnectionIds = [...new Set([...followingIds, ...followerIds])]
        const newConnectionIds = allConnectionIds.filter(id => !otherUserIds.includes(id))

        // 3. Fetch Profiles for all relevant users
        const profileIds = [...new Set([...otherUserIds, ...newConnectionIds])]
        const { data: profiles } = await supabase.from('profiles').select('id, name, avatar_url').in('id', profileIds)
        const profileMap = new Map<string, any>((profiles || []).map((p: any) => [p.id, p]))

        // 4. Format Existing Chats
        const formattedChats = chatData.map((chat: any) => {
          const otherMemberId = allMembers.find((m: any) => m.chat_id === chat.id && m.user_id !== user.id)?.user_id
          const otherProfile: any = otherMemberId ? profileMap.get(otherMemberId) : null
          return {
            id: chat.id,
            type: 'chat',
            name: chat.is_group ? chat.name : (otherProfile?.name || 'User'),
            avatar: otherProfile?.avatar_url || null,
            isGroup: chat.is_group,
            initial: (chat.is_group ? chat.name?.[0] : otherProfile?.name?.[0]) || '?'
          }
        })

        // 5. Format Connections (who aren't in a chat yet)
        const formattedConnections = newConnectionIds.map(id => {
          const profile = profileMap.get(id)
          return {
            id: id,
            type: 'connection',
            name: profile?.name || 'User',
            avatar: profile?.avatar_url || null,
            isGroup: false,
            initial: profile?.name?.[0] || '?'
          }
        })
        
        setChats([...formattedChats, ...formattedConnections])
      } catch (err) {
        console.error('Fetch failed:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchChatsAndConnections()
    setSelected([])
    setSearch('')
    setJustSent(false)
    setIsSubmitting(false)
  }, [isOpen, user, supabase])

  const toggleSelect = (id: string) => {
    if (selected.includes(id)) setSelected(selected.filter(s => s !== id))
    else setSelected([...selected, id])
  }

  const handleBulkShare = async () => {
    if (!user || selected.length === 0 || isSubmitting) return
    setIsSubmitting(true)
    
    try {
      const promises = selected.map(async (id) => {
          const item = chats.find(c => c.id === id)
          if (!item) return
          let activeChatId = item.id
    
          if (item.type === 'connection') {
            const { data: newChatId, error: chatError } = await supabase.rpc('create_dm_chat', { 
                other_user_id: item.id 
            })
            if (chatError) {
              console.error("Chat creation error:", chatError)
              return
            }
            if (newChatId) activeChatId = newChatId
          }
    
          const shareContent = `Check out this post: ${post.title ? `"${post.title}"\n` : ''}${post.content ? post.content.slice(0, 100) + (post.content.length > 100 ? '...' : '') : ''}`
          
          const res = await fetch('/api/messages/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: activeChatId,
              content: shareContent,
              media_url: post.media_urls?.[0] || null,
              media_type: 'image',
              forwarded: true
            })
          })

          if (!res.ok) {
             const errText = await res.text()
             console.error("Failed to share post:", errText)
          }
      })

      await Promise.all(promises)
      setJustSent(true)
      setTimeout(() => {
          onClose()
      }, 1500)

    } catch (err) {
      console.error('Share failed:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const filteredChats = chats.filter((c: any) => 
      c.name.toLowerCase().includes(search.toLowerCase()) && 
      (activeTab === 'groups' ? c.isGroup : !c.isGroup)
  )

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-[#0e0e0e] w-full max-w-md rounded-[2rem] overflow-hidden shadow-2xl border border-white/[0.08] flex flex-col max-h-[85vh]"
          >
            <div className="p-6 flex items-center justify-between border-b border-white/[0.04]">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#bc9dff]/10 rounded-xl">
                  <Globe className="w-5 h-5 text-[#bc9dff]" />
                </div>
                <h2 className="text-white font-headline text-lg tracking-tight">Share Post</h2>
              </div>
              <button 
                onClick={onClose} 
                className="p-2 hover:bg-white/[0.06] rounded-full text-zinc-500 transition-colors"
                disabled={isSubmitting || justSent}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-white/[0.02] border-b border-white/[0.04]">
              <div className="flex items-center gap-3 p-3 bg-white/[0.04] rounded-2xl border border-white/[0.06]">
                <div className="w-10 h-10 rounded-xl overflow-hidden bg-white/[0.06] shrink-0">
                    {post.media_urls?.[0] ? (
                        <img src={post.media_urls[0]} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-[#bc9dff]">
                            <Globe className="w-5 h-5" />
                        </div>
                    )}
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-white text-xs font-bold truncate">@{post.user?.name}</p>
                    <p className="text-zinc-500 text-[11px] truncate mt-0.5">{post.content}</p>
                </div>
              </div>
            </div>

            {/* Tab Bar */}
            <div className="flex items-center px-6 pt-2 border-b border-white/[0.04] shrink-0">
                <button 
                  onClick={() => setActiveTab('people')}
                  className={`flex-1 pb-3 text-sm font-bold transition-all border-b-2 ${activeTab === 'people' ? 'border-[#bc9dff] text-[#bc9dff]' : 'border-transparent text-zinc-500 hover:text-zinc-400'}`}
                >
                  People
                </button>
                <button 
                  onClick={() => setActiveTab('groups')}
                  className={`flex-1 pb-3 text-sm font-bold transition-all border-b-2 ${activeTab === 'groups' ? 'border-[#bc9dff] text-[#bc9dff]' : 'border-transparent text-zinc-500 hover:text-zinc-400'}`}
                >
                  Groups
                </button>
            </div>

            <div className="p-4 shrink-0">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-zinc-600" />
                </div>
                <input 
                  type="text" 
                  placeholder={activeTab === 'people' ? "Search users..." : "Search groups..."}
                  className="block w-full pl-11 pr-4 py-3 bg-white/[0.04] border border-white/[0.08] text-white rounded-2xl focus:ring-1 focus:ring-[#bc9dff]/30 text-sm placeholder-zinc-700 outline-none transition-all" 
                  value={search} 
                  onChange={(e) => setSearch(e.target.value)} 
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar px-2 pb-4 space-y-1">
              {loading ? (
                <div className="py-16 flex flex-col items-center justify-center">
                    <div className="w-8 h-8 border-2 border-[#bc9dff] border-t-transparent rounded-full animate-spin"></div>
                    <p className="mt-4 text-[10px] text-zinc-500 font-bold uppercase tracking-widest animate-pulse">Fetching contacts...</p>
                </div>
              ) : filteredChats.length === 0 ? (
                <div className="py-16 flex flex-col items-center justify-center text-center opacity-40">
                    <Users className="w-10 h-10 mb-2" />
                    <p className="text-xs font-bold uppercase tracking-widest">
                        {activeTab === 'people' ? 'No people found' : 'No groups found'}
                    </p>
                </div>
              ) : (
                filteredChats.map((chat: any) => (
                    <ShareItem 
                        key={chat.id} 
                        item={chat} 
                        isSelected={selected.includes(chat.id)} 
                        onToggle={() => toggleSelect(chat.id)}
                    />
                ))
              )}
            </div>

            {/* Bottom Actions Bar */}
            <AnimatePresence>
                {selected.length > 0 && (
                    <motion.div 
                        initial={{ opacity: 0, y: 100 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 100 }}
                        className="p-4 bg-[#0e0e0e] border-t border-white/[0.08] shrink-0"
                    >
                        {justSent ? (
                            <div className="w-full flex items-center justify-center gap-2 py-3.5 bg-emerald-500/20 text-emerald-400 font-bold rounded-2xl">
                                <Check className="w-5 h-5" />
                                Sent successfully!
                            </div>
                        ) : (
                            <button 
                                onClick={handleBulkShare}
                                disabled={isSubmitting}
                                className="w-full flex items-center justify-center gap-2 py-3.5 bg-[#bc9dff] text-black font-bold text-sm rounded-2xl hover:bg-[#a682fc] transition-colors disabled:opacity-50"
                            >
                                {isSubmitting ? (
                                    <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                                ) : (
                                    <>
                                        <Send className="w-4 h-4" />
                                        Send to {selected.length} {selected.length === 1 ? 'chat' : 'chats'}
                                    </>
                                )}
                            </button>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

function ShareItem({ item, isSelected, onToggle }: { item: any, isSelected: boolean, onToggle: () => void }) {
    return (
        <div 
            className="flex items-center gap-4 px-4 py-3 hover:bg-white/[0.04] rounded-2xl cursor-pointer transition-all group"
            onClick={onToggle}
        >
            <div className="relative">
                <div className="w-11 h-11 rounded-full bg-[#1a1a1a] flex items-center justify-center overflow-hidden border border-white/[0.08]">
                    {item.avatar ? (
                        <img src={item.avatar} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full primary-gradient flex items-center justify-center text-white font-bold uppercase text-base">
                            {item.initial}
                        </div>
                    )}
                </div>
                {item.isGroup && (
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-[#0e0e0e] rounded-full border border-white/[0.1] flex items-center justify-center">
                        <Users className="w-2.5 h-2.5 text-[#bc9dff]" />
                    </div>
                )}
            </div>
            
            <div className="flex-1 min-w-0">
                <h4 className="text-white font-bold text-sm truncate">{item.name}</h4>
                <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider mt-0.5">
                    {item.isGroup ? 'Group Chat' : 'Direct Message'}
                </p>
            </div>
            
            <div className={`w-6 h-6 rounded-full flex items-center justify-center transition-all border ${
                isSelected ? 'bg-[#bc9dff] border-[#bc9dff] text-black' : 'border-zinc-600 border-2 text-transparent'
            }`}>
                <Check className={`w-3.5 h-3.5 ${isSelected ? 'opacity-100' : 'opacity-0'}`} strokeWidth={4} />
            </div>
        </div>
    )
}
