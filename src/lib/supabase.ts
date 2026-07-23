import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabasePublicKey = (
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY
) as string | undefined;
const requestedSupabase = import.meta.env.VITE_USE_SUPABASE === 'true';

export const isSupabaseConfigured = Boolean(
  requestedSupabase && supabaseUrl && supabasePublicKey,
);

// The unauthenticated local workspace is a development convenience only. A
// production build must never fall back to an Owner session when cloud
// configuration is missing or mistyped.
export const isLocalModeEnabled = Boolean(import.meta.env.DEV && !requestedSupabase);

export const configurationError = isSupabaseConfigured || isLocalModeEnabled
  ? null
  : requestedSupabase
    ? 'Supabase is enabled, but VITE_SUPABASE_URL or a publishable/anon key is missing.'
    : 'This production build requires VITE_USE_SUPABASE=true and valid Supabase public credentials.';

export const supabase = isSupabaseConfigured ? createClient(supabaseUrl!, supabasePublicKey!) : null;
