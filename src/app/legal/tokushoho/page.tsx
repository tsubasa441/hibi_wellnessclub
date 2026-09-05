import Link from "next/link";
import Footer from "@/components/Footer";

const ITEMS: { label: string; value: string }[] = [
  { label: "販売事業者", value: "Hibi" },
  { label: "運営責任者", value: "中村瞭佑" },
  { label: "所在地", value: "請求があった場合には遅滞なく開示いたします。" },
  { label: "電話番号", value: "請求があった場合には遅滞なく開示いたします。" },
  { label: "メールアドレス", value: "hibi.wellnessclub@gmail.com" },
  { label: "販売価格", value: "各イベントの詳細ページに表示する金額によります。" },
  { label: "販売価格以外に必要な料金", value: "イベント参加費以外に追加費用は発生しません。" },
  { label: "お支払い方法", value: "クレジットカード（Square）／PayPay／その他" },
  { label: "お支払い時期", value: "予約確定時に決済されます。" },
  { label: "サービスの提供時期", value: "予約完了後、イベント開催日時にサービスを提供します。" },
  {
    label: "キャンセル・返金について",
    value: "イベント開催日の2日前まで全額返金いたします。それ以降のキャンセルは返金対象外となります。",
  },
];

export default function TokushohoPage() {
  return (
    <main className="relative min-h-screen app-bg flex flex-col items-center px-4 pt-10 sm:pt-16 pb-4">
      <div className="relative z-10 w-full max-w-2xl nm-card p-6 sm:p-8 animate-fade-up">
        <div className="text-center mb-6">
          <span className="font-outfit text-2xl font-medium text-ink-700 tracking-wide">Hibi</span>
        </div>
        <h1 className="font-cormorant text-2xl font-semibold text-ink-700 tracking-wide text-center mb-8">
          特定商取引法に基づく表記
        </h1>

        <dl className="space-y-5">
          {ITEMS.map((item) => (
            <div key={item.label} className="border-b border-base-200 pb-4 last:border-0 last:pb-0">
              <dt className="font-outfit text-xs font-medium text-ink-300 mb-1">{item.label}</dt>
              <dd className="font-dm text-sm text-ink-500 leading-relaxed whitespace-pre-line">{item.value}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-8 text-center">
          <Link href="/" className="font-outfit text-xs text-sage-500 hover:text-sage-600 transition">
            トップページに戻る
          </Link>
        </div>
      </div>

      <Footer />
    </main>
  );
}
