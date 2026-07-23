import Kuroshiro from "kuroshiro";
import KuromojiAnalyzer from "kuroshiro-analyzer-kuromoji";

let kuroshiro: InstanceType<typeof Kuroshiro> | null = null;

async function getKuroshiro() {
  if (kuroshiro) return kuroshiro;
  kuroshiro = new Kuroshiro();
  await kuroshiro.init(new KuromojiAnalyzer());
  return kuroshiro;
}

export async function toRomaji(text: string): Promise<string> {
  try {
    const k = await getKuroshiro();
    const result = await k.convert(text, { to: "romaji", mode: "spaced" });
    return result
      .split(" ")
      .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ")
      .trim();
  } catch {
    return text;
  }
}
