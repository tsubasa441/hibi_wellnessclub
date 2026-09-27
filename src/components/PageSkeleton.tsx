import BottomNav from "@/components/BottomNav";
import Header from "@/components/Header";

// 画面遷移中に即座に表示する読み込み中の枠（loading.tsx から使う）
export default function PageSkeleton({ cards = 3 }: { cards?: number }) {
  return (
    <main className="relative min-h-screen app-bg pb-24" aria-busy="true">
      <Header />
      <div className="max-w-2xl mx-auto px-4 py-8 sm:px-6 sm:py-10 space-y-4 animate-pulse">
        <div className="h-8 w-40 rounded-lg bg-base-200" />
        {Array.from({ length: cards }).map((_, i) => (
          <div key={i} className="bg-white border border-base-200 rounded-2xl p-5 flex items-start gap-4">
            <div className="w-14 h-14 rounded-full bg-base-200 shrink-0" />
            <div className="flex-1 space-y-3">
              <div className="h-4 w-2/3 rounded bg-base-200" />
              <div className="h-3 w-1/2 rounded bg-base-200" />
              <div className="h-3 w-1/3 rounded bg-base-200" />
            </div>
          </div>
        ))}
      </div>
      <BottomNav />
    </main>
  );
}
