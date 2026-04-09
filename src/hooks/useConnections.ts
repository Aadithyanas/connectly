'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useAuth } from '@/context/AuthContext'

export function useConnections(targetUserId?: string) {
  const [stats, setStats] = useState({ followers: 0, following: 0 })
  const [isFollowing, setIsFollowing] = useState(false)
  const [loading, setLoading] = useState(false)
  
  const { user } = useAuth()
  const supabase = createClient()

  const fetchStats = useCallback(async () => {
    if (!targetUserId) return
    
    try {
      // 1. Get counts
      const { data, error } = await supabase.rpc('get_connection_stats', { p_user_id: targetUserId })
      if (!error && data && data.length > 0) {
        setStats({
          followers: Number(data[0].followers_count),
          following: Number(data[0].following_count)
        })
      }

      // 2. Check if current user follows target
      if (user && user.id !== targetUserId) {
        const { data: followData } = await supabase
          .from('user_connections')
          .select('follower_id')
          .eq('follower_id', user.id)
          .eq('following_id', targetUserId)
          .maybeSingle()
        
        setIsFollowing(!!followData)
      }
    } catch (err) {
      console.error('Error fetching connection stats:', err)
    }
  }, [targetUserId, user, supabase])

  useEffect(() => {
    fetchStats()

    // Real-time subscription for connection changes
    const channel = supabase.channel(`connections-${targetUserId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'user_connections'
      }, () => {
        fetchStats()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [targetUserId, fetchStats, supabase])

  const toggleFollow = async () => {
    if (!user || !targetUserId || user.id === targetUserId || loading) return
    
    setLoading(true)
    // Optimistic UI
    const previousState = isFollowing
    setIsFollowing(!previousState)
    setStats(prev => ({
      ...prev,
      followers: previousState ? Math.max(0, prev.followers - 1) : prev.followers + 1
    }))

    try {
      if (previousState) {
        // Unfollow
        const { error } = await supabase
          .from('user_connections')
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', targetUserId)
        if (error) throw error
      } else {
        // Follow
        const { error } = await supabase
          .from('user_connections')
          .insert({ follower_id: user.id, following_id: targetUserId })
        if (error) throw error
      }
    } catch (err) {
      console.error('Follow toggle failed:', err)
      // Rollback
      setIsFollowing(previousState)
      fetchStats() // Correct counts
    } finally {
      setLoading(false)
    }
  }

  return {
    followersCount: stats.followers,
    followingCount: stats.following,
    isFollowing,
    toggleFollow,
    loading,
    refresh: fetchStats
  }
}
