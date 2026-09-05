import { NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

// key ごとに window_seconds 秒間で limit 回まで許可する（Supabase の check_rate_limit RPC で
// 原子的にカウント）。RPC 呼び出し自体が失敗した場合は fail open（正規のリクエストを誤って
// ブロックしないことを優先し、通す）。
export async function checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("check_rate_limit", {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) return true;
  return data === true;
}

// Vercel は x-forwarded-for にクライアントIPを設定する（複数プロキシを経由する場合は先頭が
// オリジナルのクライアントIP）。取得できない場合は "unknown" とし、その場合は全員が同じ
// バケットを共有することになるが、少なくとも完全にレート制限が無効になることは避ける。
export function getClientIp(req: NextRequest): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export const RATE_LIMIT_MESSAGE = "リクエストが多すぎます。しばらくしてから再度お試しください。";
