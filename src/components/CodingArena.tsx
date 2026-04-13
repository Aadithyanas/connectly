'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useAuth } from '@/context/AuthContext'
import { X, Play, Code2, Brain, Trophy, CheckCircle2, ChevronRight, AlertCircle, Loader2, Sparkles, ChevronDown, RotateCcw, Monitor } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import Editor from 'react-simple-code-editor'
import Prism from 'prismjs'
import 'prismjs/themes/prism-tomorrow.css'
import 'prismjs/components/prism-javascript'
import 'prismjs/components/prism-python'
import 'prismjs/components/prism-c'
import 'prismjs/components/prism-cpp'
import 'prismjs/components/prism-java'

interface CodingArenaProps {
  challenge: any
  isSolved: boolean
  onClose: () => void
  onSuccess: () => void
}

type Language = string;

export default function CodingArena({ challenge, isSolved, onClose, onSuccess }: CodingArenaProps) {
  const [activeTab, setActiveTab] = useState<'description' | 'examples' | 'hints'>('description')
  const [selectedLang, setSelectedLang] = useState<Language>('javascript')
  const [code, setCode] = useState('')
  const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle')
  const [currentTestIndex, setCurrentTestIndex] = useState(0)
  const [lastRunResults, setLastRunResults] = useState<any[]>([])
  const [selectedResultIndex, setSelectedResultIndex] = useState(0)
  const [errorMessage, setErrorMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showLangMenu, setShowLangMenu] = useState(false)
  const [mobileView, setMobileView] = useState<'problem' | 'code'>('problem')
  const [isMobile, setIsMobile] = useState(false)
  const { user } = useAuth()

  // Initialize code when language or challenge changes
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    
    if (challenge.code_snippets && challenge.code_snippets[selectedLang]) {
      setCode(challenge.code_snippets[selectedLang])
    } else {
      const fallbackLang = Object.keys(challenge.code_snippets || {})[0] || 'javascript'
      if (fallbackLang !== selectedLang) {
        setSelectedLang(fallbackLang)
      } else {
        setCode('// No snippet available for this language.')
      }
    }
    return () => window.removeEventListener('resize', checkMobile)
  }, [selectedLang, challenge])

  const handleLanguageChange = (lang: Language) => {
    setSelectedLang(lang)
    setShowLangMenu(false)
  }

  const verifySolution = async () => {
    if (!user || submitting) return
    setStatus('running')
    setSubmitting(true)
    setLastRunResults([])
    setSelectedResultIndex(0)

    try {
      const response = await fetch('/api/challenges/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeId: challenge.id || challenge._id,
          code,
          language: selectedLang
        })
      })

      const result = await response.json()
      setLastRunResults(result.results || [])

      if (result.success) {
        setStatus('success')
        if (!isSolved) onSuccess()
      } else {
        setStatus('error')
        const firstFailure = result.results?.findIndex((r: any) => !r.passed)
        if (firstFailure !== -1) setSelectedResultIndex(firstFailure)
        
        setErrorMessage(result.error || "Logic mismatch detected by the Arena.")
      }
    } catch (err) {
      console.error(err)
      setStatus('error')
      setErrorMessage("Runtime Error: Could not connect to the execution engine.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex flex-col pt-4 md:pt-0"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.04] bg-black">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white transition-colors shrink-0">
            <X className="w-5 h-5" />
          </button>
          <div className="flex flex-col min-w-0">
            <h2 className="text-white font-bold tracking-tight text-sm truncate">
              <span className="text-zinc-600 mr-1">#{challenge.leetcode_id}</span>
              {challenge.title}
            </h2>
            <div className="flex items-center gap-2">
               <span className={`text-[9px] font-bold uppercase tracking-widest ${challenge.difficulty === 'easy' ? 'text-emerald-500' : challenge.difficulty === 'medium' ? 'text-amber-500' : 'text-rose-500'}`}>{challenge.difficulty}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isMobile || mobileView === 'code' ? (
            <div className="relative">
              <button 
                onClick={() => setShowLangMenu(!showLangMenu)}
                className="flex items-center gap-2 px-2 md:px-3 py-1.5 bg-white/[0.03] border border-white/[0.08] hover:border-white/[0.2] rounded-lg transition-all"
              >
                <div className="w-4 h-4 rounded bg-amber-500/20 flex items-center justify-center">
                  <Code2 className="w-2.5 h-2.5 text-amber-500" />
                </div>
                <span className="text-[10px] text-white font-black uppercase tracking-widest min-w-[60px] md:min-w-[80px] text-left">
                  {selectedLang}
                </span>
                <ChevronDown className={`w-3 h-3 text-zinc-500 transition-transform ${showLangMenu ? 'rotate-180' : ''}`} />
              </button>

              <AnimatePresence>
                {showLangMenu && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute right-0 top-full mt-2 w-48 py-1 bg-[#0c0c0c] border border-white/[0.08] rounded-xl shadow-2xl z-[110] max-h-64 overflow-y-auto custom-scrollbar"
                  >
                    {Object.keys(challenge.code_snippets || {}).map((lang) => (
                      <button
                        key={lang}
                        onClick={() => handleLanguageChange(lang)}
                        className={`w-full text-left px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-colors
                          ${selectedLang === lang ? 'text-white bg-white/5' : 'text-zinc-500 hover:text-white hover:bg-white/[0.02]'}
                        `}
                      >
                        {lang}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : null}

          <button 
            onClick={verifySolution}
            disabled={submitting || status === 'success'}
            className={`flex items-center gap-2 px-3 md:px-4 py-1.5 rounded-lg font-bold text-[10px] uppercase tracking-widest transition-all active:scale-95 ${status === 'success' ? 'bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)]' : 'bg-white text-black hover:bg-zinc-200'} disabled:opacity-50`}
          >
            {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
            <span className="hidden sm:inline">{status === 'success' ? 'Solved' : 'Run / Submit'}</span>
            {isMobile && !submitting && status !== 'success' && <span>Run</span>}
          </button>
        </div>
      </div>

      {isMobile && (
        <div className="flex bg-[#0a0a0a] border-b border-white/[0.04] p-1">
          <button 
            onClick={() => setMobileView('problem')}
            className={`flex-1 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all ${mobileView === 'problem' ? 'bg-white/[0.06] text-white' : 'text-zinc-500'}`}
          >
            Problem
          </button>
          <button 
            onClick={() => setMobileView('code')}
            className={`flex-1 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all ${mobileView === 'code' ? 'bg-white/[0.06] text-white' : 'text-zinc-500'}`}
          >
            Code
          </button>
        </div>
      )}

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left Pane: Tabs */}
        <div className={`${isMobile && mobileView === 'code' ? 'hidden' : 'flex'} w-full md:w-[400px] border-r border-white/[0.04] flex flex-col bg-[#050505] overflow-hidden`}>
          <div className="flex border-b border-white/[0.04] px-4">
            {(['description', 'examples', 'hints'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 text-[10px] font-bold uppercase tracking-widest transition-all relative
                  ${activeTab === tab ? 'text-white' : 'text-zinc-600 hover:text-zinc-400'}
                `}
              >
                {tab}
                {activeTab === tab && (
                  <motion.div layoutId="tab-underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-400" />
                )}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6">
            <AnimatePresence mode="wait">
              {activeTab === 'description' && (
                <motion.div key="desc" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-6">
                  <div>
                    <h4 className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-3 flex items-center gap-2">
                       <Brain className="w-3 h-3" /> Description
                    </h4>
                    <div className="text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap">
                      {challenge.description}
                    </div>
                  </div>

                  {challenge.constraints?.length > 0 && (
                    <div>
                      <h4 className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-3">Constraints</h4>
                      <ul className="space-y-2">
                        {challenge.constraints.map((c: string, i: number) => (
                          <li key={i} className="flex gap-2 text-zinc-400 text-xs">
                            <span className="text-amber-500/50">•</span>
                            <span>{c}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </motion.div>
              )}

              {activeTab === 'examples' && (
                <motion.div key="ex" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-4 md:space-y-6">
                  {challenge.examples?.map((ex: any, idx: number) => (
                    <div key={idx} className="p-3 md:p-4 bg-white/[0.02] border border-white/[0.04] rounded-2xl">
                      <div className="flex items-center justify-between border-b border-white/[0.04] pb-2 mb-3">
                        <span className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">Example {ex.example_num || idx + 1}</span>
                      </div>
                      <div className="text-zinc-300 text-[11px] md:text-xs leading-relaxed font-mono overflow-x-auto no-scrollbar whitespace-pre">
                        {ex.example_text}
                      </div>
                    </div>
                  ))}
                </motion.div>
              )}

              {activeTab === 'hints' && (
                <motion.div key="hints" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-4">
                  {challenge.hints?.length > 0 ? challenge.hints.map((hint: string, i: number) => (
                    <div key={i} className="group p-4 bg-white/[0.02] border border-white/[0.04] rounded-xl transition-all hover:bg-white/[0.04]">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-amber-400/50 text-[10px] font-bold uppercase tracking-widest">Hint {i + 1}</span>
                      </div>
                      <p className="text-zinc-400 text-xs leading-relaxed transition-all">
                        {hint}
                      </p>
                    </div>
                  )) : (
                    <div className="text-center py-10">
                      <p className="text-zinc-600 text-xs italic">No hints available for this problem.</p>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Right Pane: Code Editor & Results Dashboard */}
        <div className={`${isMobile && mobileView === 'problem' ? 'hidden' : 'flex'} flex-1 flex flex-col bg-black relative overflow-hidden`}>
          <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.04] bg-[#0a0a0a]">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-rose-500/50" />
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500/50" />
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/50" />
              <span className="ml-2 text-[10px] font-bold text-zinc-600 uppercase tracking-widest font-mono">
                solution.{selectedLang}
              </span>
            </div>
            <button 
              onClick={() => setCode(challenge.code_snippets[selectedLang] || '')}
              className="p-1.5 text-zinc-700 hover:text-white transition-colors"
              title="Reset Code"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
          
          <div className="flex-1 relative overflow-auto custom-scrollbar bg-[#050505]">
            <div className="min-h-full min-w-full">
              <Editor
                value={code}
                onValueChange={code => setCode(code)}
                highlight={code => {
                  let currentLang = Prism.languages.javascript;
                  const targetLang = selectedLang.toLowerCase();
                  if (targetLang === 'python' && Prism.languages.python) currentLang = Prism.languages.python;
                  else if ((targetLang === 'cpp' || targetLang === 'c++') && Prism.languages.cpp) currentLang = Prism.languages.cpp;
                  else if (targetLang === 'java' && Prism.languages.java) currentLang = Prism.languages.java;
                  else if (targetLang === 'c' && Prism.languages.c) currentLang = Prism.languages.c;
                  return Prism.highlight(code, currentLang || Prism.languages.javascript, targetLang);
                }}
                padding={24}
                disabled={status === 'success'}
                style={{
                  fontFamily: '"Fira Code", "JetBrains Mono", Consolas, Monaco, monospace',
                  fontSize: 14,
                  minHeight: '100%',
                  width: '100%',
                  backgroundColor: 'transparent',
                }}
                className="editor-container text-zinc-300 outline-none leading-relaxed"
              />
            </div>
          </div>

          {/* New Results Dashboard Overlay */}
          <AnimatePresence>
            {status !== 'idle' && (
              <motion.div 
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className={`absolute inset-x-0 bottom-0 ${isMobile ? 'h-full pt-12' : 'max-h-[50%]'} bg-[#0a0a0a] border-t border-white/[0.08] shadow-[0_-20px_50px_rgba(0,0,0,0.5)] z-[120] flex flex-col`}
              >
                {/* Dashboard Header */}
                <div className="px-6 py-4 border-b border-white/[0.04] flex items-center justify-between bg-black/40 backdrop-blur-md sticky top-0">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      {status === 'running' ? <Loader2 className="w-4 h-4 text-zinc-500 animate-spin" /> :
                       status === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> :
                       <AlertCircle className="w-4 h-4 text-rose-500" />}
                      <span className={`text-xs font-black uppercase tracking-widest ${
                        status === 'running' ? 'text-zinc-400' :
                        status === 'success' ? 'text-emerald-500' : 'text-rose-500'
                      }`}>
                        {status === 'running' ? 'Running Code...' : status === 'success' ? 'Success' : 'Wrong Answer'}
                      </span>
                    </div>
                    {lastRunResults.length > 0 && status !== 'running' && (
                      <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest bg-white/[0.02] px-3 py-1 rounded-full border border-white/[0.05]">
                        Passed {lastRunResults.filter(r => r.passed).length}/{lastRunResults.length} Tests
                      </span>
                    )}
                  </div>
                  <button onClick={() => setStatus('idle')} className="p-1 px-3 text-[10px] font-black uppercase tracking-widest text-zinc-600 hover:text-white transition-colors">
                    Close
                  </button>
                </div>

                {/* Dashboard Tabs (Test Cases) */}
                <div className="flex-1 overflow-hidden flex flex-col">
                  {status === 'running' ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-12">
                      <div className="w-12 h-12 rounded-full border-2 border-amber-500/20 border-t-amber-500 animate-spin mb-4" />
                      <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-[0.2em] animate-pulse">Waiting for execution results...</p>
                    </div>
                  ) : (
                    <div className="flex-1 flex overflow-hidden">
                      {/* Left Side: Test List */}
                      <div className={`${isMobile ? 'w-24' : 'w-48'} border-r border-white/[0.04] p-3 space-y-2 overflow-y-auto custom-scrollbar bg-black/20`}>
                        {lastRunResults.map((result, idx) => (
                          <button
                            key={idx}
                            onClick={() => setSelectedResultIndex(idx)}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl border transition-all
                              ${selectedResultIndex === idx ? 'bg-white/[0.03] border-white/10' : 'border-transparent hover:bg-white/[0.02]'}
                            `}
                          >
                            <div className={`w-1.5 h-1.5 rounded-full ${result.passed ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]'}`} />
                            <span className={`text-[10px] font-bold text-zinc-500 uppercase tracking-widest ${isMobile ? 'hidden' : 'block'}`}>Test Case {idx + 1}</span>
                            {isMobile && <span className="text-[10px] font-bold text-zinc-500">#{idx + 1}</span>}
                          </button>
                        ))}
                      </div>

                      {/* Right Side: Detailed View */}
                      <div className="flex-1 p-6 overflow-y-auto custom-scrollbar space-y-6">
                        {lastRunResults[selectedResultIndex] && (
                          <>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Your Output</label>
                                <div className={`p-4 bg-black border rounded-xl font-mono text-xs overflow-x-auto whitespace-nowrap
                                  ${lastRunResults[selectedResultIndex].passed ? 'border-emerald-500/10 text-emerald-400' : 'border-rose-500/10 text-rose-400'}
                                `}>
                                  {lastRunResults[selectedResultIndex].actual || '""'}
                                </div>
                              </div>
                              <div className="space-y-2">
                                <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Expected</label>
                                <div className="p-4 bg-black border border-white/[0.05] rounded-xl font-mono text-xs text-zinc-400 overflow-x-auto whitespace-nowrap">
                                  {lastRunResults[selectedResultIndex].expected}
                                </div>
                              </div>
                            </div>
                            
                            <div className="space-y-2">
                              <label className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Input Arguments</label>
                              <div className="p-4 bg-white/[0.02] border border-white/[0.05] rounded-xl font-mono text-xs text-zinc-500 whitespace-pre-wrap">
                                {lastRunResults[selectedResultIndex].input}
                              </div>
                            </div>

                            {lastRunResults[selectedResultIndex].logs && (
                              <div className="space-y-2">
                                <label className="text-[9px] font-black text-amber-500/50 uppercase tracking-widest flex items-center gap-2">
                                  <Monitor className="w-3 h-3" /> Console Logs
                                </label>
                                <div className="p-4 bg-amber-500/[0.02] border border-amber-500/10 rounded-xl font-mono text-xs text-amber-200/60 whitespace-pre-wrap">
                                  {lastRunResults[selectedResultIndex].logs}
                                </div>
                              </div>
                            )}

                            {lastRunResults[selectedResultIndex].error && (
                              <div className="space-y-2">
                                <label className="text-[9px] font-black text-rose-500/50 uppercase tracking-widest">Stderr / Runtime Log</label>
                                <div className="p-4 bg-rose-500/5 border border-rose-500/10 rounded-xl font-mono text-xs text-rose-400/70 whitespace-pre-wrap italic">
                                  {lastRunResults[selectedResultIndex].error}
                                </div>
                              </div>
                            )}

                            {status === 'success' && (
                              <div className="flex justify-end pt-4">
                                <button 
                                  onClick={onClose}
                                  className="flex items-center gap-2 bg-emerald-500 text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-400 transition-all hover:scale-105 shadow-[0_0_30px_rgba(16,185,129,0.3)]"
                                >
                                  Submit Solution & Continue
                                  <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  )
}
