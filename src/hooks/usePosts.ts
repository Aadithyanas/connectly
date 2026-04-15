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
  quoted_post_id?: string | null
  quoted_post?: {
    id: string
    content: string
    media_urls: string[]
    media_types: string[]
    created_at: string
    user?: {
      name: string
      avatar_url: string
      role: string
    }
  } | null
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

export function usePosts(filterUserId?: string, filterRole?: string) {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [newPostsCount, setNewPostsCount] = useState(0)

  // Hydrate from cache on mount
  useEffect(() => {
    if (!filterUserId) {
      try {
        const saved = localStorage.getItem('tech_feed_cache')
        if (saved) {
          setPosts(JSON.parse(saved))
        }
      } catch (e) {}
    }
  }, [filterUserId])

  // State for comments
  const [activeComments, setActiveComments] = useState<Record<string, PostComment[]>>({})
  const [loadingComments, setLoadingComments] = useState<Record<string, boolean>>({})

  const { user, loading: authLoading } = useAuth()
  const supabase = createClient()

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
          profiles:profiles!posts_user_id_fkey!inner(name, avatar_url, role),
          quoted_post:posts!quoted_post_id (
            id, content, media_urls, media_types, created_at,
            profiles:profiles!posts_user_id_fkey(name, avatar_url, role)
          )
        `)
        .limit(15) // Pagination: Limit initial fetch

      if (filterUserId) {
        query = query.eq('user_id', filterUserId)
      }

      if (filterRole === 'student' || filterRole === 'professional') {
        query = query.eq('profiles.role', filterRole)
      }

      const { data, error } = await query.order('created_at', { ascending: false })

      if (error) throw error

      // Check which posts the current user has liked
      const { data: myLikes } = await supabase
        .from('post_likes')
        .select('post_id')
        .eq('user_id', user.id)

      const likedPostIds = new Set((myLikes || []).map((l: any) => l.post_id))

      const formatted: Post[] = (data || []).map((p: any) => {
        let quoted_post = p.quoted_post
        if (quoted_post) {
          quoted_post = {
            ...quoted_post,
            user: quoted_post.profiles
          }
          delete quoted_post.profiles
        }
        
        return {
          ...p,
          user: p.profiles,
          is_liked: likedPostIds.has(p.id),
          media_urls: Array.isArray(p.media_urls) ? p.media_urls : [],
          media_types: Array.isArray(p.media_types) ? p.media_types : [],
          quoted_post
        }
      })

      setPosts(formatted)
      setNewPostsCount(0) // Reset count on full refresh
      if (!filterUserId) {
        localStorage.setItem('tech_feed_cache', JSON.stringify(formatted))
      }
    } catch (err) {
      console.error('Error fetching posts:', err)
    } finally {
      setLoading(false)
    }
  }, [user, authLoading, supabase, filterUserId, filterRole])

  // Delta Fetching Detection
  const checkForNewPosts = useCallback(async () => {
    if (!user || postsRef.current.length === 0 || filterUserId) return

    const latestPostTime = postsRef.current[0].created_at
    
    try {
      const { count, error } = await supabase
        .from('posts')
        .select('*', { count: 'exact', head: true })
        .gt('created_at', latestPostTime)

      if (!error && count !== null && count > 0) {
        setNewPostsCount(count)
      }
    } catch (err) {
      // Silent error for background check
    }
  }, [user, supabase, filterUserId])

  // Adaptive Polling Strategy
  useEffect(() => {
    if (authLoading || !user) return

    // Initial fetch
    fetchPosts()

    // Setup polling
    let intervalId: NodeJS.Timeout

    const startPolling = () => {
      const isIdle = document.visibilityState === 'hidden'
      const interval = isIdle ? 60000 : 15000 // 15s active / 60s idle
      
      intervalId = setInterval(() => {
        if (document.visibilityState === 'visible') {
          // If active, check for new posts (for button)
          checkForNewPosts()
        } else {
          // If idle, maybe do a silent full refresh less often
          // fetchPosts(true)
        }
      }, interval)
    }

    startPolling()

    const handleVisibilityChange = () => {
      clearInterval(intervalId)
      if (document.visibilityState === 'visible') {
        checkForNewPosts() // Check immediately when returning
      }
      startPolling()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      clearInterval(intervalId)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [user, authLoading, fetchPosts, checkForNewPosts])

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

  const createPost = async (payload: { title?: string, content: string, media_urls: string[], media_types: string[], category: string, quoted_post_id?: string }) => {
    if (!user) return { error: 'Not authenticated' }

    try {
      const res = await fetch('/api/posts/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      const result = await res.json()
      
      if (!res.ok) throw new Error(result.error || 'Failed to create post')
      return { data: result.post, error: null }
    } catch (err: any) {
      return { data: null, error: err.message }
    }
  }

  const updatePost = async (postId: string, payload: { title?: string, content: string }) => {
    if (!user) return { error: 'Not authenticated' }

    const { data, error } = await supabase
      .from('posts')
      .update(payload)
      .eq('id', postId)
      .eq('user_id', user.id)
      .select()

    if (!error) await fetchPosts(true)
    return { data, error }
  }

  const deletePost = async (postId: string) => {
    if (!user) return { error: 'Not authenticated' }

    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', postId)

    if (!error) {
      setPosts(prev => prev.filter(p => p.id !== postId))
    }
    return { error }
  }

  return { 
    posts, 
    loading, 
    newPostsCount,
    toggleLike, 
    createPost,
    updatePost,
    deletePost,
    refresh: fetchPosts,
    fetchComments,
    addComment,
    activeComments,
    loadingComments
  }
}
