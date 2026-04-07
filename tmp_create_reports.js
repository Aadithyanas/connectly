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

async function createReportsTable() {
  const sql = `
    CREATE TABLE IF NOT EXISTS public.reports (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      reporter_id UUID REFERENCES public.profiles(id),
      reported_id UUID REFERENCES public.profiles(id),
      chat_id UUID REFERENCES public.chats(id),
      reason TEXT NOT NULL,
      description TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    );

    ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "Anyone can insert reports" ON public.reports;
    CREATE POLICY "Anyone can insert reports" ON public.reports FOR INSERT WITH CHECK (true);
    
    DROP POLICY IF EXISTS "Admins can view reports" ON public.reports;
    CREATE POLICY "Admins can view reports" ON public.reports FOR SELECT USING (true);
  `;

  const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

  if (error) {
    console.error('Error creating reports table:', error);
  } else {
    console.log('Reports table and policies created successfully.');
  }
}

createReportsTable();
