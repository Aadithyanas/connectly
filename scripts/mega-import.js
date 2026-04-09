const { MongoClient } = require('mongodb');
const path = require('path');
const https = require('https');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') });

const DATA_URL = 'https://raw.githubusercontent.com/neenza/leetcode-problems/master/merged_problems.json';
const TEMP_FILE = path.resolve(process.cwd(), 'merged.json');

async function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    console.log(`📥 Downloading dataset from ${url}...`);
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: Status ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log('✅ Download complete.');
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function startImport() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ MONGODB_URI is missing!');
    return;
  }

  const client = new MongoClient(uri);

  try {
    // 1. Download
    await downloadFile(DATA_URL, TEMP_FILE);

    // 2. Read and Parse
    console.log('📂 Reading and parsing data...');
    const rawData = fs.readFileSync(TEMP_FILE, 'utf8');
    const data = JSON.parse(rawData);
    
    // The dataset might be an array or an object containing an array
    const problems = Array.isArray(data) ? data : (data.questions || data.problems || data.data || []);
    console.log(`Found ${problems.length} problems.`);

    // 3. Connect to DB
    await client.connect();
    const db = client.db(process.env.MONGODB_DB || 'connectly');
    const collection = db.collection('challenges');

    // 4. Wipe existing (Optional but recommended for clean start)
    console.log('🧹 Clearing existing challenges...');
    await collection.deleteMany({});

    // 5. Map and Batch Insert
    console.log('🚀 Mapping and importing data...');
    const formatted = problems.map(p => ({
      id: Math.random().toString(36).substr(2, 9),
      leetcode_id: p.problem_id || p.frontend_id,
      title: p.title,
      difficulty: p.difficulty?.toLowerCase() || 'easy',
      category: p.topics && p.topics.length > 0 ? p.topics[0] : 'LeetCode',
      topics: p.topics || [],
      description: p.description,
      examples: p.examples || [],
      constraints: p.constraints || [],
      hints: p.hints || [],
      code_snippets: p.code_snippets || {},
      solution: p.solution || null,
      points: (p.difficulty?.toLowerCase() === 'easy') ? 10 : (p.difficulty?.toLowerCase() === 'medium' ? 30 : 100),
      created_at: new Date()
    }));

    // Insert in batches
    const BATCH_SIZE = 500;
    for (let i = 0; i < formatted.length; i += BATCH_SIZE) {
      const batch = formatted.slice(i, i + BATCH_SIZE);
      await collection.insertMany(batch);
      console.log(`Progress: ${Math.min(i + batch.length, formatted.length)}/${formatted.length} imported...`);
    }

    console.log(`\n🎉 SUCCESS! Total ${formatted.length} problems imported into MongoDB.`);

  } catch (err) {
    console.error('❌ Import Failed:', err);
  } finally {
    await client.close();
    // Use a small delay for file cleanup to avoid EBUSY on Windows
    setTimeout(() => {
      try { if (fs.existsSync(TEMP_FILE)) fs.unlinkSync(TEMP_FILE); } catch(e) {}
    }, 1000);
  }
}

startImport();
