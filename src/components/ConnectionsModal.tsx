'use client'

import { useState, useEffect } from 'react'
import { X, User, Check, Plus, Loader2 } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { useAuth } from '@/context/AuthContext'

interface ConnectionProfile {
  id: string
  name: string
  avatar_url: string
  bio: string
  role: string
}

interface ConnectionsModalProps {
  isOpen: boolean
  onClose: () => void
  userId: string
  initialTab?: 'followers' | 'following'
}

export default function ConnectionsModal({ isOpen, onClose, userId, initialTab = 'followers' }: ConnectionsModalProps) {
  const [activeTab, setActiveTab] = useState<'followers' | 'following'>(initialTab)
  const [users, setUsers] = useState<ConnectionProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUserFollowingMap, setCurrentUserFollowingMap] = useState<Record<string, boolean>>({})
  
  const { user: currentUser } = useAuth()
  const supabase = createClient()

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab)
      loadConnections(initialTab)
      if (currentUser) {
        loadCurrentUserFollowing()
      }
    }
  }, [isOpen, initialTab, userId, currentUser])

  const loadCurrentUserFollowing = async () => {
    if (!currentUser) return
    try {
      const { data, error } = await supabase
        .from('user_connections')
        .select('following_id')
        .eq('follower_id', currentUser.id)
      
      if (!error && data) {
        const map: Record<string, boolean> = {}
        data.forEach((conn: { following_id: string }) => {
          map[conn.following_id] = true
        })
        setCurrentUserFollowingMap(map)
      }
    } catch (e) {
      console.error(e)
    }
  }

  const loadConnections = async (tab: 'followers' | 'following') => {
    setLoading(true)
    setUsers([])
    try {
      if (tab === 'followers') {
        const { data, error } = await supabase
          .from('user_connections')
          .select(`
            follower_id,
            profiles:follower_id ( id, name, avatar_url, bio, role )
          `)
          .eq('following_id', userId)

        if (error) throw error
        setUsers(data?.map((d: any) => d.profiles) || [])
      } else {
        const { data, error } = await supabase
          .from('user_connections')
          .select(`
            following_id,
            profiles:following_id ( id, name, avatar_url, bio, role )
          `)
          .eq('follower_id', userId)

        if (error) throw error
        setUsers(data?.map((d: any) => d.profiles) || [])
      }
    } catch (error) {
      console.error('Error fetching connections:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleFollow = async (e: React.MouseEvent, targetUserId: string) => {
    e.stopPropagation()
    if (!currentUser) return

    const isCurrentlyFollowing = !!currentUserFollowingMap[targetUserId]
    // Optimistic update
    setCurrentUserFollowingMap(prev => ({ ...prev, [targetUserId]: !isCurrentlyFollowing }))

    try {
      if (isCurrentlyFollowing) {
        await supabase
          .from('user_connections')
          .delete()
          .eq('follower_id', currentUser.id)
          .eq('following_id', targetUserId)
      } else {
        await supabase
          .from('user_connections')
          .insert({ follower_id: currentUser.id, following_id: targetUserId })
      }
    } catch (error) {
      console.error('Error toggling follow:', error)
      setCurrentUserFollowingMap(prev => ({ ...prev, [targetUserId]: isCurrentlyFollowing }))
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[400] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-300">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      
      <div className="bg-[#0a0a0a] w-full max-w-md h-[80vh] sm:h-[600px] sm:rounded-[32px] rounded-t-[32px] shadow-2xl relative border border-white/[0.06] animate-in slide-in-from-bottom-full sm:zoom-in-95 duration-300 flex flex-col overflow-hidden">
        
        {/* Header Options */}
        <div className="shrink-0 bg-black/50 border-b border-white/[0.04]">
          <div className="flex justify-center pt-3 pb-2 sm:hidden">
            <div className="w-12 h-1.5 bg-white/20 rounded-full" />
          </div>
          <div className="px-6 py-4 flex items-center justify-between">
            <h2 className="text-white text-lg font-bold">{currentUser?.id === userId ? 'Your Network' : 'Network'}</h2>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-all text-zinc-500 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="flex">
            <button
              onClick={() => { setActiveTab('followers'); loadConnections('followers') }}
              className={`flex-1 py-4 text-sm font-bold text-center transition-colors relative ${activeTab === 'followers' ? 'text-white' : 'text-zinc-500 hover:text-white'}`}
            >
              Followers
              {activeTab === 'followers' && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white rounded-t-full" />}
            </button>
            <button
              onClick={() => { setActiveTab('following'); loadConnections('following') }}
              className={`flex-1 py-4 text-sm font-bold text-center transition-colors relative ${activeTab === 'following' ? 'text-white' : 'text-zinc-500 hover:text-white'}`}
            >
              Following
              {activeTab === 'following' && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white rounded-t-full" />}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
          {loading ? (
            <div className="flex justify-center items-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-zinc-600" />
            </div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-zinc-500">
              <User className="w-12 h-12 mb-3 text-zinc-700" />
              <p className="font-medium">No users found.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {users.filter(Boolean).map(profile => (
                <div key={profile.id} className="flex items-center justify-between p-3 rounded-2xl hover:bg-white/[0.03] transition-colors cursor-pointer">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-12 h-12 rounded-full bg-white/[0.04] overflow-hidden shrink-0">
                      {profile.avatar_url ? (
                        <img src={profile.avatar_url} alt={profile.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-600">
                          <User className="w-6 h-6" />
                        </div>
                      )}
                    </div>
                    <div className="flex text-left flex-col overflow-hidden">
                      <span className="text-white font-bold text-sm truncate">{profile.name}</span>
                      <span className="text-zinc-500 text-xs truncate">{profile.bio || profile.role || 'Connectly User'}</span>
                    </div>
                  </div>
                  
                  {currentUser?.id !== profile.id && (
                    <button
                      onClick={(e) => toggleFollow(e, profile.id)}
                      className={`ml-2 px-4 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 border ${
                        currentUserFollowingMap[profile.id] 
                          ? 'bg-transparent border-white/20 text-white hover:border-white/40' 
                          : 'bg-white text-black border-transparent hover:bg-zinc-200'
                      }`}
                    >
                      {currentUserFollowingMap[profile.id] ? 'Following' : 'Follow'}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
