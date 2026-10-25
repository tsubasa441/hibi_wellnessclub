import AppFooter from "@/components/AppFooter";
import BottomNav from "@/components/BottomNav";
import Header from "@/components/Header";

const FAQ: { category: string; items: { q: string; a: string }[] }[] = [
  {
    category: "予約・お支払い",
    items: [
      {
        q: "イベントはどうやって予約しますか？",
        a: "下のメニューの「予約」からイベントを選び、詳細画面の「予約する」から手続きしてください。有料のイベントは、お支払いが完了した時点で予約が確定します。",
      },
      {
        q: "お支払い方法を教えてください。",
        a: "クレジットカード（Square）とPayPayがご利用いただけます。保有しているポイントを、1ポイント＝1円として参加費に充てることもできます。",
      },
      {
        q: "クレジットカードを登録しておけますか？",
        a: "一度クレジットカードでお支払いいただくと、そのカードが自動で登録され、次回からはカード番号の入力を省けます。マイページのアカウント設定から、事前の登録や変更もできます。",
      },
      {
        q: "予約をキャンセルしたいです。",
        a: "「予約」の「予約済み」からキャンセルできます。イベント開催日の2日前までのキャンセルは、お支払いいただいた金額を全額返金し、使ったポイントも払い戻します。前日・当日のキャンセルは、返金・ポイントの払い戻しの対象外です。",
      },
      {
        q: "返金はいつ反映されますか？",
        a: "お支払いに使った決済手段（クレジットカード／PayPay）を通じて返金します。反映されるまでの期間は、カード会社・PayPayによって異なります。",
      },
    ],
  },
  {
    category: "参加・チェックイン",
    items: [
      {
        q: "チェックインとは何ですか？",
        a: "イベントに参加したことを記録する操作です。当日、下のメニュー中央の「チェックイン」から、イベントの開始30分前から開始15分後までの間に行ってください。この時間を過ぎるとチェックインできません。チェックインした予約だけが参加として数えられ、ポイント・バッジ・ランクの対象になります。",
      },
      {
        q: "チェックインを忘れてしまいました。",
        a: "イベントの終了時刻を過ぎるとチェックインはできません。お手数ですが、マイページの「お問い合わせ」からご連絡ください。",
      },
    ],
  },
  {
    category: "ポイント・ランク・バッジ",
    items: [
      {
        q: "ポイントはどうやって貯まりますか？",
        a: "イベントへの参加（ランクに応じて1回30〜100ポイント）、友人の紹介（200ポイント）、その月の公開イベントすべてへの参加（500ポイント）、月間バッジの獲得数に応じたボーナス（3個で300、5個で500、9個で1,000ポイント）で貯まります。参加ポイントは、参加後にホーム画面を開いたときにまとめて付与されます。",
      },
      {
        q: "ポイントに有効期限はありますか？",
        a: "有効期限はありません。ポイントは参加費への充当にのみ使え、現金や他の商品との交換、他の方への譲渡はできません。",
      },
      {
        q: "ランクはどうやって上がりますか？",
        a: "累計の参加回数（上位のランクでは、紹介して参加につながった人数も）に応じて、Seed（種）からAncient Tree（大樹）までの8段階で上がります。一度上がったランクが下がることはありません。条件はインパクト画面の「ランクについて」で確認できます。",
      },
      {
        q: "バッジとは何ですか？",
        a: "月ごとの参加状況や紹介の数に応じてもらえる、その月だけのバッジです。毎月リセットされ、インパクト画面で確認できます。",
      },
    ],
  },
  {
    category: "友人の紹介",
    items: [
      {
        q: "友人を紹介するにはどうすればいいですか？",
        a: "インパクト画面にあるあなたの紹介コード（またはシェア用のリンク）を友人に送ってください。友人が新規登録のときに紹介コードを入力し、初めてイベントにチェックインした時点で、あなたと友人の両方に200ポイントが付与されます。",
      },
    ],
  },
  {
    category: "アカウント",
    items: [
      {
        q: "ニックネームやパスワードを変更したいです。",
        a: "マイページのアカウント設定から変更できます。",
      },
      {
        q: "パスワードを忘れてしまいました。",
        a: "ログイン画面の「パスワードをお忘れの方」からメールアドレスを入力すると、再設定用のメールが届きます。メールが届かない場合は、迷惑メールフォルダもご確認ください。",
      },
      {
        q: "退会するにはどうすればいいですか？",
        a: "マイページの「アカウントを削除する」から退会できます。退会すると氏名などの個人情報は匿名化され、ログインできなくなります。残っているポイントも使えなくなりますのでご注意ください。",
      },
      {
        q: "運営に問い合わせたいです。",
        a: "マイページの「お問い合わせ」から、運営とメッセージでやり取りできます。返信があると、メールでお知らせします。",
      },
    ],
  },
];

// ログイン後のフッター（AppFooter）から開く。個人の情報を表示しないため未ログインでも閲覧できる（2026-10-24、依頼者の指定）
export default function FaqPage() {
  return (
    <main className="relative min-h-screen app-bg flex flex-col">
      <Header />

      <div className="w-full max-w-2xl mx-auto px-4 py-6 sm:px-6 sm:py-8">
        <h1 className="font-zenkaku text-lg font-bold text-ink-700 tracking-wide mb-5">よくあるご質問</h1>

        <div className="space-y-6">
          {FAQ.map((group) => (
            <section key={group.category}>
              <h2 className="font-zenkaku text-sm text-ink-500 tracking-wide mb-2 px-1">{group.category}</h2>
              <div className="bg-white -mx-4 sm:mx-0 divide-y divide-base-200">
                {group.items.map((item) => (
                  <details key={item.q} className="group">
                    <summary className="list-none [&::-webkit-details-marker]:hidden cursor-pointer select-none flex items-start justify-between gap-3 px-5 py-4 hover:bg-base-50 transition">
                      <span className="font-zenkaku text-sm text-ink-700 leading-relaxed">{item.q}</span>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 mt-0.5 text-ink-300 transition-transform group-open:rotate-180">
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </summary>
                    <p className="px-5 pb-4 font-dm text-sm text-ink-500 leading-relaxed">{item.a}</p>
                  </details>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      <AppFooter />
      <BottomNav />
    </main>
  );
}
