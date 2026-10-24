import { getJstParts } from "@/lib/date";

// ログイン・新規登録画面の見出し（Bebas の大文字で表示する英語の一言）。季節・時間帯（JST）に合う候補と
// どの時でも使える候補を合わせ、その中からランダムに1つ選ぶ（2026-10-25、依頼者の指定。思わず答えたくなる一言）
export type GreetingMode = "signin" | "signup";
export type TimeOfDay = "morning" | "daytime" | "evening" | "night";
export type Season = "spring" | "summer" | "autumn" | "winter";

export function getTimeOfDay(hours: number): TimeOfDay {
  if (hours >= 5 && hours < 10) return "morning";
  if (hours >= 10 && hours < 17) return "daytime";
  if (hours >= 17 && hours < 22) return "evening";
  return "night";
}

export function getSeason(month: number): Season {
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "autumn";
  return "winter";
}

const GREETINGS: Record<GreetingMode, { always: string[]; time: Record<TimeOfDay, string[]>; season: Record<Season, string[]> }> = {
  signin: {
    always: ["Hello!", "Welcome back!", "Good to see you!"],
    time: {
      morning: ["Good morning!", "Did you sleep well?", "Ready to move today?"],
      daytime: ["How's your day going?", "Need a little break?"],
      evening: ["How was your day?", "Time to shake off the day?"],
      night: ["Still up?", "Winding down tonight?"],
    },
    season: {
      spring: ["Feeling the spring breeze?", "Cherry blossoms out yet?"],
      summer: ["Staying cool today?", "Ready for a summer sweat?"],
      autumn: ["Perfect weather to move!", "Ready for an autumn run?"],
      winter: ["Staying warm out there?", "Ready to warm up?"],
    },
  },
  signup: {
    always: ["Nice to meet you!", "Welcome to Hibi!", "Ready for something new?"],
    time: {
      morning: ["Good morning! Nice to meet you!", "A fresh start this morning?"],
      daytime: ["Hello! Nice to meet you!", "What moves you?"],
      evening: ["Good evening! Nice to meet you!", "What moves you?"],
      night: ["A new chapter tonight?", "Dreaming of a new routine?"],
    },
    season: {
      spring: ["New season, new you?"],
      summer: ["Ready for a summer of moving?"],
      autumn: ["Best season to start, right?"],
      winter: ["Ready to warm up together?"],
    },
  },
};

export function pickGreeting(mode: GreetingMode, now: Date = new Date(), random: () => number = Math.random): string {
  const { hours, month } = getJstParts(now);
  const pool = GREETINGS[mode];
  const candidates = [...pool.always, ...pool.time[getTimeOfDay(hours)], ...pool.season[getSeason(month)]];
  return candidates[Math.min(Math.floor(random() * candidates.length), candidates.length - 1)];
}
