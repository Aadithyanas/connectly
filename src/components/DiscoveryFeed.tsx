'use client'

import { usePosts, Post, PostComment } from '@/hooks/usePosts'
import { Heart, MessageCircle, Share2, Plus, Briefcase, Rocket, Lightbulb, GraduationCap, Clock, Send, Loader2, X, Play, ChevronLeft, ChevronRight, ChevronUp, RefreshCw, AlertCircle } from 'lucide-react'
import Image from 'next/image'
import { useState, useRef, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import CreatePostModal from './CreatePostModal'

interface DiscoveryFeedProps {
  onStartChat?: (userId: string, post?: Post) => void
  filterUserId?: string
  onClearFilter?: () => void
  onBack?: () => void
  onScrollToggle?: (visible: boolean) => void
}

export default function DiscoveryFeed({ onStartChat, filterUserId, onClearFilter, onBack, onScrollToggle }: DiscoveryFeedProps) {
  const [roleFilter, setRoleFilter] = useState<'all' | 'student' | 'professional'>('all')
  const { posts, loading, toggleLike, fetchComments, activeComments, loadingComments, addComment, updatePost, deletePost } = usePosts(filterUserId, roleFilter === 'all' ? undefined : roleFilter)
  const [createModal, setCreateModal] = useState<{ isOpen: boolean, quotedPost?: Post }>({ isOpen: false })
  
  const [showHeader, setShowHeader] = useState(true)
  const lastScrollY = useRef(0)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const handleScroll = () => {
      const currentScrollY = container.scrollTop
      // Threshold to prevent jitter, but responsive
      const diff = currentScrollY - lastScrollY.current
      
      if (currentScrollY <= 0) {
        setShowHeader(true)
        onScrollToggle?.(true)
      } else if (diff > 5 && currentScrollY > 50) {
        // Scrolling down - Hide
        setShowHeader(false)
        onScrollToggle?.(false)
      } else if (diff < -5) {
        // Scrolling up - Show
        setShowHeader(true)
        onScrollToggle?.(true)
      }
      
      lastScrollY.current = currentScrollY
    }

    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [onScrollToggle])

  if (loading && posts.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-black">
        <div className="w-10 h-10 border-2 border-white border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-zinc-600 font-medium animate-pulse text-sm">Loading feed...</p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-black relative w-full min-w-0 overflow-hidden">
      {/* Header — The Nocturnal style (Only show for individual user view) */}
      {filterUserId && (
        <div className="w-full px-4 md:px-6 py-3 glass-header border-b border-white/[0.04] flex items-center justify-between sticky top-0 z-20 shrink-0" style={{minHeight:'60px'}}>
          <div className="flex items-center gap-3">
            {onBack && (
              <button onClick={onBack} className="md:hidden p-1.5 hover:bg-white/[0.06] rounded-full text-[#adaaaa] transition-colors">
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <div>
              <h1 className="font-headline text-[#bc9dff] text-lg md:text-xl tracking-tight flex items-center gap-2">
                Achievements
                <span className="w-1.5 h-1.5 rounded-full bg-[#bc9dff] animate-pulse inline-block"></span>
              </h1>
              <p className="text-[#adaaaa] text-[9px] uppercase font-bold tracking-widest mt-0.5">
                Individual Journey
              </p>
            </div>
          </div>
          <button 
            onClick={onClearFilter}
            className="flex items-center gap-2 text-[#adaaaa] hover:text-white transition-colors font-bold text-xs uppercase cursor-pointer"
          >
            <X className="w-4 h-4" />
            Back
          </button>
        </div>
      )}

      {/* Feed Content */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto custom-scrollbar w-full p-0">
        {!filterUserId && (
          <div className={`sticky top-0 z-[40] transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1) ${showHeader ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0 pointer-events-none'}`}>
            <div className="w-full px-6 py-6 bg-black/90 backdrop-blur-3xl border-b border-white/[0.04]">
              <div className="flex flex-col items-center justify-center text-center">
                <h1 className="font-headline text-3xl md:text-5xl text-white tracking-tighter font-black">
                  Connectly
                  <span className="text-[#bc9dff]">.</span>
                </h1>
                <p className="text-[#767575] text-xs uppercase font-bold tracking-[0.4em] mt-2">
                  Build your ideas
                </p>
              </div>
            </div>

            {/* Role Filter Chips (sub-header part of the sticky block) */}
            <div className="w-full px-4 md:px-6 py-4 bg-black/80 backdrop-blur-2xl border-b border-white/[0.04] flex items-center justify-center gap-3 overflow-x-auto no-scrollbar scroll-smooth">
              <button 
                onClick={() => setRoleFilter('all')}
                className={`px-6 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
                  roleFilter === 'all' 
                    ? 'primary-gradient text-white primary-shadow' 
                    : 'bg-white/[0.03] border border-white/[0.05] text-[#adaaaa] hover:text-[#bc9dff] hover:bg-white/[0.06]'
                }`}
              >
                All Roles
              </button>
              <button 
                onClick={() => setRoleFilter('professional')}
                className={`px-6 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  roleFilter === 'professional' 
                    ? 'bg-[#5e289b] text-white border border-[#5e289b]' 
                    : 'bg-white/[0.03] border border-white/[0.05] text-[#adaaaa] hover:text-[#bc9dff] hover:bg-white/[0.06]'
                }`}
              >
                <Briefcase className="w-[11px] h-[11px]" />
                Professionals
              </button>
              <button 
                onClick={() => setRoleFilter('student')}
                className={`px-6 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  roleFilter === 'student' 
                    ? 'bg-[#5e289b] text-white border border-[#5e289b]' 
                    : 'bg-white/[0.03] border border-white/[0.05] text-[#adaaaa] hover:text-[#bc9dff] hover:bg-white/[0.06]'
                }`}
              >
                <GraduationCap className="w-[11px] h-[11px]" />
                Students
              </button>
            </div>
          </div>
        )}

        <div className="w-full md:max-w-5xl md:mx-auto md:space-y-8 p-0 md:p-10">
          {(() => {
            const filteredPosts = posts.filter(post => {
              if (filterUserId) return true; // Keep all for individual view
              return true; // We removed the quotes tab, so just show everything in one stream
            });

            if (filteredPosts.length === 0 && !loading) {
              return (
                <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 animate-in fade-in zoom-in-95 duration-500">
                  <div className="p-6 bg-white/[0.03] rounded-3xl border border-white/[0.04]">
                    <Rocket className="w-12 h-12 text-zinc-700/50" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-xl mb-1">
                      No Posts Found
                    </h3>
                    <p className="text-zinc-500 text-[13px]">
                      Start sharing your achievements and ideas!
                    </p>
                  </div>
                </div>
              )
            }

            return filteredPosts.map(post => (
              <PostCard 
                key={post.id} 
                post={post} 
                onLike={() => toggleLike(post.id, !!post.is_liked)}
                fetchComments={fetchComments}
                activeComments={activeComments}
                loadingComments={loadingComments}
                addComment={addComment}
                onStartChat={onStartChat}
                updatePost={updatePost}
                deletePost={deletePost}
                onQuote={(postToQuote) => setCreateModal({ isOpen: true, quotedPost: postToQuote })}
              />
            ));
          })()}
        </div>
        {/* Floating Action Button for Create Post */}
        {!filterUserId && (
          <div className="absolute bottom-24 right-5 z-[80] md:hidden">
            <button
              onClick={() => setCreateModal({ isOpen: true })}
              className="w-14 h-14 bg-[#1e1e1e] rounded-full flex items-center justify-center shadow-[0_8px_32px_rgba(0,0,0,0.6)] border border-white/[0.08] hover:bg-[#2a2a2a] hover:scale-105 active:scale-95 transition-all text-white"
            >
              <Plus className="w-7 h-7" strokeWidth={2.5} />
            </button>
          </div>
        )}

        {createModal.isOpen && (
          <CreatePostModal
            onClose={() => setCreateModal({ isOpen: false, quotedPost: undefined })}
            quotedPost={createModal.quotedPost}
          />
        )}
      </div>
    </div>
  )
}

interface PostCardProps {
  post: Post
  onLike: () => void
  fetchComments: (postId: string) => void
  activeComments: Record<string, PostComment[]>
  loadingComments: Record<string, boolean>
  addComment: (postId: string, content: string, replyTo?: string) => Promise<{ error: any }>
  updatePost: (postId: string, payload: { title?: string, content: string }) => Promise<any>
  deletePost: (postId: string) => Promise<any>
  onStartChat?: (userId: string, post?: Post) => void
  onQuote: (post: Post) => void
}

function PostCard({ post, onLike, fetchComments, activeComments, loadingComments, addComment, updatePost, deletePost, onStartChat, onQuote }: PostCardProps) {
  const { user } = useAuth()
  const [showComments, setShowComments] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [activeMediaIndex, setActiveMediaIndex] = useState(0)
  const [replyingTo, setReplyingTo] = useState<PostComment | null>(null)
  const [fullscreenMedia, setFullscreenMedia] = useState<{ url: string, type: string } | null>(null)
  const [isExpanded, setIsExpanded] = useState(false)

  // Edit/Menu state
  const [showMenu, setShowMenu] = useState(false)
  const [isEditingPost, setIsEditingPost] = useState(false)
  const [editContent, setEditContent] = useState(post.content)
  const [editTitle, setEditTitle] = useState(post.title || '')
  const [isSaving, setIsSaving] = useState(false)
  const [isMuted, setIsMuted] = useState(true)

  const isPostOwner = user?.id === post.user_id
  const isHiring = post.category === 'hiring'
  const isProject = post.category === 'project'
  const isWorkshop = post.category === 'workshop'

  const comments = activeComments[post.id] || []
  const isLoadingComments = loadingComments[post.id]

  const toggleComments = () => {
    if (!showComments) fetchComments(post.id)
    setShowComments(!showComments)
  }

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!commentText.trim() || submitting) return
    setSubmitting(true)
    const { error } = await addComment(post.id, commentText, replyingTo?.id)
    if (!error) { setCommentText(''); setReplyingTo(null) }
    else alert(`Could not send comment: ${error}`)
    setSubmitting(false)
  }

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrollLeft = e.currentTarget.scrollLeft
    const width = e.currentTarget.offsetWidth
    const index = Math.round(scrollLeft / width)
    if (index !== activeMediaIndex) setActiveMediaIndex(index)
  }

  const scrollToIndex = (index: number) => {
    if (scrollRef.current) {
      const width = scrollRef.current.offsetWidth
      scrollRef.current.scrollTo({ left: index * width, behavior: 'smooth' })
    }
  }

  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this post?')) {
      await deletePost(post.id)
    }
    setShowMenu(false)
  }

  const handleSaveEdit = async () => {
    if (!editContent.trim()) return
    setIsSaving(true)
    await updatePost(post.id, { content: editContent, title: editTitle })
    setIsSaving(false)
    setIsEditingPost(false)
  }

  return (
    <div className="relative group w-full md:max-w-2xl xl:max-w-3xl md:mx-auto bg-[#0e0e0e] md:border border-white/[0.03] md:rounded-[1.5rem] overflow-hidden transition-all duration-300 pb-2" style={{boxShadow:'0 8px 40px rgba(0,0,0,0.5)'}}>
      {fullscreenMedia && (
        <div 
          className="fixed inset-0 z-[500] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4 md:p-12"
          onClick={() => setFullscreenMedia(null)}
        >
          <button className="absolute top-6 right-6 z-[600] p-3 bg-white/[0.06] hover:bg-white/[0.1] rounded-full text-white transition-all border border-white/[0.06]"
            onClick={(e) => { e.stopPropagation(); setFullscreenMedia(null); }}
          >
            <X className="w-6 h-6" />
          </button>
          <div className="relative w-full h-full flex items-center justify-center max-w-6xl" onClick={(e) => e.stopPropagation()}>
            {fullscreenMedia.type === 'video' ? (
              <video src={fullscreenMedia.url} controls autoPlay className="max-w-full max-h-full rounded-xl" />
            ) : (
              <div className="relative w-full h-full"><Image src={fullscreenMedia.url} alt="Fullscreen" fill unoptimized className="object-contain" /></div>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <div className="w-10 h-10 rounded-full overflow-hidden border border-[#bc9dff]/20">
              {post.user?.avatar_url ? (
                <img src={post.user.avatar_url} alt="User" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full primary-gradient flex items-center justify-center font-bold text-white uppercase text-sm">
                  {post.user?.name?.[0] || '?'}
                </div>
              )}
            </div>
            {post.user?.role === 'professional' && (
              <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-[#5e289b] rounded-full flex items-center justify-center text-[8px] text-white border border-[#0e0e0e]">✔</span>
            )}
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5 leading-tight">
              <span className="font-headline text-white text-sm hover:text-[#bc9dff] cursor-pointer transition-colors">{post.user?.name}</span>
              <span className="text-[#adaaaa] text-[11px] ml-1">· {new Date(post.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
            </div>
            {post.category && (
              <span className="text-[10px] text-[#bc9dff]/60 font-medium uppercase tracking-wider">
                {post.category.replace('_', ' ')}
              </span>
            )}
          </div>
        </div>
        
        {isPostOwner && (
          <div className="relative">
            <button onClick={() => setShowMenu(!showMenu)} className="p-2 text-white hover:text-zinc-300">
              <span className="flex gap-1">
                <span className="w-1 h-1 bg-current rounded-full"></span>
                <span className="w-1 h-1 bg-current rounded-full"></span>
                <span className="w-1 h-1 bg-current rounded-full"></span>
              </span>
            </button>
            {showMenu && (
              <div className="absolute right-0 top-10 w-32 bg-[#1a1a1a] rounded-xl shadow-xl border border-white/[0.06] overflow-hidden z-[50]">
                <button onClick={() => { setIsEditingPost(true); setShowMenu(false); }} className="w-full text-left px-4 py-2.5 text-sm text-white hover:bg-white/[0.04] transition-colors">Edit Post</button>
                <div className="w-full h-px bg-white/[0.04]"></div>
                <button onClick={handleDelete} className="w-full text-left px-4 py-2.5 text-sm text-red-500 font-bold hover:bg-white/[0.04] transition-colors">Delete</button>
              </div>
            )}
          </div>
        )}
      </div>

      {isEditingPost && (
        <div className="px-4 pb-4">
          {editTitle !== '' && (
            <input 
              value={editTitle} 
              onChange={e => setEditTitle(e.target.value)} 
              className="w-full bg-white/[0.03] text-white text-sm font-bold p-3 rounded-lg border border-white/[0.06] mb-2 focus:border-white/20 outline-none"
              placeholder="Title"
            />
          )}
          <textarea 
            value={editContent} 
            onChange={e => setEditContent(e.target.value)} 
            className="w-full bg-white/[0.03] text-white text-sm p-3 rounded-lg border border-white/[0.06] min-h-[100px] focus:border-white/20 outline-none mb-2"
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => setIsEditingPost(false)} className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white font-medium">Cancel</button>
            <button onClick={handleSaveEdit} disabled={isSaving} className="px-3 py-1.5 text-xs bg-white text-black font-bold uppercase rounded hover:bg-zinc-200 disabled:opacity-50">
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}

      {/* Media Carousel — Nocturnal style */}
      {post.media_urls && post.media_urls.length > 0 && (
        <div className="relative w-full bg-[#0a0a0a] flex items-center justify-center group/carousel overflow-hidden md:rounded-[1.5rem] my-0 md:my-2">
          <div 
            ref={scrollRef} onScroll={handleScroll}
            className="w-full max-h-[85vh] overflow-x-auto overflow-y-hidden flex snap-x snap-mandatory no-scrollbar"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {post.media_urls.map((url: string, idx: number) => (
              <div key={url} className="relative min-w-full h-auto snap-center flex items-center justify-center cursor-zoom-in"
                onClick={() => setFullscreenMedia({ url, type: post.media_types?.[idx] || 'image' })}
              >
                {post.media_types?.[idx] === 'video' ? (
                  <div className="relative w-full h-full flex items-center justify-center group/video">
                    <video 
                      src={url} 
                      autoPlay 
                      muted={isMuted} 
                      loop 
                      playsInline 
                      className="w-full h-auto max-h-[85vh] object-contain" 
                    />
                    <button 
                      onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted); }}
                      className="absolute bottom-4 right-4 p-2 bg-black/40 hover:bg-black/60 rounded-full text-white backdrop-blur-md transition-all z-20 shadow-xl border border-white/10 flex items-center justify-center"
                      title={isMuted ? "Unmute" : "Mute"}
                    >
                      {isMuted ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z"></path><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>
                      ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
                      )}
                    </button>
                    <div className="hidden absolute inset-0 flex items-center justify-center bg-black/10 group-hover/video:bg-black/40 transition-all">
                      <Play className="w-12 h-12 text-white/80 fill-white/20 drop-shadow-xl" />
                    </div>
                  </div>
                ) : (
                  <img src={url} alt={`Media ${idx + 1}`} className="w-full h-auto max-h-[85vh] object-contain" />
                )}
              </div>
            ))}
          </div>

          {post.media_urls.length > 1 && (
            <>
              {activeMediaIndex > 0 && (
                <button onClick={() => scrollToIndex(activeMediaIndex - 1)} className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 bg-black/40 hover:bg-black/60 rounded-full text-white backdrop-blur-md transition-all z-10 opacity-0 group-hover/carousel:opacity-100 shadow-xl">
                  <ChevronLeft className="w-5 h-5" />
                </button>
              )}
              {activeMediaIndex < post.media_urls.length - 1 && (
                <button onClick={() => scrollToIndex(activeMediaIndex + 1)} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-black/40 hover:bg-black/60 rounded-full text-white backdrop-blur-md transition-all z-10 opacity-0 group-hover/carousel:opacity-100 shadow-xl">
                  <ChevronRight className="w-5 h-5" />
                </button>
              )}
              <div className="absolute top-4 right-4 px-2.5 py-1 rounded-full bg-black/60 text-white text-[10px] font-bold backdrop-blur-md shadow-lg pointer-events-none">
                {activeMediaIndex + 1} / {post.media_urls.length}
              </div>
            </>
          )}
        </div>
      )}

      {/* Title & Description for Text-Only posts */}
      {(!post.media_urls || post.media_urls.length === 0) && !isEditingPost && (
        <div className="px-5 py-6 mx-3 my-2 rounded-[1.25rem]" style={{background:'linear-gradient(135deg, #1a1a1a 0%, #0e0e0e 100%)', border:'1px solid rgba(188,157,255,0.08)'}}>
          {post.title && <h3 className="font-headline text-white text-xl mb-3 leading-tight">{post.title}</h3>}
          <p className="text-[#adaaaa] text-sm leading-relaxed whitespace-pre-wrap">
            {!isExpanded && post.content && post.content.length > 200 ? (
              <>
                {post.content.slice(0, 200)}...
                <button onClick={() => setIsExpanded(true)} className="text-[#bc9dff] font-medium ml-1">more</button>
              </>
            ) : (
              post.content
            )}
          </p>
        </div>
      )}

      {/* Quoted Post Box */}
      {post.quoted_post_id && (
        <div className="px-5 pb-2">
          {post.quoted_post ? (
            <div className="rounded-[1rem] p-4 bg-white/[0.02] border border-white/[0.08] hover:bg-white/[0.03] transition-colors cursor-pointer group/quote shadow-inner relative overflow-hidden" 
              onClick={() => {
                 // Option to navigate or expand quoted post in future
              }}>
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#bc9dff]/50"></div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full overflow-hidden bg-white/10 shrink-0">
                    {post.quoted_post.user?.avatar_url ? (
                      <img src={post.quoted_post.user.avatar_url} alt="User" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-[8px] font-bold text-white bg-[#bc9dff]/30 uppercase">
                        {post.quoted_post.user?.name?.[0] || '?'}
                      </div>
                    )}
                  </div>
                  <span className="text-white text-xs font-bold hover:text-[#bc9dff] transition-colors">
                    {post.quoted_post.user?.name}
                  </span>
                  <span className="text-zinc-500 text-[10px]">· {new Date(post.quoted_post.created_at).toLocaleDateString()}</span>
                </div>
                <div className="text-zinc-300 text-xs leading-relaxed line-clamp-3 pl-1">
                  {post.quoted_post.content || 'Attached Media'}
                </div>
                {post.quoted_post.media_urls && post.quoted_post.media_urls.length > 0 && (
                  <div className="mt-2 w-full h-32 rounded-lg overflow-hidden relative">
                    {post.quoted_post.media_types?.[0] === 'video' ? (
                       <video src={post.quoted_post.media_urls[0]} className="w-full h-full object-cover pointer-events-none" />
                    ) : (
                       <img src={post.quoted_post.media_urls[0]} alt="Quote Media" className="w-full h-full object-cover" />
                    )}
                    {post.quoted_post.media_urls.length > 1 && (
                      <div className="absolute top-2 right-2 bg-black/60 px-2 py-0.5 rounded text-[9px] text-white font-bold backdrop-blur-sm">
                        1/{post.quoted_post.media_urls.length}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-[1rem] p-4 bg-white/[0.02] border border-[#ff4d4d]/20 shadow-inner flex items-center gap-3">
               <AlertCircle className="w-5 h-5 text-[#ff4d4d]/60" />
               <div>
                  <p className="text-[#ff4d4d]/80 text-sm font-bold">Post unavailable</p>
                  <p className="text-zinc-500 text-[11px]">This post was deleted by the author.</p>
               </div>
            </div>
          )}
        </div>
      )}

      {/* Interaction Bar */}
      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-5">
          <button 
            onClick={(e) => { e.stopPropagation(); onLike(); }}
            className={`transition-all active:scale-90 group/btn`}
          >
            <Heart className={`w-6 h-6 transition-colors ${post.is_liked ? 'fill-[#ff97b8] text-[#ff97b8]' : 'text-[#adaaaa] hover:text-[#ff97b8] group-hover/btn:text-[#ff97b8]'}`} />
          </button>
          <button 
            onClick={toggleComments}
            className="transition-all active:scale-90 text-[#adaaaa] hover:text-[#bc9dff]"
          >
            <MessageCircle className="w-6 h-6 -scale-x-100" />
          </button>
          {!isPostOwner && onStartChat && (
            <button 
              onClick={(e) => { e.stopPropagation(); onStartChat(post.user_id, post); }}
              className="transition-all active:scale-90 text-[#adaaaa] hover:text-[#bc9dff]"
            >
              <Send className="w-[22px] h-[22px] -mt-0.5 -rotate-[20deg]" />
            </button>
          )}
          <button 
            onClick={(e) => { e.stopPropagation(); onQuote(post); }}
            className="transition-all active:scale-90 text-[#adaaaa] hover:text-[#bc9dff] group-hover/btn:text-[#bc9dff]"
            title="Quote this post"
          >
            <RefreshCw className="w-[22px] h-[22px]" />
          </button>
        </div>
        <div className="flex justify-center flex-1">
        </div>
        <button className="text-[#adaaaa] hover:text-[#bc9dff] active:scale-90 transition-all">
          <Share2 className="w-6 h-6" />
        </button>
      </div>

      {/* Carousel dots — centered below media, Instagram style */}
      {post.media_urls && post.media_urls.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 pb-1 -mt-1">
          {post.media_urls.map((_: string, i: number) => {
            const total = post.media_urls.length
            const isActive = i === activeMediaIndex
            // Instagram compact: show small dots for non-adjacent when > 5
            const distFromActive = Math.abs(i - activeMediaIndex)
            const isVisible = total <= 5 || distFromActive <= 2
            const isTiny = total > 5 && distFromActive === 2
            if (!isVisible) return null
            return (
              <div
                key={i}
                className="rounded-full transition-all duration-300"
                style={{
                  width: isActive ? '16px' : isTiny ? '4px' : '6px',
                  height: isActive ? '6px' : isTiny ? '4px' : '6px',
                  backgroundColor: isActive ? '#bc9dff' : '#484847',
                  opacity: isTiny ? 0.5 : 1,
                }}
              />
            )
          })}
        </div>
      )}

      {/* Likes Count */}
      <div className="px-4 mb-1.5">
        <span className="font-headline text-[13px] text-white cursor-pointer">{post.likes_count} likes</span>
      </div>

      {/* Title & Description with Media */}
      {post.media_urls && post.media_urls.length > 0 && (post.title || post.content) && !isEditingPost && (
        <div className="px-4 mb-2">
          <p className="text-[13px] text-[#ffffff] leading-tight whitespace-pre-wrap">
            <span className="font-headline text-white mr-1.5 cursor-pointer hover:text-[#bc9dff] transition-colors">{post.user?.name}</span>
            {post.title && <span className="font-medium mr-1">{post.title}</span>}
            {!isExpanded && post.content && post.content.length > 100 ? (
              <>
                <span className="text-[#adaaaa]">{post.content.slice(0, 100)}...</span>
                <button onClick={() => setIsExpanded(true)} className="text-[#bc9dff] font-medium ml-1">more</button>
              </>
            ) : (
              <span className="text-[#adaaaa]">{post.content}</span>
            )}
          </p>
        </div>
      )}

      {/* Comments Preview / Toggle */}
      {(post.comments_count > 0 || showComments) && (
        <div className="px-4 mb-2 flex items-center justify-between">
          {!showComments ? (
            <button onClick={toggleComments} className="text-[13px] text-[#adaaaa] font-medium hover:text-white transition-colors">
              View all {post.comments_count} {post.comments_count === 1 ? 'comment' : 'comments'}
            </button>
          ) : (
            <button 
              onClick={toggleComments}
              className="flex items-center gap-1.5 text-[11px] uppercase font-bold text-[#bc9dff] tracking-wider hover:text-white transition-colors"
            >
              <ChevronUp className="w-3.5 h-3.5" />
              Hide comments
            </button>
          )}
        </div>
      )}

      {/* Inline Add Comment */}
      <form onSubmit={handleAddComment} className="px-4 mt-1 pb-2 flex items-center gap-3">
        <div className="w-7 h-7 rounded-full overflow-hidden shrink-0" style={{border:'1px solid rgba(188,157,255,0.2)'}}>
          {user?.user_metadata?.avatar_url ? (
            <img src={user.user_metadata.avatar_url} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full primary-gradient flex items-center justify-center text-[9px] text-white font-bold uppercase">{user?.user_metadata?.name?.[0] || 'U'}</div>
          )}
        </div>
        <input 
          type="text" 
          placeholder="Add a comment..."
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          className="flex-1 bg-transparent text-[13px] text-white placeholder-[#adaaaa] outline-none"
        />
        {commentText.trim() && (
          <button 
            type="submit"
            disabled={submitting}
            className="text-[#bc9dff] font-bold text-[13px] px-1 disabled:opacity-50 transition-opacity"
          >
            {submitting ? '...' : 'Post'}
          </button>
        )}
      </form>

      {/* Expanded Comments List */}
      {showComments && comments.length > 0 && (
        <div className="px-3.5 mt-2 pt-3 border-t border-white/[0.04] space-y-3 max-h-60 overflow-y-auto custom-scrollbar">
          {isLoadingComments ? (
            <div className="flex justify-center py-2"><Loader2 className="w-4 h-4 text-zinc-500 animate-spin" /></div>
          ) : (
            comments.map((comment: PostComment) => (
              <div key={comment.id} className="flex gap-2.5">
                <div className="relative w-7 h-7 rounded-full overflow-hidden border border-white/[0.04] shrink-0 mt-0.5 pointer-events-none">
                  {comment.user?.avatar_url ? (
                    <img src={comment.user.avatar_url} alt="User" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-tr from-zinc-800 to-zinc-600 flex items-center justify-center text-[10px] font-bold text-white">
                      {comment.user?.name?.[0] || '?'}
                    </div>
                  )}
                </div>
                <div className="flex-1 flex flex-col pt-0.5">
                  <div className="text-[13px] leading-tight">
                    <span className="text-white font-bold mr-1.5 cursor-pointer">{comment.user?.name}</span>
                    <span className="text-zinc-200">{comment.content}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-[11px] text-zinc-500 font-medium">
                    <span>{new Date(comment.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                    {isPostOwner && (
                      <button onClick={() => {
                        setCommentText(`@${comment.user?.name} `)
                      }} className="hover:text-zinc-300">Reply</button>
                    )}
                  </div>
                </div>
                <button className="self-start pt-1 px-1 text-zinc-600 hover:text-white"><Heart className="w-3 h-3" /></button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
