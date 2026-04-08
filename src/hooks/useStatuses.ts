'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useAuth } from '@/context/AuthContext'

export interface Status {
  id: string
  user_id: string
  content_url: string
  content_type: 'image' | 'video'
  caption?: string
  created_at: string
  expires_at: string
  user?: {
    name: string
    avatar_url: string
  }
}

export function useStatuses() {
  const [myStatuses, setMyStatuses] = useState<Status[]>([])
  const [partnerStatuses, setPartnerStatuses] = useState<Record<string, Status[]>>({})
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()
  const supabase = createClient()

  const fetchStatuses = useCallback(async () => {
    if (!user) return

    // Fetch all statuses visible to me (RLS handles privacy)
    // We also fetch the profiles for names/avatars
    const { data, error } = await supabase
      .from('statuses')
      .select('*, profiles(name, avatar_url)')
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching statuses:', error)
      setLoading(false)
      return
    }

    const formatted: Status[] = data.map((s: any) => ({
      ...s,
      user: s.profiles
    }))

    // Grouping - ensuring strict comparison to avoid self-presence in recent updates
    const currentUserId = user.id;
    const mine = formatted.filter(s => s.user_id === currentUserId)
    const others = formatted.filter(s => s.user_id !== currentUserId)
    
    const othersGrouped = others.reduce((acc, status) => {
      // Safety check: skip if somehow the filter above missed it
      if (status.user_id === currentUserId) return acc;
      
      if (!acc[status.user_id]) acc[status.user_id] = []
      acc[status.user_id].push(status)
      return acc
    }, {} as Record<string, Status[]>)

    setMyStatuses(mine)
    setPartnerStatuses(othersGrouped)
    setLoading(false)
  }, [supabase, user])

  useEffect(() => {
    fetchStatuses()

    // Real-time subscription for statuses, privacy settings, and allowed users
    const channel = supabase.channel(`status-system-sync-${Math.random()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'statuses' }, () => {
        fetchStatuses()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'status_privacy' }, () => {
        fetchStatuses()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'status_allowed_users' }, () => {
        fetchStatuses()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchStatuses, supabase])

  const uploadStatus = async (file: File, caption?: string) => {
    if (!user) return { error: 'Not authenticated' }

    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${user.id}/${Math.random()}.${fileExt}`
      const filePath = `statuses/${fileName}`

      // Upload to your existing 'media' bucket
      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(filePath)

      const { error: dbError } = await supabase
        .from('statuses')
        .insert([{
          user_id: user.id,
          content_url: publicUrl,
          content_type: file.type.startsWith('video') ? 'video' : 'image',
          caption
        }])

      if (dbError) throw dbError
      return { success: true }
    } catch (err: any) {
      console.error('Status upload failed:', err)
      return { error: err.message }
    }
  }

  return { myStatuses, partnerStatuses, loading, uploadStatus, refresh: fetchStatuses }
}
