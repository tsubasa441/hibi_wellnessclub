"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import LoadingScreen from "@/components/LoadingScreen";

const SHOW_AFTER_MS = 600;
// 遷移先が今と同じ画面にリダイレクトされたときなど、URL が変わらなくても出たままにならないように
const GIVE_UP_MS = 15000;

// loading.tsx を置くと、押した瞬間に今の画面が消えて空白と読み込み画面の点滅が出るため、置かない。
// 今の画面を残したまま切り替え、時間がかかるときだけ全画面の読み込み画面を出す（2026-11-01、依頼者の指定）
export default function NavigationLoading() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const route = `${pathname}?${searchParams.toString()}`;

  const [visible, setVisible] = useState(false);
  const timers = useRef<number[]>([]);

  // URL が変わったら消す
  const [previousRoute, setPreviousRoute] = useState(route);
  if (route !== previousRoute) {
    setPreviousRoute(route);
    setVisible(false);
  }

  useEffect(() => {
    function clearTimers() {
      timers.current.forEach((id) => window.clearTimeout(id));
      timers.current = [];
    }

    function handleClick(e: MouseEvent) {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const link = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link || link.hasAttribute("download") || (link.target && link.target !== "_self")) return;

      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname.startsWith("/api/")) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;

      clearTimers();
      timers.current = [
        window.setTimeout(() => setVisible(true), SHOW_AFTER_MS),
        window.setTimeout(() => setVisible(false), GIVE_UP_MS),
      ];
    }

    document.addEventListener("click", handleClick);
    return () => {
      document.removeEventListener("click", handleClick);
      clearTimers();
    };
  }, [route]);

  return visible ? <LoadingScreen /> : null;
}
