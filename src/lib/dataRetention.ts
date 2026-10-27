import type { SupabaseClient } from "@supabase/supabase-js";

export const SUPPORT_RETENTION_DAYS = 30;
const RATE_LIMIT_RETENTION_MS = 24 * 60 * 60 * 1000;

// お問い合わせは、最後のやり取りから30日たったスレッドを丸ごと削除する（2026-10-27、依頼者の指定）
export async function deleteStaleSupportThreads(svc: SupabaseClient, now: Date): Promise<number> {
  const { data, error } = await svc.from("support_messages").select("user_id, created_at");
  if (error || !data) return 0;

  const latest = new Map<string, number>();
  for (const row of data as { user_id: string; created_at: string }[]) {
    const t = new Date(row.created_at).getTime();
    if (t > (latest.get(row.user_id) ?? 0)) latest.set(row.user_id, t);
  }

  const cutoff = now.getTime() - SUPPORT_RETENTION_DAYS * 24 * 60 * 60 * 1000;
  const staleUserIds = [...latest].filter(([, t]) => t < cutoff).map(([userId]) => userId);
  if (staleUserIds.length === 0) return 0;

  const { error: deleteError } = await svc.from("support_messages").delete().in("user_id", staleUserIds);
  return deleteError ? 0 : staleUserIds.length;
}

// レート制限の記録は時間窓（最長でも数分）を過ぎれば不要なので、1日より古いものを消す
export async function deleteOldRateLimits(svc: SupabaseClient, now: Date): Promise<void> {
  await svc
    .from("rate_limits")
    .delete()
    .lt("window_start", new Date(now.getTime() - RATE_LIMIT_RETENTION_MS).toISOString());
}
