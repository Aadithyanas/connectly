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
  env.SUPABASE_SERVICE_ROLE_KEY
);

async function runMigration() {
  const sql = fs.readFileSync('supabase/permanent_db_fix.sql', 'utf8');
  console.log('Running Permanent DB Fix...');

  const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

  if (error) {
    if (error.message.includes('function "exec_sql" does not exist')) {
        console.error('CRITICAL: The "exec_sql" RPC is missing in your Supabase project. You must run the SQL manually in the Dashboard.');
    } else {
        console.error('Error applying migration:', error);
    }
  } else {
    console.log('Permanent DB Fix Applied Successfully!');
  }
}

runMigration();
