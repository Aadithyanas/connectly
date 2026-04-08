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
  const { posts, loading, toggleLike, fetchComments, activeComments, loadingComments, addComment, updatePost, deletePost } = usePosts(filterUserId)
  const [showCreateModal, setShowCreateModal] = useState(false)

  if (loading && posts.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-black">
        <div className="w-10 h-10 border-2 border-white border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-zinc-600 font-medium animate-pulse text-sm">Loading feed...</p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-black relative w-full">
      {/* Header */}
      <div className="w-full h-[56px] px-4 md:px-6 bg-[#0a0a0a] border-b border-white/[0.04] flex items-center justify-between sticky top-0 z-20 shrink-0">
        <div className="flex items-center gap-4">
          {onBack && (
            <button onClick={onBack} className="md:hidden p-1 hover:bg-white/[0.06] rounded-full text-zinc-500">
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h1 className="text-white text-base md:text-lg font-bold tracking-tight flex items-center gap-2">
              {filterUserId ? 'Achievements' : 'Discovery'}
              <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
            </h1>
            <p className="text-zinc-600 text-[9px] uppercase font-bold tracking-widest mt-0.5">
              {filterUserId ? 'Individual Journey' : 'Community Feed'}
            </p>
          </div>
        </div>
        {filterUserId ? (
          <button 
            onClick={onClearFilter}
            className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors font-bold text-xs uppercase cursor-pointer"
          >
            <X className="w-4 h-4" />
            Back
          </button>
        ) : (
          <button 
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-white hover:bg-zinc-200 text-black px-3 md:px-5 py-2 rounded-full font-bold text-[11px] uppercase tracking-widest transition-all active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Post</span>
          </button>
        )}
      </div>

      {filterUserId && posts.length > 0 && (
        <div className="w-full px-6 py-2.5 bg-white/[0.02] border-b border-white/[0.04] flex items-center gap-3 shrink-0">
          <Rocket className="w-3.5 h-3.5 text-zinc-500" />
          <p className="text-zinc-500 text-[11px] font-bold uppercase tracking-widest">
            Viewing posts by <span className="text-white">{posts[0].user?.name}</span>
          </p>
        </div>
      )}

      {/* Feed Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar w-full p-0 md:p-6 pb-32">
        <div className="max-w-5xl mx-auto space-y-0 md:space-y-6 md:p-0">
          {posts.length === 0 && !loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
              <div className="p-6 bg-white/[0.03] rounded-2xl border border-white/[0.04]">
                <Rocket className="w-10 h-10 text-zinc-700" />
              </div>
              <div>
                <p className="text-white font-bold text-lg">No posts yet</p>
                <p className="text-zinc-600 text-sm">Be the first to share!</p>
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
                updatePost={updatePost}
                deletePost={deletePost}
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
  updatePost: (postId: string, payload: { title?: string, content: string }) => Promise<any>
  deletePost: (postId: string) => Promise<any>
  onStartChat?: (userId: string, post?: Post) => void
}

function PostCard({ post, onLike, fetchComments, activeComments, loadingComments, addComment, updatePost, deletePost, onStartChat }: PostCardProps) {
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
    <div className="relative group w-full max-w-2xl xl:max-w-3xl mx-auto bg-black md:bg-[#0a0a0a] md:border border-white/[0.04] md:rounded-2xl overflow-hidden shadow-none md:shadow-xl transition-all duration-300 pb-2 mb-8 md:mb-8">
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
      <div className="px-3 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative w-8 h-8 rounded-full overflow-hidden border border-white/[0.06] shrink-0">
            {post.user?.avatar_url ? (
              <img src={post.user.avatar_url} alt="User" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-tr from-zinc-800 to-zinc-600 flex items-center justify-center font-bold text-white uppercase text-xs">
                {post.user?.name?.[0] || '?'}
              </div>
            )}
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5 leading-tight">
              <span className="text-white font-bold text-[13px] hover:underline cursor-pointer">{post.user?.name}</span>
              {/* Fake verified badge for premium feel */}
              {post.user?.role === 'professional' && <span className="text-blue-400 text-[10px]">✔</span>}
              <span className="text-zinc-500 font-medium text-[11px] ml-1">· {new Date(post.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
            </div>
            {/* Category tag */}
            {post.category && (
              <span className="text-[10px] text-zinc-500 font-medium">
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

      {/* Media Carousel (Edge to Edge) */}
      {post.media_urls && post.media_urls.length > 0 && (
        <div className="relative w-full bg-[#050505] flex items-center justify-center group/carousel border-y border-white/[0.02]">
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
                    <video src={url} className="w-full h-auto max-h-[85vh] object-contain" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/10 group-hover/video:bg-black/40 transition-all">
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
        <div className="px-4 py-6 bg-gradient-to-br from-zinc-900 to-black rounded-xl m-3 border border-white/[0.04]">
          {post.title && <h3 className="text-white font-bold text-xl mb-3 leading-tight">{post.title}</h3>}
          <p className="text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap">
            {!isExpanded && post.content && post.content.length > 200 ? (
              <>
                {post.content.slice(0, 200)}...
                <button onClick={() => setIsExpanded(true)} className="text-zinc-500 font-medium ml-1">more</button>
              </>
            ) : (
              post.content
            )}
          </p>
        </div>
      )}

      {/* Interaction Bar */}
      <div className="px-3 pt-3 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={(e) => { e.stopPropagation(); onLike(); }}
            className={`transition-all active:scale-90 group/btn`}
          >
            <Heart className={`w-6 h-6 transition-colors ${post.is_liked ? 'fill-red-500 text-red-500' : 'text-white hover:text-zinc-400 group-hover/btn:text-zinc-300'}`} />
          </button>
          <button 
            onClick={toggleComments}
            className={`transition-all active:scale-90 text-white hover:text-zinc-400`}
          >
            <MessageCircle className="w-6 h-6 -scale-x-100" />
          </button>
          {!isPostOwner && onStartChat && (
            <button 
              onClick={(e) => { e.stopPropagation(); onStartChat(post.user_id, post); }}
              className="transition-all active:scale-90 text-white hover:text-zinc-400"
            >
              <Send className="w-[22px] h-[22px] -mt-0.5 -rotate-[20deg]" />
            </button>
          )}
        </div>
        <div className="flex justify-center flex-1">
          {/* Pagination dots bottom */}
          {post.media_urls && post.media_urls.length > 1 && (
            <div className="flex gap-1.5 items-center">
              {post.media_urls.map((_: string, idx: number) => (
                <div key={idx} className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${idx === activeMediaIndex ? 'bg-blue-500' : 'bg-zinc-700'}`} />
              ))}
            </div>
          )}
        </div>
        <button className="text-white hover:text-zinc-400 active:scale-90 transition-all">
          <Share2 className="w-6 h-6" />
        </button>
      </div>

      {/* Likes Count */}
      <div className="px-3.5 mb-1.5">
        <span className="text-[13px] text-white font-bold cursor-pointer">{post.likes_count} likes</span>
      </div>

      {/* Title & Description with Media */}
      {post.media_urls && post.media_urls.length > 0 && (post.title || post.content) && !isEditingPost && (
        <div className="px-3.5 mb-2">
          <p className="text-[13px] text-zinc-100 leading-tight whitespace-pre-wrap">
            <span className="font-bold text-white mr-1.5 cursor-pointer hover:underline">{post.user?.name}</span>
            {post.title && <span className="font-medium mr-1">{post.title}</span>}
            {!isExpanded && post.content && post.content.length > 100 ? (
              <>
                <span className="text-zinc-300">{post.content.slice(0, 100)}...</span>
                <button onClick={() => setIsExpanded(true)} className="text-zinc-500 font-medium ml-1">more</button>
              </>
            ) : (
              <span className="text-zinc-300">{post.content}</span>
            )}
          </p>
        </div>
      )}

      {/* Comments Preview Line */}
      {(post.comments_count > 0 || showComments) && (
        <div className="px-3.5 mb-2">
          {!showComments ? (
            <button onClick={toggleComments} className="text-[13px] text-zinc-500 font-medium hover:text-zinc-400">
              View all {post.comments_count} comments
            </button>
          ) : (
             <span className="text-[10px] uppercase font-bold text-zinc-600 tracking-wider">Comments</span>
          )}
        </div>
      )}

      {/* Inline Add Comment (Always visible like instagram) */}
      <form onSubmit={handleAddComment} className="px-3.5 mt-1 pb-2 flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-white/[0.06] overflow-hidden shrink-0 border border-white/[0.04]">
          {user?.user_metadata?.avatar_url ? (
            <img src={user.user_metadata.avatar_url} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-[8px] text-zinc-500 font-bold uppercase">{user?.user_metadata?.name?.[0] || 'U'}</div>
          )}
        </div>
        <input 
          type="text" 
          placeholder="Add a comment..."
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          className="flex-1 bg-transparent text-[13px] text-white placeholder-zinc-500 outline-none"
        />
        {commentText.trim() && (
          <button 
            type="submit"
            disabled={submitting}
            className="text-blue-500 font-bold text-[13px] px-1 disabled:opacity-50 transition-opacity"
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
