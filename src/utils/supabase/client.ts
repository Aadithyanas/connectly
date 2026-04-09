import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  // If we're on the server during SSR, create a fresh instance
  if (typeof window === 'undefined') {
    return createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }

  // If in the browser, strictly enforce a single instance
  if (!(window as any)._supabaseClient) {
    (window as any)._supabaseClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
          storageKey: `sb-${process.env.NEXT_PUBLIC_SUPABASE_URL?.split('//')[1].split('.')[0]}-auth-token`
        }
      }
    )
  }

  return (window as any)._supabaseClient
}
