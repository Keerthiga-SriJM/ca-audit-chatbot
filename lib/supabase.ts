import { createClient } from "@supabase/supabase-js";

// Server-side only. Uses the service key, so never import this in a client component.
export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { persistSession: false } }
);
