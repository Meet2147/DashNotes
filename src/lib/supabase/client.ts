// Environment variables required:
// NEXT_PUBLIC_SUPABASE_URL=
// NEXT_PUBLIC_SUPABASE_ANON_KEY=
// SUPABASE_SERVICE_ROLE_KEY=
// ANTHROPIC_API_KEY=

import { createBrowserClient } from '@supabase/ssr';

export const createClient = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder-key'
  );
