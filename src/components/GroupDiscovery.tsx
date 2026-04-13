'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Globe, Users, Plus, Loader2, Check } from 'lucide-react'

interface GroupDiscoveryProps {
  onSelectChat: (chatId: string) => void
  currentUserId: string
}

export default function GroupDiscovery({ onSelectChat, currentUserId }: GroupDiscoveryProps) {
  const [groups, setGroups] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [requestingIds, setRequestingIds] = useState<Set<string>>(new Set())
  const supabase = createClient()

  useEffect(() => {
    const fetchPublicGroups = async () => {
      setLoading(true)
      try {
        // Fetch all public groups with member avatars
        const { data: publicGroups, error } = await supabase
          .from('chats')
          .select('*, chat_members(user_id, status, profiles(avatar_url))')
          .eq('is_public', true)
          .eq('is_group', true)

        if (error) {
          // Fallback if profiles relation fails
          const { data: fallbackGroups, error: fallbackError } = await supabase
            .from('chats')
            .select('*, chat_members(user_id, status)')
            .eq('is_public', true)
            .eq('is_group', true)
            
          if (fallbackError) throw fallbackError
          
          processGroups(fallbackGroups)
        } else {
          processGroups(publicGroups)
        }

      } catch (err) {
        console.error('Error fetching public groups:', err)
      } finally {
        setLoading(false)
      }
    }

    const processGroups = (data: any) => {
      // Filter out groups where user is already a member (including Admin/Pending)
      const formatted = (data || []).map((group: any) => {
        const myMembership = group.chat_members?.find((m: any) => m.user_id === currentUserId)
        return {
          ...group,
          myStatus: myMembership?.status || null
        }
      }).filter((g: any) => !g.myStatus) // Only show groups where I have NO status yet

      setGroups(formatted)
    }

    fetchPublicGroups()
  }, [currentUserId, supabase])

  const handleJoinRequest = async (chatId: string) => {
    setRequestingIds(prev => new Set(prev).add(chatId))
    try {
      const { error } = await supabase
        .from('chat_members')
        .insert({
          chat_id: chatId,
          user_id: currentUserId,
          status: 'requesting',
          role: 'member'
        })
      
      if (!error) {
        setGroups(prev => prev.map(g => g.id === chatId ? { ...g, myStatus: 'requesting' } : g))
      }
    } catch (err) {
      console.error('Error requesting to join group:', err)
    } finally {
      setRequestingIds(prev => {
        const next = new Set(prev)
        next.delete(chatId)
        return next
      })
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-5 p-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="animate-pulse bg-[#1c1e2e] rounded-3xl p-5 border border-white/[0.04]">
             <div className="flex justify-between items-start mb-4">
               <div className="w-3/4 h-6 bg-white/[0.03] rounded-lg" />
               <div className="w-16 h-5 bg-white/[0.03] rounded-full" />
             </div>
             <div className="flex -space-x-2.5 mb-4">
               {[...Array(3)].map((_, j) => (
                 <div key={j} className="w-8 h-8 rounded-full border-2 border-[#1c1e2e] bg-white/[0.03]" style={{ zIndex: 10 - j }} />
               ))}
               <div className="w-8 h-8 rounded-full border-2 border-[#1c1e2e] bg-white/[0.03] z-0" />
             </div>
             <div className="space-y-2 mb-5">
               <div className="w-full h-3 bg-white/[0.03] rounded" />
               <div className="w-5/6 h-3 bg-white/[0.03] rounded" />
             </div>
             <div className="w-full h-11 bg-white/[0.03] rounded-xl" />
          </div>
        ))}
      </div>
    )
  }

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center opacity-40 h-full">
        <Globe className="w-10 h-10 mb-2" />
        <p className="text-sm">No new public communities found.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5 p-4">
      {groups.map((group) => {
        const memberCount = group.chat_members?.length || 1;
        // Display generic or actual members (up to 3 faces)
        const displayMembers = group.chat_members?.slice(0, 3) || [];
        const extraCount = Math.max(0, memberCount - displayMembers.length);

        return (
          <div key={group.id} className="relative bg-[#1c1e2ee0] backdrop-blur-xl rounded-3xl p-5 border border-white/[0.06] overflow-hidden flex flex-col shadow-[0_8px_32px_rgba(0,0,0,0.4)] hover:border-[#bc9dff]/30 transition-all duration-300">
            {/* LIVE NOW badge */}
            <div className="absolute top-5 right-5 bg-white/5 backdrop-blur-md px-2.5 py-1 rounded-full flex items-center gap-1.5 border border-white/10 shadow-lg">
              <div className="w-1.5 h-1.5 bg-[#bc9dff] rounded-full animate-pulse shadow-[0_0_8px_rgba(188,157,255,0.6)]" />
              <span className="text-[9px] font-bold text-white/80 uppercase tracking-widest">Live Now</span>
            </div>

            {/* Title */}
            <h3 className="text-[22px] font-bold text-white mb-4 pr-[85px] tracking-tight leading-[1.1] selection:bg-[#bc9dff]/30">
              {group.name}
            </h3>

            {/* Avatars */}
            <div className="flex items-center gap-3 mb-4">
              <div className="flex -space-x-3">
                {displayMembers.map((m: any, i: number) => {
                  // Fallback vibrant gradients if no avatar
                  const gradients = [
                    'from-[#ff7eb3] to-[#ff758c]',
                    'from-[#bc9dff] to-[#4c1d95]',
                    'from-[#4facfe] to-[#00f2fe]',
                  ]
                  const avatar = m.profiles?.avatar_url || group.avatar_url;
                  
                  return (
                    <div key={i} className={`w-9 h-9 rounded-full border-[2.5px] border-[#1c1e2e] bg-gradient-to-br ${gradients[i % gradients.length]} shrink-0 shadow-md flex items-center justify-center overflow-hidden`} style={{ zIndex: 10 - i }}>
                        {avatar ? (
                          <img src={avatar} className="w-full h-full object-cover" alt="Member" onError={(e) => e.currentTarget.style.display = 'none'} />
                        ) : (
                          <Users className="w-4 h-4 text-white/50" />
                        )}
                    </div>
                  )
                })}
                {extraCount > 0 && (
                  <div className="w-9 h-9 rounded-full border-[2.5px] border-[#1c1e2e] bg-white/[0.08] backdrop-blur-md flex items-center justify-center shrink-0 z-0 shadow-md">
                    <span className="text-[10px] font-bold text-white/80">+{extraCount}</span>
                  </div>
                )}
              </div>
            </div>

            <p className="text-[13.5px] text-white/60 leading-relaxed mb-6 line-clamp-3">
              {group.description || 'Discussing the evolution of nocturnal interfaces and the future of glassmorphism in high-end UI.'}
            </p>

            {group.myStatus === 'requesting' ? (
              <button disabled className="w-full py-3.5 rounded-xl bg-white/[0.04] border border-white/[0.05] text-white/40 text-sm font-bold flex items-center justify-center gap-2 cursor-not-allowed">
                <Loader2 className="w-4 h-4 animate-spin" /> Pending Approval
              </button>
            ) : group.myStatus === 'invited' ? (
              <button 
                onClick={() => onSelectChat(group.id)}
                className="w-full py-3.5 rounded-xl bg-white/10 hover:bg-white/20 transition-all duration-300 text-white text-sm font-bold active:scale-[0.98]"
              >
                Open Invite
              </button>
            ) : (
              <button 
                onClick={() => handleJoinRequest(group.id)}
                disabled={requestingIds.has(group.id)}
                className="w-full py-3.5 rounded-xl bg-[#bc9dff] hover:bg-[#a78bfa] hover:shadow-[0_0_20px_rgba(188,157,255,0.3)] transition-all duration-300 text-[#1a103c] text-sm font-bold flex items-center justify-center gap-2 mt-auto active:scale-[0.98]"
              >
                 {requestingIds.has(group.id) ? (
                   <Loader2 className="w-4 h-4 animate-spin" />
                 ) : (
                   'Join Session'
                 )}
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
