'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { Trophy, Code2, Bug, Brain, ChevronRight, CheckCircle2, Zap, Layout, Loader2 } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import CodingArena from '@/components/CodingArena'

export default function ChallengesRoom() {
  const [challenges, setChallenges] = useState<any[]>([])
  const [solutions, setSolutions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedChallenge, setSelectedChallenge] = useState<any>(null)
  const { user, loading: authLoading } = useAuth()
  const supabase = createClient()

  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [activeDifficulty, setActiveDifficulty] = useState('All')
  const [activeCategory, setActiveCategory] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    if (!authLoading) {
      setPage(1)
      fetchChallenges(1, true)
    }
  }, [user, authLoading, activeDifficulty, activeCategory])

  const fetchChallenges = async (pageNum = 1, reset = false) => {
    if (authLoading) return
    setLoading(true)
    try {
      const url = new URL('/api/challenges/list', window.location.origin)
      url.searchParams.append('page', pageNum.toString())
      url.searchParams.append('difficulty', activeDifficulty)
      url.searchParams.append('topic', activeCategory)
      url.searchParams.append('search', searchQuery)

      const response = await fetch(url.toString())
      const data = await response.json()
      
      const newChallenges = data.challenges || []
      setChallenges(prev => reset ? newChallenges : [...prev, ...newChallenges])
      setHasMore(data.hasMore)
      
      if (user) {
        const { data: solData } = await supabase
          .from('challenge_solutions')
          .select('challenge_id')
          .eq('user_id', user.id)
        
        if (solData) setSolutions(solData.map((s: any) => s.challenge_id))
      }
    } catch (err) {
      console.error('🏟️ Arena: Fetch Failed:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    fetchChallenges(1, true)
  }

  const getDifficultyColor = (diff: string) => {
    switch (diff.toLowerCase()) {
      case 'easy': return 'text-emerald-400 bg-emerald-400/10'
      case 'medium': return 'text-amber-400 bg-amber-400/10'
      case 'hard': return 'text-rose-400 bg-rose-400/10'
      default: return 'text-zinc-400 bg-zinc-400/10'
    }
  }

  const getCategoryIcon = (cat: string) => {
    switch (cat.toLowerCase()) {
      case 'dsa': case 'arrays': case 'dynamic programming': return <Brain className="w-4 h-4" />
      case 'strings': case 'hash table': return <Layout className="w-4 h-4" />
      case 'math': return <Zap className="w-4 h-4 cursor-default" />
      case 'logic': return <Zap className="w-4 h-4" />
      default: return <Code2 className="w-4 h-4" />
    }
  }

  if (authLoading || (loading && challenges.length === 0)) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-black">
        <Loader2 className="w-8 h-8 text-zinc-700 animate-spin mb-4" />
        <p className="text-zinc-600 text-sm font-medium animate-pulse">Entering the Arena...</p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col h-full w-full min-w-0 bg-black relative overflow-hidden">
      {/* Header */}
      <div className="px-5 md:px-6 py-4 md:py-6 border-b border-white/[0.04] bg-[#0a0a0a] sticky top-0 z-10 shrink-0">
        <div className="flex items-center justify-between mb-3 md:mb-4">
          <div className="flex items-center gap-2 md:gap-3">
            <h1 className="text-white text-lg md:text-xl font-bold tracking-tight">
              Arena
            </h1>
            <div className="px-2 py-0.5 bg-amber-400/10 text-amber-400 text-[9px] font-black uppercase tracking-widest rounded-full border border-amber-400/20 translate-y-[1px]">
              BETA
            </div>
          </div>
          <Trophy className="w-4 h-4 md:w-5 md:h-5 text-amber-500 drop-shadow-[0_0_10px_rgba(245,158,11,0.4)]" />
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <p className="text-zinc-500 text-[11px] md:text-xs font-medium max-w-sm leading-relaxed">
              Explore 2,900+ professional LeetCode problems. Master your skills and climb the leaderboard.
            </p>
            <form onSubmit={handleSearch} className="relative group w-full md:w-64">
              <input 
                type="text"
                placeholder="Search problems..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-2.5 md:py-2 text-[11px] md:text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/50 transition-all font-medium"
              />
            </form>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            {['All', 'Easy', 'Medium', 'Hard'].map((diff) => (
              <button
                key={diff}
                onClick={() => setActiveDifficulty(diff)}
                className={`px-4 py-1.5 rounded-full text-[9px] md:text-[10px] font-bold uppercase tracking-wider transition-all border shrink-0
                  ${activeDifficulty === diff 
                    ? 'bg-amber-400 border-amber-400 text-black' 
                    : 'bg-white/[0.03] border-white/[0.06] text-zinc-500 hover:border-white/20'}
                `}
              >
                {diff}
              </button>
            ))}
            <div className="w-px h-4 bg-white/10 mx-2 shrink-0" />
            {['All', 'Arrays', 'Strings', 'Dynamic Programming', 'Math'].map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all border whitespace-nowrap
                  ${activeCategory === cat 
                    ? 'bg-zinc-100 border-zinc-100 text-black' 
                    : 'bg-white/[0.02] border-white/[0.05] text-zinc-500 hover:border-white/20'}
                `}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-5 md:p-6 space-y-5 pb-40 md:pb-24">
        {challenges.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 bg-white/[0.03] rounded-full flex items-center justify-center mb-4">
              <Code2 className="w-8 h-8 text-zinc-800" />
            </div>
            <h3 className="text-white font-bold mb-1">No Challenges Found</h3>
            <p className="text-zinc-500 text-xs max-w-[200px]">
              Try adjusting your filters or search terms.
            </p>
          </div>
        ) : (
          <>
            {challenges.map((challenge) => {
              const isSolved = solutions.includes(challenge.id)
              
              return (
                <div 
                  key={challenge.id}
                  onClick={() => setSelectedChallenge(challenge)}
                  className={`group relative p-4 md:p-5 bg-[#0a0a0a] border rounded-2xl transition-all duration-300 cursor-pointer overflow-hidden
                    ${isSolved ? 'border-emerald-500/20 hover:border-emerald-500/40' : 'border-white/[0.04] hover:border-white/[0.1] hover:bg-white/[0.02]'}
                  `}
                >
                  <div className={`absolute -right-12 -top-12 w-24 h-24 blur-[60px] transition-opacity duration-500
                    ${challenge.difficulty === 'easy' ? 'bg-emerald-500/10' : challenge.difficulty === 'medium' ? 'bg-amber-500/10' : 'bg-rose-500/10'}
                    opacity-0 group-hover:opacity-100
                  `} />

                  <div className="flex items-start justify-between gap-2 relative z-10 min-w-0">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <div className={`p-1.5 rounded-lg shrink-0 ${getDifficultyColor(challenge.difficulty)}`}>
                          {getCategoryIcon(challenge.category)}
                        </div>
                        <span className={`text-[9px] font-black uppercase tracking-[0.12em] px-1.5 py-0.5 rounded shrink-0 ${getDifficultyColor(challenge.difficulty)}`}>
                          {challenge.difficulty}
                        </span>
                        <span className="text-zinc-600 text-[9px] font-bold tabular-nums shrink-0">#{challenge.leetcode_id}</span>
                        {isSolved && (
                          <span className="flex items-center gap-1 text-emerald-400 text-[9px] font-bold uppercase shrink-0">
                            <CheckCircle2 className="w-3 h-3" />
                            Solved
                          </span>
                        )}
                      </div>
                      <h3 className="text-white font-bold text-sm md:text-base mb-1 group-hover:text-amber-400 transition-colors line-clamp-2 break-words">
                        {challenge.title}
                      </h3>
                      <p className="text-zinc-500 text-[11px] line-clamp-2 leading-relaxed mb-3">
                        {challenge.description}
                      </p>
                      
                      <div className="flex flex-wrap gap-1.5">
                        {challenge.topics?.slice(0, 3).map((topic: string) => (
                          <span key={topic} className="px-2 py-0.5 bg-white/[0.03] text-zinc-500 text-[8px] md:text-[9px] font-bold uppercase tracking-wider rounded border border-white/[0.05]">
                            {topic}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="self-center shrink-0 p-1.5 bg-white/[0.03] rounded-full text-zinc-500 group-hover:text-white transition-all group-hover:translate-x-0.5">
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              )
            })}
            
            {hasMore && (
              <button
                onClick={() => {
                  const nextPage = page + 1
                  setPage(nextPage)
                  fetchChallenges(nextPage)
                }}
                disabled={loading}
                className="w-full py-4 bg-white/[0.02] border border-white/[0.05] rounded-2xl text-zinc-500 text-xs font-bold uppercase tracking-widest hover:bg-white/[0.04] hover:border-white/10 transition-all disabled:opacity-50"
              >
                {loading ? 'Loading More...' : 'Load More Challenges'}
              </button>
            )}
          </>
        )}
      </div>

      {selectedChallenge && (
        <CodingArena 
          challenge={selectedChallenge} 
          isSolved={solutions.includes(selectedChallenge.id)}
          onClose={() => setSelectedChallenge(null)} 
          onSuccess={() => {
            setSolutions([...solutions, selectedChallenge.id])
          }}
        />
      )}
    </div>
  )
}
