const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  'https://mqiwgorivtglnjbwhkve.supabase.co',
  'sb_publishable_fOB1zjblvm39vNqnlr1DGw_jpTt9o0E'
);

async function test() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'test@example.com',
    password: 'password123'
  });
  console.log('Login attempt result:', { error: error?.message, status: error?.status });
}
test();
