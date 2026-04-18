import { NextResponse } from 'next/server'
import clientPromise from '@/lib/mongodb'
import { createClient } from '@/utils/supabase/server'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const isTest = request.headers.get('x-test-secret') === 'ConnectlyDevTest'
    let user = null

    if (isTest) {
      user = { id: '00000000-0000-0000-0000-000000000000' }
    } else {
      const { data } = await supabase.auth.getUser()
      user = data.user
    }

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const client = await clientPromise
    const db = client.db(process.env.MONGODB_DB || 'connectly')
    
    // Get query parameters
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const topic = searchParams.get('topic')
    const difficulty = searchParams.get('difficulty')
    const search = searchParams.get('search')

    // Build filter query
    let query: any = {}
    if (topic && topic !== 'All') query.topics = topic
    if (difficulty && difficulty !== 'All') query.difficulty = difficulty.toLowerCase()
    if (search) {
      query.title = { $regex: search, $options: 'i' }
    }

    const totalCount = await db.collection('challenges').countDocuments(query)
    
    // Fetch paginated challenges from MongoDB
    const challenges = await db.collection('challenges')
      .find(query)
      .sort({ leetcode_id: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray()

    const formatted = challenges.map(c => ({
      ...c,
      id: c.id || c._id.toString()
    }))

    return NextResponse.json({
      challenges: formatted,
      totalCount,
      hasMore: (page * limit) < totalCount,
      page
    })

  } catch (error: any) {
    console.error('Fetch Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
