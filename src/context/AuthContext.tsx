'use client'

import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react'
import { User } from '@supabase/supabase-js'
import { createClient } from '@/utils/supabase/client'

interface AuthContextType {
  user: User | null
  profile: any | null
  loading: boolean
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    setProfile(data || null)
  }

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id)
  }

  const initLock = useRef(false)

  useEffect(() => {
    // Only run once even in React 18 Strict Mode
    if (initLock.current) return
    initLock.current = true

    // Initial fetch
    const initAuth = async () => {
      try {
        // Use getUser() as the primary source of truth, but with a timeout logic
        // or prioritize getSession if getUser is known to be slow in specific environments.
        const { data: { session } } = await supabase.auth.getSession()
        const currentUser = session?.user ?? null
        
        if (currentUser) {
          setUser(currentUser)
          // Fetch profile in background without blocking initial user state
          fetchProfile(currentUser.id)
        }
      } catch (err: any) {
        console.error('Auth check failed:', err)
      } finally {
        setLoading(false)
      }
    }

    initAuth()

    // Listen for auth changes
    const { data: { subscription: authSubscription } } = supabase.auth.onAuthStateChange(async (_event: any, session: any) => {
      const newUser = session?.user ?? null
      setUser(newUser)
      if (newUser) {
        await fetchProfile(newUser.id)
      } else {
        setProfile(null)
      }
      setLoading(false)
    })

    // Real-time profile updates
    let profileSubscription: any = null
    
    const setupProfileSubscription = (userId: string) => {
      if (profileSubscription) supabase.removeChannel(profileSubscription)
      
      profileSubscription = supabase.channel(`profile-sync:${userId}`)
        .on('postgres_changes', { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'profiles', 
          filter: `id=eq.${userId}` 
        }, (payload: any) => {
          setProfile(payload.new)
        })
        .subscribe()
    }

    if (user?.id) setupProfileSubscription(user.id)

    return () => {
      authSubscription.unsubscribe()
      if (profileSubscription) supabase.removeChannel(profileSubscription)
    }
  }, [supabase, user?.id])

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
