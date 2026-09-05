import { NextRequest, NextResponse } from "next/server";
import { toRomaji } from "@/lib/toRomaji";
import { checkRateLimit, getClientIp, RATE_LIMIT_MESSAGE } from "@/lib/rateLimit";

export async function POST(req: NextRequest) {
  // サインアップ完了前（未認証）に呼ばれるため、ユーザーIDではなくIPアドレスで制限する
  if (!(await checkRateLimit(`convert-name:${getClientIp(req)}`, 20, 60))) {
    return NextResponse.json({ error: RATE_LIMIT_MESSAGE }, { status: 429 });
  }

  const { name } = await req.json();
  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  const romaji = await toRomaji(name);
  return NextResponse.json({ romaji });
}
