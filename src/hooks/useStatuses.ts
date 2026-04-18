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
  impressions_count?: number
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

  // Hydrate from cache on mount
  useEffect(() => {
    if (user) {
      try {
        const savedMy = localStorage.getItem(`my_statuses_${user.id}`)
        const savedPartner = localStorage.getItem(`partner_statuses_${user.id}`)
        if (savedMy) setMyStatuses(JSON.parse(savedMy))
        if (savedPartner) setPartnerStatuses(JSON.parse(savedPartner))
      } catch (e) {}
    }
  }, [user])

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
    
    // Save to cache only if we have data to keep it from clearing on accidental empty fetch
    if (user?.id && (mine.length > 0 || Object.keys(othersGrouped).length > 0)) {
      localStorage.setItem(`my_statuses_${user.id}`, JSON.stringify(mine))
      localStorage.setItem(`partner_statuses_${user.id}`, JSON.stringify(othersGrouped))
    }

    setLoading(false)
  }, [supabase, user])

  useEffect(() => {
    if (!user) return

    // Initial fetch
    fetchStatuses()

    // Loading fail-safe timeout
    const timeoutId = setTimeout(() => {
      setLoading(false)
    }, 8000)

    // Polling setup
    let intervalId: NodeJS.Timeout

    const startPolling = () => {
      const isIdle = document.visibilityState === 'hidden'
      const interval = isIdle ? 90000 : 45000 // 45s active / 90s idle
      
      intervalId = setInterval(() => {
        fetchStatuses()
      }, interval)
    }

    startPolling()

    const handleVisibilityChange = () => {
      clearInterval(intervalId)
      // If we just became visible, refresh immediately
      if (document.visibilityState === 'visible') {
        fetchStatuses()
      }
      startPolling()
    }

    const handleAppRefresh = () => {
      fetchStatuses()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('app:refresh', handleAppRefresh)

    return () => {
      clearInterval(intervalId)
      clearTimeout(timeoutId)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('app:refresh', handleAppRefresh)
    }
  }, [fetchStatuses, user])

  const uploadStatus = async (file: File, caption?: string) => {
    if (!user) return { error: 'Not authenticated' }

    // 1. Determine resource type and set limits
    const isVideo = file.type.startsWith('video/')
    const resourceType = isVideo ? 'video' : (file.type.startsWith('image/') ? 'image' : 'raw')
    
    // Limits: Video = 100MB, Others = 10MB
    const limit = (resourceType === 'video') ? 100 * 1024 * 1024 : 10 * 1024 * 1024
    if (file.size > limit) {
      return { error: `File is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Max limit is ${(limit / (1024 * 1024))}MB.` }
    }

    try {
      // 2. Get Signature via API
      const signRes = await fetch('/api/cloudinary/sign', { 
        method: 'POST', 
        body: JSON.stringify({ 
          folder: `statuses/${user.id}`
        }) 
      })
      const signData = await signRes.json()
      if (!signRes.ok) throw new Error(signData.error || 'Failed to get signature')

      // 3. Upload to Cloudinary using correct endpoint
      const formData = new FormData()
      formData.append('file', file)
      formData.append('api_key', signData.apiKey)
      formData.append('timestamp', signData.timestamp)
      formData.append('signature', signData.signature)
      formData.append('folder', `statuses/${user.id}`)
      // The upload URL endpoint (e.g. /video/upload) tells Cloudinary the type — don't append resource_type to FormData.

      const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${signData.cloudName}/${resourceType}/upload`, {
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

  const deleteStatus = async (statusId: string) => {
    if (!user) return { error: 'Not authenticated' }
    try {
      const { error } = await supabase
        .from('statuses')
        .delete()
        .eq('id', statusId)
        .eq('user_id', user.id)

      if (error) throw error
      
      await fetchStatuses()
      return { success: true }
    } catch (err: any) {
      console.error('Failed to delete status:', err)
      return { error: err.message }
    }
  }

  return { myStatuses, partnerStatuses, loading, uploadStatus, deleteStatus, refresh: fetchStatuses }
}
