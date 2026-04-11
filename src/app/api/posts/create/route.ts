import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // 1. Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Parse payload
    const body = await request.json()
    const {
      title,
      content,
      media_urls,
      media_types,
      category
    } = body

    if (!content) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 })
    }

    // 3. Insert into database
    const { data: post, error: insertError } = await supabase
      .from('posts')
      .insert([{
        user_id: user.id, // Enforce from auth token
        title,
        content,
        media_urls,
        media_types,
        category
      }])
      .select()
      .single()

    if (insertError) {
      console.error('Insert error in API route:', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ post })
  } catch (error: any) {
    console.error('API Create Post Error:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
  }
}
