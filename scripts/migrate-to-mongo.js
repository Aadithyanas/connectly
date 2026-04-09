// This is a one-time migration script. Run with `node scripts/migrate-to-mongo.js`
// Ensure MONGODB_URI and SUPABASE_SERVICE_ROLE_KEY are in your .env.local

const { createClient } = require('@supabase/supabase-js')
const { MongoClient } = require('mongodb')
const path = require('path')
require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') })

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing Supabase Environment Variables!')
  console.log('Ensure you have these in .env.local:')
  console.log('- NEXT_PUBLIC_SUPABASE_URL')
  console.log('- SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function migrate() {
  const client = new MongoClient(process.env.MONGODB_URI)
  
  try {
    await client.connect()
    const db = client.db(process.env.MONGODB_DB || 'connectly')
    const collection = db.collection('challenges')

    console.log('--- Starting Migration ---')

    // 1. Fetch from Supabase
    const { data: challenges, error } = await supabase
      .from('challenges')
      .select('*')

    if (error) throw error

    console.log(`Found ${challenges.length} challenges in Supabase.`)

    // 2. Insert into MongoDB
    if (challenges.length > 0) {
      // Clean data (rename id to supabase_id if needed, or keep same)
      const formatted = challenges.map(c => ({
        ...c,
        id: c.id, // keep original uuid for reference
        updated_at: new Date()
      }))

      const result = await collection.insertMany(formatted)
      console.log(`Inserted ${result.insertedCount} challenges into MongoDB.`)
    }

    console.log('--- Migration Completed ---')
  } catch (err) {
    console.error('Migration Failed:', err)
  } finally {
    await client.close()
  }
}

migrate()
