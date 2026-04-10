'use client'

import { useState, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useAuth } from '@/context/AuthContext'

export type GroupRole = 'admin' | 'member'
export type MemberStatus = 'joined' | 'invited' | 'requesting'

export function useGroups() {
  const { user } = useAuth()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)

  const createGroup = useCallback(async (name: string, description: string, isPublic: boolean, initialMemberIds: string[] = []) => {
    if (!user) return { error: 'Not authenticated' }
    setLoading(true)

    try {
      // 1. Create the chat
      const { data: chat, error: chatError } = await supabase
        .from('chats')
        .insert({
          name,
          description,
          is_public: isPublic,
          is_group: true,
          created_by: user.id
        })
        .select()
        .single()

      if (chatError) throw chatError

      // 2. Add members
      const membersToInsert = [
        {
          chat_id: chat.id,
          user_id: user.id,
          role: 'admin',
          status: 'joined'
        }
      ]

      if (initialMemberIds.length > 0) {
        // Fetch profiles to check roles for invitation logic
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, role')
          .in('id', initialMemberIds)
        
        const profileMap = new Map(profiles?.map(p => [p.id, p]) || [])

        initialMemberIds.forEach(id => {
          if (id === user.id) return
          const p = profileMap.get(id)
          membersToInsert.push({
            chat_id: chat.id,
            user_id: id,
            role: 'member',
            status: p?.role === 'professional' ? 'invited' : 'joined'
          })
        })
      }

      const { error: memberError } = await supabase
        .from('chat_members')
        .insert(membersToInsert)

      if (memberError) throw memberError

      // 3. Add system message about creation
      await supabase.from('messages').insert({
        chat_id: chat.id,
        sender_id: user.id,
        content: `You created group "${name}"`,
        is_system: true,
        status: 'sent'
      })

      return { data: chat, error: null }
    } catch (err: any) {
      return { error: err.message }
    } finally {
      setLoading(false)
    }
  }, [user, supabase])

  const inviteUser = useCallback(async (chatId: string, targetUserId: string) => {
    if (!user) return { error: 'Not authenticated' }

    try {
      // Get target user's role
      const { data: targetProfile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', targetUserId)
        .single()

      // Logic:
      // Pro adds Student -> joined
      // Any adds Pro -> invited
      // Student adds Student -> joined
      
      let status: MemberStatus = 'joined'
      if (targetProfile?.role === 'professional') {
        status = 'invited'
      }

      const { error } = await supabase
        .from('chat_members')
        .insert({
          chat_id: chatId,
          user_id: targetUserId,
          status,
          role: 'member'
        })

      return { error, status }
    } catch (err: any) {
      return { error: err.message }
    }
  }, [user, supabase])

  const acceptInvitation = useCallback(async (chatId: string) => {
    if (!user) return { error: 'Not authenticated' }
    const { error } = await supabase
      .from('chat_members')
      .update({ status: 'joined' })
      .eq('chat_id', chatId)
      .eq('user_id', user.id)
    return { error }
  }, [user, supabase])

  const requestJoin = useCallback(async (chatId: string) => {
    if (!user) return { error: 'Not authenticated' }
    const { error } = await supabase
      .from('chat_members')
      .insert({
        chat_id: chatId,
        user_id: user.id,
        status: 'requesting',
        role: 'member'
      })
    return { error }
  }, [user, supabase])

  return { loading, createGroup, inviteUser, acceptInvitation, requestJoin }
}
