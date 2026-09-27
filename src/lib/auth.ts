import type { SupabaseClient } from "@supabase/supabase-js";

export type SessionUser = { id: string; email: string | null };

// 閲覧用ページ向けの高速なログイン確認。getUser は毎回認証サーバーへ問い合わせるが、
// getClaims は Cookie の JWT をプロジェクトの公開鍵（JWKS、メモリにキャッシュ）で手元検証する。
// 署名と有効期限は検証されるが、退会（ban）・失効は JWT の有効期限内は検知できない。
// 決済・キャンセル・退会・管理者 API など、書き込みや権限判定には使わず getUser を使い続ける。
export async function getSessionUser(supabase: SupabaseClient): Promise<SessionUser | null> {
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : null };
}
