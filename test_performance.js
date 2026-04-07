const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Manually parse .env.local
const envPath = path.resolve('.env.local');
const envFile = fs.readFileSync(envPath, 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const [key, ...value] = line.split('=');
  if (key && value) env[key.trim()] = value.join('=').trim().replace(/^"(.*)"$/, '$1');
});

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY // Use anon key to test RLS
);

async function testPerformance() {
  console.log('--- Database Performance Health Check ---');
  
  // Test a simple chat member fetch
  const start = Date.now();
  const { data, error } = await supabase
    .from('chat_members')
    .select('user_id')
    .limit(1);
    
  const end = Date.now();
  
  if (error) {
    console.error('Query Error:', error.message);
    if (error.message.includes('infinite recursion')) {
        console.error('CRITICAL: RLS Recursion detected. The SQL fix was NOT applied correctly.');
    }
  } else {
    console.log(`Query took ${end - start}ms`);
    if (end - start > 1000) {
        console.warn('Warning: Query is slow (>1s). Indexes might be missing.');
    } else {
        console.log('Success: Database check passed.');
    }
  }
}

testPerformance();
