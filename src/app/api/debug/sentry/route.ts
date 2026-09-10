import { NextRequest, NextResponse } from "next/server";

// Sentry の疎通確認用エンドポイント。CRON_SECRET を知っている運用者だけが
// `?token=<CRON_SECRET>` を付けて呼び出すと意図的にサーバーエラーを発生させ、
// Sentry ダッシュボードに届くことを確認できる（14-6）。
// トークン不一致・CRON_SECRET 未設定時は 404 を返し、一般ユーザーからは
// 存在しないエンドポイントとして振る舞う。
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const token = req.nextUrl.searchParams.get("token");
  if (!secret || token !== secret) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  throw new Error(
    "Sentry connectivity test: intentional error from GET /api/debug/sentry"
  );
}
