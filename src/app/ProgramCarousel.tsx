"use client";

import { useEffect, useRef, useState } from "react";
import EventTypeIcon from "@/components/EventTypeIcon";

// description は改行してよい位置で区切った文節の配列（日本語が単語の途中で折り返されないように）
const PROGRAMS: { type: string; name: string; label: string; description: string[]; descriptionEn: string }[] = [
  {
    type: "running",
    name: "Run",
    label: "ランニング",
    description: ["仲間と街を走り、", "ゴールのあとは", "ご褒美のおいしいもので", "ひと休み。"],
    descriptionEn: "Run the city with friends, then treat yourself to something tasty.",
  },
  {
    type: "training",
    name: "Training",
    label: "トレーニング",
    description: ["スタジオ、", "公園、", "ビーチ。", "場所を変えて、", "からだを動かす", "楽しさを再発見。"],
    descriptionEn: "Studios, parks, beaches. Rediscover the joy of moving in new places.",
  },
  {
    type: "boxing",
    name: "Boxing",
    label: "ボクシング",
    description: ["基本から", "一つずつ学べて、", "初めてでも安心。", "思い切り打ち込んで", "ストレス発散。"],
    descriptionEn: "Learn the basics step by step, then punch your stress away.",
  },
  {
    type: "yoga",
    name: "Yoga",
    label: "ヨガ",
    description: ["自分に", "集中したいときに。", "呼吸を整えて、", "からだと心を", "ゆるめる時間。"],
    descriptionEn: "A time to focus on yourself, breathe, and let body and mind unwind.",
  },
  {
    type: "pilates",
    name: "Pilates",
    label: "ピラティス",
    description: ["体幹を鍛えて、", "正しい姿勢と", "しなやかなからだを", "手に入れる。"],
    descriptionEn: "Strengthen your core for better posture and a supple body.",
  },
];

const AUTO_ADVANCE_MS = 4500;
// 指・矢印で操作したあと、自動送りを再開するまでの時間
const RESUME_AFTER_MS = 8000;

export default function ProgramCarousel() {
  const trackRef = useRef<HTMLDivElement>(null);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [index, setIndex] = useState(0);
  const [hovering, setHovering] = useState(false);
  const [interacted, setInteracted] = useState(false);

  function isAtEnd(track: HTMLDivElement) {
    return track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
  }

  function scrollToIndex(i: number) {
    const track = trackRef.current;
    const card = track?.children[i] as HTMLElement | undefined;
    if (!track || !card) return;
    track.scrollTo({ left: card.offsetLeft - track.offsetLeft, behavior: "smooth" });
  }

  // スクロール位置（スワイプ・矢印・自動送り）から、いま先頭に見えているカードを求める。右端まで来たら最後のカード
  function handleScroll() {
    const track = trackRef.current;
    const first = track?.children[0] as HTMLElement | undefined;
    if (!track || !first) return;
    if (isAtEnd(track)) {
      setIndex(PROGRAMS.length - 1);
      return;
    }
    const step = first.offsetWidth + parseFloat(getComputedStyle(track).columnGap || "0");
    setIndex(Math.min(PROGRAMS.length - 1, Math.round(track.scrollLeft / step)));
  }

  function pauseForAWhile() {
    setInteracted(true);
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => setInteracted(false), RESUME_AFTER_MS);
  }

  useEffect(() => () => {
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
  }, []);

  useEffect(() => {
    if (hovering || interacted) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setInterval(() => {
      const track = trackRef.current;
      if (!track) return;
      if (isAtEnd(track)) scrollToIndex(0);
      else scrollToIndex(index + 1);
    }, AUTO_ADVANCE_MS);
    return () => clearInterval(timer);
  }, [index, hovering, interacted]);

  function go(delta: number) {
    pauseForAWhile();
    const track = trackRef.current;
    if (delta > 0 && track && isAtEnd(track)) scrollToIndex(0);
    else scrollToIndex((index + delta + PROGRAMS.length) % PROGRAMS.length);
  }

  return (
    <div className="relative" onMouseEnter={() => setHovering(true)} onMouseLeave={() => setHovering(false)}>
      <div
        ref={trackRef}
        onScroll={handleScroll}
        onTouchStart={pauseForAWhile}
        className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        aria-roledescription="carousel"
        aria-label="Program"
      >
        {PROGRAMS.map((p) => (
          <article
            key={p.type}
            className="snap-start shrink-0 w-[78%] sm:w-[calc((100%-2rem)/3)] bg-white border border-base-200 rounded-2xl p-6 flex flex-col items-center text-center"
          >
            <EventTypeIcon type={p.type} size="lg" />
            <h3 className="font-bebas text-3xl text-ink-700 tracking-[0.04em] mt-4">{p.name}</h3>
            <p className="font-outfit text-xs text-ink-300 mt-0.5">{p.label}</p>
            <p className="font-zenkaku text-sm text-ink-500 leading-relaxed mt-3">
              {p.description.map((phrase) => (
                <span key={phrase} className="inline-block">{phrase}</span>
              ))}
            </p>
            <p lang="en" className="font-dm text-xs text-ink-300 leading-relaxed text-balance mt-2">{p.descriptionEn}</p>
          </article>
        ))}
      </div>

      <div className="flex items-center justify-center gap-4 mt-5">
        <button
          type="button"
          onClick={() => go(-1)}
          aria-label="前のプログラム"
          className="hidden sm:flex w-9 h-9 rounded-full border border-base-200 bg-white text-ink-700 items-center justify-center hover:bg-base-100 transition"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div className="flex items-center gap-2">
          {PROGRAMS.map((p, i) => (
            <button
              key={p.type}
              type="button"
              onClick={() => {
                pauseForAWhile();
                scrollToIndex(i);
              }}
              aria-label={`${p.label}を表示`}
              aria-current={i === index}
              className={`h-1.5 rounded-full transition-all ${i === index ? "w-6 bg-ink-700" : "w-1.5 bg-ink-200"}`}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => go(1)}
          aria-label="次のプログラム"
          className="hidden sm:flex w-9 h-9 rounded-full border border-base-200 bg-white text-ink-700 items-center justify-center hover:bg-base-100 transition"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  );
}
