'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useAuth } from '@/context/AuthContext'

export interface Post {
  id: string
  user_id: string
  title?: string
  content: string
  media_urls: string[]
  media_types: string[]
  category: 'project' | 'workshop' | 'hiring' | 'tip' | 'general_tech'
  likes_count: number
  comments_count: number
  created_at: string
  user?: {
    name: string
    avatar_url: string
    role: string
  }
  is_liked?: boolean
}

export interface PostComment {
  id: string
  post_id: string
  user_id: string
  content: string
  created_at: string
  reply_to_id?: string
  user?: {
    name: string
    avatar_url: string
  }
  replied_to?: {
    content: string
    profiles: {
      name: string
    }
  }
}

export function usePosts(filterUserId?: string) {
  const [posts, setPosts] = useState<Post[]>(() => {
    if (typeof window !== 'undefined' && !filterUserId) {
      const saved = localStorage.getItem('tech_feed_cache')
      return saved ? JSON.parse(saved) : []
    }
    return []
  })
  const [loading, setLoading] = useState(true)

  // State for comments
  const [activeComments, setActiveComments] = useState<Record<string, PostComment[]>>({})
  const [loadingComments, setLoadingComments] = useState<Record<string, boolean>>({})

  const { user, loading: authLoading } = useAuth()
  const supabase = createClient()

  // Use a ref to keep track of posts for background logic without triggering re-renders of the callback
  const postsRef = useRef<Post[]>(posts)
  useEffect(() => {
    postsRef.current = posts
  }, [posts])

  const fetchPosts = useCallback(async (isSilent = false) => {
    if (authLoading) return
    
    if (!user) {
      if (!isSilent) setLoading(false)
      return
    }

    if (!isSilent && postsRef.current.length === 0) setLoading(true)
    
    try {
      let query = supabase
        .from('posts')
        .select(`
          *,
          profiles:posts_user_id_fkey(name, avatar_url, role)
        `)

      if (filterUserId) {
        query = query.eq('user_id', filterUserId)
      }

      const { data, error } = await query.order('created_at', { ascending: false })

      if (error) throw error

      // Check which posts the current user has liked
      const { data: myLikes } = await supabase
        .from('post_likes')
        .select('post_id')
        .eq('user_id', user.id)

      const likedPostIds = new Set((myLikes || []).map((l: any) => l.post_id))

      const formatted: Post[] = (data || []).map((p: any) => ({
        ...p,
        user: p.profiles,
        is_liked: likedPostIds.has(p.id),
        media_urls: Array.isArray(p.media_urls) ? p.media_urls : [],
        media_types: Array.isArray(p.media_types) ? p.media_types : []
      }))

      setPosts(formatted)
      if (!filterUserId) {
        localStorage.setItem('tech_feed_cache', JSON.stringify(formatted))
      }
    } catch (err) {
      console.error('Error fetching posts:', err)
    } finally {
      setLoading(false)
    }
  }, [user, authLoading, supabase, filterUserId])

  useEffect(() => {
    if (authLoading || !user) return

    fetchPosts()

    const channel = supabase.channel(`tech-feed-sync-${Math.random()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => {
        fetchPosts(true)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_likes' }, () => {
        fetchPosts(true)
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_comments' }, () => {
        fetchPosts(true)
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, authLoading, supabase, fetchPosts])

  const fetchComments = async (postId: string) => {
    setLoadingComments(prev => ({ ...prev, [postId]: true }))
    try {
      const { data, error } = await supabase
        .from('post_comments')
        .select(`
          *, 
          profiles:user_id(name, avatar_url),
          replied_to:reply_to_id(
            content,
            profiles:user_id(name)
          )
        `)
        .eq('post_id', postId)
        .order('created_at', { ascending: true })

      if (error) throw error
      
      const formatted: PostComment[] = (data || []).map((c: any) => ({
        ...c,
        user: c.profiles
      }))
      
      setActiveComments(prev => ({ ...prev, [postId]: formatted }))
    } catch (err) {
      console.error('Failed to fetch comments:', err)
      // Clear comments on error or keep old ones? Clear for now to reset UI
      setActiveComments(prev => ({ ...prev, [postId]: [] }))
    } finally {
      setLoadingComments(prev => ({ ...prev, [postId]: false }))
    }
  }

  const addComment = async (postId: string, content: string, replyToId?: string) => {
    if (!user) return { error: 'Not authenticated' }

    try {
      const { data, error } = await supabase
        .from('post_comments')
        .insert({
          post_id: postId,
          user_id: user.id,
          content: content.trim(),
          reply_to_id: replyToId
        })
        .select()
        .single()

      if (error) throw error

      // Refresh comments for this post
      await fetchComments(postId)
      return { data, error: null }
    } catch (err: any) {
      console.error('Add comment error:', err)
      return { data: null, error: err.message || 'Failed to add comment' }
    }
  }

  const toggleLike = async (postId: string, currentlyLiked: boolean) => {
    if (!user) return

    // Optimistic Update
    setPosts(prev => prev.map(p => {
      if (p.id === postId) {
        return {
          ...p,
          is_liked: !currentlyLiked,
          likes_count: currentlyLiked ? Math.max(0, p.likes_count - 1) : p.likes_count + 1
        }
      }
      return p
    }))

    try {
      if (currentlyLiked) {
        const { error } = await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('post_likes')
          .insert({ post_id: postId, user_id: user.id })
        if (error) throw error
      }
    } catch (err) {
      console.error('Like toggle failed:', err)
      // Rollback on error
      setPosts(prev => prev.map(p => {
        if (p.id === postId) {
          return {
            ...p,
            is_liked: currentlyLiked,
            likes_count: currentlyLiked ? p.likes_count : Math.max(0, p.likes_count - 1)
          }
        }
        return p
      }))
    }
  }

  const createPost = async (payload: { title?: string, content: string, media_urls: string[], media_types: string[], category: string }) => {
    if (!user) return { error: 'Not authenticated' }

    const { data, error } = await supabase
      .from('posts')
      .insert([{
        user_id: user.id,
        ...payload
      }])
      .select()
      .single()

    return { data, error }
  }

  return { 
    posts, 
    loading, 
    toggleLike, 
    createPost, 
    refresh: fetchPosts,
    fetchComments,
    addComment,
    activeComments,
    loadingComments
  }
}
