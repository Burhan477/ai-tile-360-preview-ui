import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseEnv, getSupabaseSecretKey } from "@/lib/server/env";

const SERVER_AUTH = { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false };

let client: SupabaseClient | undefined;
let adminClient: SupabaseClient | undefined;

/**
 * Supabase client using the publishable key, for Route Handlers and other
 * server code. It has only the access RLS policies grant (read-only catalog;
 * see supabase/migrations). Created on first use so a missing env var surfaces
 * as a `ServerConfigError` at request time rather than at import.
 */
export function getSupabase(): SupabaseClient {
  if (!client) {
    const { url, publishableKey } = getSupabaseEnv();
    client = createClient(url, publishableKey, { auth: SERVER_AUTH });
  }
  return client;
}

/**
 * Supabase client using the secret key. It bypasses RLS, so use it only for
 * operations the calling Route Handler has validated (Storage uploads and
 * signed URLs in `src/lib/server/storage.ts`; generation jobs in
 * `src/lib/server/generation.ts`, filtered only by validated ids and enums),
 * and never for queries shaped by free-form request input.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (!adminClient) {
    const { url } = getSupabaseEnv();
    adminClient = createClient(url, getSupabaseSecretKey(), { auth: SERVER_AUTH });
  }
  return adminClient;
}
