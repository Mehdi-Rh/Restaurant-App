// Supabase Edge Function "platform". Deploy: Supabase → Edge Functions → Deploy a new function →
// name it "platform", paste this file AND handler.js, untick "Verify JWT" (the handler checks the login itself).
import { handle } from './handler.js';
Deno.serve((req: Request) => handle(req, {
  SUPABASE_URL: Deno.env.get('SUPABASE_URL'),
  SUPABASE_SERVICE_ROLE_KEY: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
}));
