import { NextRequest, NextResponse } from "next/server";
import { toRomaji } from "@/lib/toRomaji";

export async function POST(req: NextRequest) {
  const { name } = await req.json();
  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  const romaji = await toRomaji(name);
  return NextResponse.json({ romaji });
}
