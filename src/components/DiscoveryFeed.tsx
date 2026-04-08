'use client'

import { usePosts, Post, PostComment } from '@/hooks/usePosts'
import { Heart, MessageCircle, Share2, Plus, Briefcase, Rocket, Lightbulb, GraduationCap, Clock, Send, Loader2, X, Play, ChevronLeft, ChevronRight } from 'lucide-react'
import Image from 'next/image'
import { useState, useRef } from 'react'
import { useAuth } from '@/context/AuthContext'
import CreatePostModal from './CreatePostModal'

interface DiscoveryFeedProps {
  onStartChat?: (userId: string, post?: Post) => void
  filterUserId?: string
  onClearFilter?: () => void
  onBack?: () => void
}

export default function DiscoveryFeed({ onStartChat, filterUserId, onClearFilter, onBack }: DiscoveryFeedProps) {
  const { posts, loading, toggleLike, fetchComments, activeComments, loadingComments, addComment } = usePosts(filterUserId)
  const [showCreateModal, setShowCreateModal] = useState(false)

  if (loading && posts.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-[#111b21]">
        <div className="w-12 h-12 border-4 border-[#00a884] border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-[#8696a0] font-medium animate-pulse">Scanning the community...</p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[#111b21] relative w-full">
      {/* Header */}
      <div className="w-full h-[60px] px-4 md:px-6 bg-[#202c33]/50 backdrop-blur-md border-b border-white/5 flex items-center justify-between sticky top-0 z-20 shrink-0">
        <div className="flex items-center gap-4">
          {onBack && (
            <button onClick={onBack} className="md:hidden p-1 hover:bg-white/5 rounded-full text-[#8696a0]">
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}
          <div>
            <h1 className="text-[#e9edef] text-lg md:text-xl font-black tracking-tight flex items-center gap-2">
              {filterUserId ? 'Achievements' : 'Discovery'}
              <span className={`w-2 h-2 ${filterUserId ? 'bg-[#3b82f6] shadow-[0_0_10px_#3b82f6]' : 'bg-[#00a884] shadow-[0_0_10px_#00a884]'} rounded-full animate-pulse`}></span>
            </h1>
            <p className="text-[#8696a0] text-[9px] md:text-[10px] uppercase font-black tracking-widest mt-0.5">
              {filterUserId ? 'Individual Tech Journey' : 'Community Achievements'}
            </p>
          </div>
        </div>
        {filterUserId ? (
          <button 
            onClick={onClearFilter}
            className="flex items-center gap-2 text-[#8696a0] hover:text-[#e9edef] transition-colors font-bold text-xs uppercase cursor-pointer"
          >
            <X className="w-4 h-4" />
            Back to Global
          </button>
        ) : (
          <button 
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2.5 bg-[#00a884] hover:bg-[#00c99e] text-[#111b21] px-3 md:px-5 py-2.5 rounded-full font-black text-[11px] uppercase tracking-widest transition-all shadow-lg active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Post Achievement</span>
          </button>
        )}
      </div>

      {filterUserId && posts.length > 0 && (
        <div className="w-full px-6 py-3 bg-[#3b82f6]/10 border-b border-[#3b82f6]/20 flex items-center gap-3 shrink-0">
          <Rocket className="w-4 h-4 text-[#3b82f6]" />
          <p className="text-[#3b82f6] text-[11px] font-bold uppercase tracking-widest">
            Viewing achievements by <span className="text-[#e9edef]">{posts[0].user?.name}</span>
          </p>
        </div>
      )}

      {/* Feed Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar w-full p-0 md:p-6 pb-32">
        <div className="max-w-5xl mx-auto space-y-4 md:space-y-8 p-4 md:p-0">
          {posts.length === 0 && !loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
              <div className="p-6 bg-[#202c33] rounded-3xl border border-white/5">
                <Rocket className="w-12 h-12 text-[#8696a0] opacity-20" />
              </div>
              <div>
                <p className="text-[#e9edef] font-bold text-lg">No achievements yet</p>
                <p className="text-[#8696a0] text-sm">Be the first to share your tech journey!</p>
              </div>
            </div>
          ) : (
            posts.map(post => (
              <PostCard 
                key={post.id} 
                post={post} 
                onLike={() => toggleLike(post.id, !!post.is_liked)}
                fetchComments={fetchComments}
                activeComments={activeComments}
                loadingComments={loadingComments}
                addComment={addComment}
                onStartChat={onStartChat}
              />
            ))
          )}
        </div>
      </div>

      {showCreateModal && <CreatePostModal onClose={() => setShowCreateModal(false)} />}
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
  onStartChat?: (userId: string, post?: Post) => void
}

function PostCard({ post, onLike, fetchComments, activeComments, loadingComments, addComment, onStartChat }: PostCardProps) {
  const { user } = useAuth()
  const [showComments, setShowComments] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [activeMediaIndex, setActiveMediaIndex] = useState(0)
  const [replyingTo, setReplyingTo] = useState<PostComment | null>(null)
  const [fullscreenMedia, setFullscreenMedia] = useState<{ url: string, type: string } | null>(null)

  const isPostOwner = user?.id === post.user_id
  const isHiring = post.category === 'hiring'
  const isProject = post.category === 'project'
  const isWorkshop = post.category === 'workshop'

  const comments = activeComments[post.id] || []
  const isLoadingComments = loadingComments[post.id]

  const toggleComments = () => {
    if (!showComments) {
      fetchComments(post.id)
    }
    setShowComments(!showComments)
  }

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!commentText.trim() || submitting) return

    setSubmitting(true)
    const { error } = await addComment(post.id, commentText, replyingTo?.id)
    if (!error) {
      setCommentText('')
      setReplyingTo(null)
    } else {
      alert(`Could not send comment: ${error}`)
    }
    setSubmitting(false)
  }

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const scrollLeft = e.currentTarget.scrollLeft
    const width = e.currentTarget.offsetWidth
    const index = Math.round(scrollLeft / width)
    if (index !== activeMediaIndex) {
      setActiveMediaIndex(index)
    }
  }

  const scrollToIndex = (index: number) => {
    if (scrollRef.current) {
      const width = scrollRef.current.offsetWidth
      scrollRef.current.scrollTo({
        left: index * width,
        behavior: 'smooth'
      })
    }
  }

  return (
    <div className={`
      relative group bg-[#202c33] md:rounded-2xl overflow-hidden shadow-xl transition-all duration-300 hover:shadow-2xl border-b md:border border-white/5
      ${isHiring ? 'border-[#00a884]/30' : ''}
    `}>
      {/* Cinematic Fullscreen Overlay ... */}
      {fullscreenMedia && (
        <div 
          className="fixed inset-0 z-[500] bg-black/95 backdrop-blur-2xl flex items-center justify-center p-4 md:p-12 animate-in fade-in zoom-in duration-300"
          onClick={() => setFullscreenMedia(null)}
        >
          <button 
            className="absolute top-6 right-6 z-[600] p-3 bg-black/50 hover:bg-white/10 rounded-full text-white transition-all active:scale-90 border border-white/10 backdrop-blur-md"
            onClick={(e) => {
              e.stopPropagation();
              setFullscreenMedia(null);
            }}
          >
            <X className="w-8 h-8" />
          </button>
          
          <div className="relative w-full h-full flex items-center justify-center max-w-6xl" onClick={(e) => e.stopPropagation()}>
            {fullscreenMedia.type === 'video' ? (
              <video src={fullscreenMedia.url} controls autoPlay className="max-w-full max-h-full rounded-2xl shadow-2xl" />
            ) : (
              <div className="relative w-full h-full">
                <Image 
                  src={fullscreenMedia.url} 
                  alt="Fullscreen view" 
                  fill 
                  unoptimized 
                  className="object-contain"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Category Gradient Overlay (Subtle) ... */}
      <div className={`absolute top-0 right-0 w-32 h-32 opacity-10 blur-3xl rounded-full -mr-16 -mt-16 pointer-events-none 
        ${isHiring ? 'bg-[#00a884]' : isProject ? 'bg-[#3b82f6]' : 'bg-[#a855f7]'}`} 
      />

      <div className="p-4 relative">
        {/* Header ... */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-white/10 shrink-0">
              {post.user?.avatar_url ? (
                <img src={post.user.avatar_url} alt="User" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-[#374248] flex items-center justify-center font-bold text-[#8696a0] uppercase">
                  {post.user?.name?.[0] || '?'}
                </div>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[#e9edef] font-bold text-sm tracking-tight">{post.user?.name}</span>
                <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded tracking-widest 
                  ${post.user?.role === 'company' ? 'bg-[#00a884]/20 text-[#00a884]' : 'bg-[#8696a0]/20 text-[#8696a0]'}`}>
                  {post.user?.role || 'user'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-[#8696a0]">
                <Clock className="w-3 h-3" />
                {new Date(post.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
              </div>
            </div>
          </div>
          
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider
            ${isHiring ? 'bg-[#00a884]/20 text-[#00a884]' : 
              isProject ? 'bg-[#3b82f6]/20 text-[#3b82f6]' : 
              isWorkshop ? 'bg-[#a855f7]/20 text-[#a855f7]' : 'bg-[#374248] text-[#8696a0]'}`}>
            {isHiring && <Briefcase className="w-3 h-3" />}
            {isProject && <Rocket className="w-3 h-3" />}
            {isWorkshop && <GraduationCap className="w-3 h-3" />}
            {!isHiring && !isProject && !isWorkshop && <Lightbulb className="w-3 h-3" />}
            {post.category?.replace('_', ' ')}
          </div>
        </div>

        {/* Content */}
        {post.title && <h3 className="text-[#e9edef] font-bold text-lg mb-2 leading-tight drop-shadow-md">{post.title}</h3>}
        <p className="text-[#8696a0] text-sm leading-relaxed mb-4 whitespace-pre-wrap">{post.content}</p>

        {/* Multi-Media Carousel */}
        {post.media_urls && post.media_urls.length > 0 && (
          <div className="relative mb-4 group/carousel">
            <div 
              ref={scrollRef}
              onScroll={handleScroll}
              className="relative aspect-video rounded-xl overflow-x-auto overflow-y-hidden flex snap-x snap-mandatory bg-[#1a2227] border border-white/5 no-scrollbar"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {post.media_urls.map((url: string, idx: number) => (
                <div 
                  key={url} 
                  className="relative min-w-full h-full snap-center flex items-center justify-center cursor-zoom-in"
                  onClick={() => setFullscreenMedia({ url, type: post.media_types?.[idx] || 'image' })}
                >
                  {post.media_types?.[idx] === 'video' ? (
                    <div className="relative w-full h-full group/video">
                      <video src={url} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover/video:bg-black/40 transition-all">
                        <Play className="w-12 h-12 text-white/80 fill-white/20" />
                      </div>
                    </div>
                  ) : (
                    <Image 
                      src={url} 
                      alt={`Post media ${idx + 1}`} 
                      fill 
                      unoptimized
                      className="object-cover hover:scale-105 transition-transform duration-700"
                      sizes="(max-width: 768px) 100vw, 50vw"
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Navigation Arrows */}
            {post.media_urls.length > 1 && (
              <>
                {activeMediaIndex > 0 && (
                  <button 
                    onClick={() => scrollToIndex(activeMediaIndex - 1)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/40 hover:bg-black/60 rounded-full text-white backdrop-blur-md transition-all active:scale-90 z-10 opacity-0 group-hover/carousel:opacity-100"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                )}
                {activeMediaIndex < post.media_urls.length - 1 && (
                  <button 
                    onClick={() => scrollToIndex(activeMediaIndex + 1)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/40 hover:bg-black/60 rounded-full text-white backdrop-blur-md transition-all active:scale-90 z-10 opacity-0 group-hover/carousel:opacity-100"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                )}
              </>
            )}

            {/* Carousel Dots */}
            {post.media_urls.length > 1 && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 px-2 py-1 rounded-full bg-black/40 backdrop-blur-md">
                {post.media_urls.map((_: string, idx: number) => (
                  <div 
                    key={idx}
                    className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${idx === activeMediaIndex ? 'bg-[#00a884] w-3' : 'bg-white/40'}`}
                  />
                ))}
              </div>
            )}

            {/* Slide Indicator */}
            {post.media_urls.length > 1 && (
              <div className="absolute top-3 right-3 px-2 py-1 rounded-md bg-black/60 text-white text-[10px] font-bold backdrop-blur-sm opacity-0 group-hover/carousel:opacity-100 transition-opacity">
                {activeMediaIndex + 1} / {post.media_urls.length}
              </div>
            )}
          </div>
        )}

        {/* Interaction Bar */}
        <div className="flex items-center justify-between pt-2 border-t border-white/5">
          <div className="flex items-center gap-6">
            <button 
              onClick={(e) => { e.stopPropagation(); onLike(); }}
              className={`flex items-center gap-2 transition-all active:scale-95 ${post.is_liked ? 'text-[#ef4444]' : 'text-[#8696a0] hover:text-[#e9edef]'}`}
            >
              <Heart className={`w-5 h-5 ${post.is_liked ? 'fill-[#ef4444] animate-bounce-short' : ''}`} />
              <span className="text-xs font-bold">{post.likes_count}</span>
            </button>
            <button 
              onClick={toggleComments}
              className={`flex items-center gap-2 transition-all active:scale-95 ${showComments ? 'text-[#00a884]' : 'text-[#8696a0] hover:text-[#e9edef]'}`}
            >
              <MessageCircle className={`w-5 h-5 ${showComments ? 'fill-[#00a884]/20' : ''}`} />
              <span className="text-xs font-bold">{post.comments_count}</span>
            </button>
            {!isPostOwner && onStartChat && (
              <button 
                onClick={(e) => { e.stopPropagation(); onStartChat(post.user_id, post); }}
                className="flex items-center gap-2 text-[#8696a0] hover:text-[#3b82f6] transition-all active:scale-95 group/dm"
                title="Message author"
              >
                <Send className="w-5 h-5 group-hover/dm:fill-[#3b82f6]/10" />
                <span className="text-xs font-bold">Message</span>
              </button>
            )}
          </div>
          <button className="p-2 text-[#8696a0] hover:text-[#e9edef] rounded-full hover:bg-white/5 transition-all">
            <Share2 className="w-5 h-5" />
          </button>
        </div>

        {/* Comments Section */}
        {showComments && (
          <div className="mt-4 pt-4 border-t border-white/5 space-y-4 animate-in slide-in-from-top-2 duration-300">
            {/* Comment List */}
            <div className="space-y-3 max-h-60 overflow-y-auto custom-scrollbar pr-2">
              {isLoadingComments ? (
                <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 text-[#00a884] animate-spin" /></div>
              ) : comments.length === 0 ? (
                <p className="text-center text-[#8696a0] text-xs italic py-2">No comments yet. Start the conversation!</p>
              ) : (
                comments.map((comment: PostComment) => (
                  <div key={comment.id} className="flex gap-3 animate-in fade-in duration-300">
                    <div className="relative w-7 h-7 rounded-full overflow-hidden border border-white/10 shrink-0 mt-1">
                      {comment.user?.avatar_url ? (
                        <img src={comment.user.avatar_url} alt="User" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-[#374248] flex items-center justify-center text-[10px] font-bold text-[#8696a0]">
                          {comment.user?.name?.[0] || '?'}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 bg-[#2a3942] rounded-2xl px-3 py-2 flex flex-col gap-1">
                      {comment.replied_to && (
                        <div className="mb-1 p-1.5 px-2 bg-black/20 border-l-2 border-[#00a884] rounded text-[10px] flex flex-col gap-0.5 opacity-80">
                           <span className="text-[#00a884] font-bold">@{comment.replied_to.profiles?.name || 'Someone'}</span>
                           <p className="text-[#8696a0] truncate italic">"{comment.replied_to.content}"</p>
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-[#e9edef] font-bold text-[11px] leading-none">{comment.user?.name}</span>
                        <div className="flex items-center gap-2">
                           <span className="text-[#8696a0] text-[9px]">{new Date(comment.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                           {isPostOwner && (
                             <button 
                               onClick={() => setReplyingTo(comment)}
                               className="text-[#00a884] hover:text-[#00c99e] text-[10px] font-bold transition-colors"
                             >
                               Reply
                             </button>
                           )}
                        </div>
                      </div>
                      <p className="text-[#d1d7db] text-xs leading-relaxed">{comment.content}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Comment Input */}
            <div className="space-y-0.5">
              {replyingTo && (
                <div className="flex items-center justify-between px-3 py-1.5 bg-black/40 rounded-t-xl border-l-4 border-[#00a884] animate-in slide-in-from-bottom-2 duration-200">
                   <div className="flex flex-col min-w-0 pr-4">
                      <span className="text-[#00a884] text-[11px] font-bold uppercase truncate">Replying to {replyingTo.user?.name}</span>
                      <p className="text-[#8696a0] text-[10px] truncate italic">"{replyingTo.content}"</p>
                   </div>
                   <button onClick={() => setReplyingTo(null)} className="p-1 hover:bg-white/10 rounded-full text-[#8696a0]"><X className="w-4 h-4" /></button>
                </div>
              )}
              <form onSubmit={handleAddComment} className="relative flex items-center gap-2">
                <input 
                  type="text" 
                  placeholder={replyingTo ? "Write a reply..." : "Write a comment..."}
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  className={`flex-1 bg-[#2a3942] border-none text-[#e9edef] text-sm py-2 pl-4 pr-10 focus:ring-1 focus:ring-[#00a884] placeholder-[#8696a0] ${replyingTo ? 'rounded-b-xl rounded-t-none' : 'rounded-xl'}`}
                />
                <button 
                  type="submit"
                  disabled={!commentText.trim() || submitting}
                  className="absolute right-2 p-1.5 text-[#00a884] hover:bg-[#00a884]/10 rounded-lg disabled:opacity-30 transition-all font-bold"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
