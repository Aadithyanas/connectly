const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') });

async function testConnection() {
  console.log('🔍 Testing MongoDB Connection...');
  console.log(`URI: ${process.env.MONGODB_URI?.substring(0, 20)}...`);

  if (!process.env.MONGODB_URI) {
    console.error('❌ Error: MONGODB_URI is missing in .env.local');
    return;
  }

  const client = new MongoClient(process.env.MONGODB_URI);

  try {
    await client.connect();
    console.log('✅ Success! Successfully connected to MongoDB.');
    
    const dbName = process.env.MONGODB_DB || 'connectly';
    const db = client.db(dbName);
    const ping = await db.command({ ping: 1 });
    
    console.log(`📡 Database "${dbName}" is active and responding (Ping: ${ping.ok}).`);
  } catch (err) {
    console.error('❌ Connection Failed!');
    console.error('Reason:', err.message);
    
    if (err.message.includes('ECONNREFUSED')) {
      console.log('\n💡 Tip: Your network is still blocking the connection. Ensure you are using the LONG mongodb:// link without +srv.');
    }
  } finally {
    await client.close();
  }
}

testConnection();
