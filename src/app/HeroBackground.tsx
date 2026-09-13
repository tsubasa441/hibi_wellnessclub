"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

export type HeroSlide =
  | { type: "image"; src: string }
  | { type: "video"; src: string; poster?: string };

const SLIDE_DURATION_MS = 7000;

export default function HeroBackground({ slides }: { slides: HeroSlide[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, SLIDE_DURATION_MS);
    return () => clearInterval(timer);
  }, [slides.length]);

  return (
    <div className="absolute inset-0">
      {slides.map((slide, i) => (
        <div
          key={i}
          className={`absolute inset-0 transition-opacity duration-1000 ${i === index ? "opacity-100" : "opacity-0"}`}
        >
          {slide.type === "video" ? (
            <video
              src={slide.src}
              poster={slide.poster}
              autoPlay
              muted
              loop
              playsInline
              className="w-full h-full object-cover object-center"
            />
          ) : (
            <Image
              src={slide.src}
              alt=""
              fill
              className="object-cover object-center"
              priority={i === 0}
            />
          )}
        </div>
      ))}
    </div>
  );
}
