import { vi } from "vitest";

type Spies = Record<string, (...args: unknown[]) => unknown>;

// supabase-js のクエリビルダーは任意の位置で await 可能（thenable）なため、
// どのメソッドチェーンでも同じ result に解決する Proxy で模倣する。
// spies に登録したメソッド名は呼び出し引数を記録できる。戻り値を明示的に
// 設定していない（undefined を返す）場合はチェーンを継続する（= proxy を返す）
export function chainable(result: unknown, spies: Spies = {}) {
  const proxy: unknown = new Proxy(
    {},
    {
      get(_target, prop: string) {
        if (prop === "then") {
          return (resolve: (value: unknown) => void) => resolve(result);
        }
        if (prop === "catch" || prop === "finally") return undefined;
        const spy = spies[prop];
        return (...args: unknown[]) => {
          const r = spy?.(...args);
          return r === undefined ? proxy : r;
        };
      },
    }
  );
  return proxy;
}

export function createSupabaseMock() {
  const from = vi.fn();
  const rpc = vi.fn();
  const supabase = { from, rpc } as never;
  return { supabase, from, rpc };
}
