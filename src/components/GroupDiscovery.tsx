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
        // Fetch all public groups
        const { data: publicGroups, error } = await supabase
          .from('chats')
          .select('*, chat_members(user_id, status)')
          .eq('is_public', true)
          .eq('is_group', true)

        if (error) throw error

        // Filter out groups where user is already a member (including Admin/Pending)
        const formatted = (publicGroups || []).map(group => {
          const myMembership = group.chat_members?.find((m: any) => m.user_id === currentUserId)
          return {
            ...group,
            myStatus: myMembership?.status || null
          }
        }).filter(g => !g.myStatus) // Only show groups where I have NO status yet

        setGroups(formatted)
      } catch (err) {
        console.error('Error fetching public groups:', err)
      } finally {
        setLoading(false)
      }
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
      <div className="flex flex-col gap-4 p-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="animate-pulse flex items-center gap-3">
             <div className="w-12 h-12 rounded-xl bg-white/[0.03]" />
             <div className="flex-1 space-y-2">
               <div className="h-3 w-1/2 bg-white/[0.03] rounded" />
               <div className="h-2 w-3/4 bg-white/[0.02] rounded" />
             </div>
          </div>
        ))}
      </div>
    )
  }

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center opacity-40">
        <Globe className="w-10 h-10 mb-2" />
        <p className="text-sm">No new public communities found.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      {groups.map((group) => (
        <div key={group.id} className="flex items-center gap-3 p-4 border-b border-white/[0.03] group hover:bg-white/[0.01] transition-colors">
          <div className="w-12 h-12 rounded-xl bg-white/[0.05] shrink-0 overflow-hidden flex items-center justify-center border border-white/[0.05]">
            {group.avatar_url ? (
              <img src={group.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <Users className="w-5 h-5 text-zinc-600" />
            )}
          </div>
          
          <div className="flex-1 min-w-0 pr-2">
            <h4 className="text-sm font-bold text-white truncate mb-0.5">{group.name}</h4>
            <p className="text-[11px] text-zinc-500 line-clamp-1">{group.description || 'Global tech community'}</p>
          </div>

          <div className="shrink-0">
            {group.myStatus === 'requesting' ? (
              <div className="px-3 py-1.5 rounded-lg bg-zinc-800/50 text-zinc-500 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Loader2 className="w-3 h-3 animate-spin" />
                Pending
              </div>
            ) : group.myStatus === 'invited' ? (
              <button 
                onClick={() => onSelectChat(group.id)}
                className="px-3 py-1.5 rounded-lg bg-white/10 text-white text-[10px] font-bold uppercase tracking-wider hover:bg-white/20 transition-all"
              >
                View Invite
              </button>
            ) : (
              <button 
                onClick={() => handleJoinRequest(group.id)}
                disabled={requestingIds.has(group.id)}
                className="px-3 py-1.5 rounded-lg bg-white text-black text-[10px] font-bold uppercase tracking-wider hover:scale-105 active:scale-95 transition-all flex items-center gap-1.5"
              >
                {requestingIds.has(group.id) ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                Join
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
