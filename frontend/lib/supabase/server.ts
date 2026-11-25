import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { ConfigError } from "@/lib/server/env";

function publicConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url) throw new ConfigError("NEXT_PUBLIC_SUPABASE_URL");
  if (!key) throw new ConfigError("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  return { url, key };
}

/**
 * Supabase client acting AS THE SIGNED-IN USER (publishable key + the user's session cookie).
 * Every query through it is filtered by Row Level Security, so this is the default for reads
 * and writes. The service-role client (lib/server/supabase.ts) is only for the few server-side
 * steps RLS deliberately forbids to browsers (writing AI results, storage, staff accounts).
 */
export async function supabaseServer() {
  const { url, key } = publicConfig();
  const store = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Called from a Server Component, where cookies are read-only. proxy.ts refreshes
          // the session on every navigation, so nothing is lost.
        }
      },
    },
  });
}
