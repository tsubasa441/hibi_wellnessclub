import Kuroshiro from "kuroshiro";
import KuromojiAnalyzer from "kuroshiro-analyzer-kuromoji";

let kuroshiro: InstanceType<typeof Kuroshiro> | null = null;

async function getKuroshiro() {
  if (kuroshiro) return kuroshiro;
  kuroshiro = new Kuroshiro();
  await kuroshiro.init(new KuromojiAnalyzer());
  return kuroshiro;
}

// 中黒（･）等の記号は登録 API の name_roman チェック（文字・空白・'・- のみ）を通らないため空白に置き換え、
// 連続する空白をまとめて各語の先頭を大文字にする
export function formatRomaji(raw: string): string {
  return raw
    .replace(/[^\p{L}\s'-]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export async function toRomaji(text: string): Promise<string> {
  try {
    const k = await getKuroshiro();
    const result = await k.convert(text, { to: "romaji", mode: "spaced" });
    return formatRomaji(result);
  } catch {
    return text;
  }
}
