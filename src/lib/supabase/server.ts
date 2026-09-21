import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Next.js 15 以降 cookies() は非同期。呼び出し側（多数）を async にしないよう、
// Cookie の読み書きの時点で await して createClient() 自体は同期のままにする
export function createClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        async getAll() {
          const cookieStore = await cookies();
          return cookieStore.getAll();
        },
        async setAll(cookiesToSet) {
          try {
            const cookieStore = await cookies();
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );
}
