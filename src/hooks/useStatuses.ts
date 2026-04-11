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
      // 1. Get Signature via API
      const signRes = await fetch('/api/cloudinary/sign', { method: 'POST', body: JSON.stringify({ folder: `statuses/${user.id}` }) })
      const signData = await signRes.json()
      if (!signRes.ok) throw new Error(signData.error || 'Failed to get signature')

      // 2. Upload directly to Cloudinary
      const formData = new FormData()
      formData.append('file', file)
      formData.append('api_key', signData.apiKey)
      formData.append('timestamp', signData.timestamp)
      formData.append('signature', signData.signature)
      formData.append('folder', `statuses/${user.id}`)

      const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${signData.cloudName}/auto/upload`, {
        method: 'POST',
        body: formData
      })
      const uploadData = await uploadRes.json()
      if (!uploadRes.ok) throw new Error(uploadData.error?.message || 'Upload failed')

      const publicUrl = uploadData.secure_url;
      const contentType = file.type.startsWith('video') ? 'video' : 'image';

      // 3. Create Status via API Route to protect DB
      const dbRes = await fetch('/api/statuses/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content_url: publicUrl,
          content_type: contentType,
          caption
        })
      });
      const dbResult = await dbRes.json();

      if (!dbRes.ok) throw new Error(dbResult.error || 'Database insert failed');

      return { success: true }
    } catch (err: any) {
      console.error('Status upload failed:', err)
      return { error: err.message }
    }
  }

  return { myStatuses, partnerStatuses, loading, uploadStatus, refresh: fetchStatuses }
}
