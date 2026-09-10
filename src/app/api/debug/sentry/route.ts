import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

// Sentry の疎通確認用エンドポイント。CRON_SECRET を知っている運用者だけが
// `?token=<CRON_SECRET>` を付けて呼び出すと、サーバー側でエラーイベントを Sentry に
// 送信し、その結果（DSN 設定有無・イベントID・flush 成否）を返す（14-6）。
// `?throw=1` を付けると捕捉されない例外を投げ、Next.js の自動計測経由の捕捉も確認できる。
// トークン不一致・CRON_SECRET 未設定時は 404 を返し、一般ユーザーからは
// 存在しないエンドポイントとして振る舞う。
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const token = req.nextUrl.searchParams.get("token");
  if (!secret || token !== secret) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const client = Sentry.getClient();
  const options = client?.getOptions();

  const eventId = Sentry.captureException(
    new Error(
      "Sentry connectivity test: intentional error from GET /api/debug/sentry"
    )
  );
  const flushed = await Sentry.flush(3000);

  if (req.nextUrl.searchParams.get("throw") === "1") {
    throw new Error(
      "Sentry connectivity test (uncaught): GET /api/debug/sentry?throw=1"
    );
  }

  return NextResponse.json({
    sentry: {
      dsnConfigured: Boolean(options?.dsn),
      environment: options?.environment ?? null,
      release: options?.release ?? null,
      eventId: eventId ?? null,
      flushed,
    },
  });
}
