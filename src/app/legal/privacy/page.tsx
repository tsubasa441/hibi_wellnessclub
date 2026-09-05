import Link from "next/link";
import Footer from "@/components/Footer";

const SECTIONS: { title: string; body: React.ReactNode }[] = [
  {
    title: "1. はじめに",
    body: (
      <p>
        Hibi（以下「当方」といいます）は、フィットネスコミュニティアプリ「Hibi」（以下「本サービス」といいます）における個人情報の取り扱いについて、以下のとおりプライバシーポリシー（以下「本ポリシー」といいます）を定めます。
      </p>
    ),
  },
  {
    title: "2. 取得する情報",
    body: (
      <>
        <p className="mb-3">本サービスは、会員登録・ご利用にあたり以下の情報を取得します。</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>氏名・ニックネーム・性別・生年月日・メールアドレス</li>
          <li>パスワード（Supabase Authにより認証情報として管理されます）</li>
          <li>イベントの予約・参加・キャンセル履歴、選択項目への回答、チェックイン履歴</li>
          <li>決済に関する情報（クレジットカード番号そのものは当方では保持せず、Square・PayPayが処理します）</li>
          <li>ポイント・バッジ・ランク等のご利用状況</li>
          <li>紹介コード・紹介関係に関する情報</li>
          <li>ジャーナル機能に入力される気分・体調に関する任意の記録</li>
        </ul>
      </>
    ),
  },
  {
    title: "3. 利用目的",
    body: (
      <>
        <p className="mb-3">取得した情報は、以下の目的の範囲内で利用します。</p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>本人確認・ログイン認証のため</li>
          <li>イベントの予約受付・決済処理・キャンセル・返金対応のため</li>
          <li>予約確認・キャンセル通知等、本サービスに関するご連絡のため</li>
          <li>ポイント・バッジ・ランク等のゲーミフィケーション機能、紹介プログラムを提供するため</li>
          <li>本サービスの運営・改善、お問い合わせへの対応のため</li>
          <li>
            個人を特定できない形に統計処理した上で、法人（企業等）向けの健康影響レポート作成の基礎データとして利用するため（氏名・連絡先等、個人を特定する情報は含みません）
          </li>
        </ul>
      </>
    ),
  },
  {
    title: "4. 第三者提供・外部サービスの利用",
    body: (
      <>
        <p className="mb-3">
          当方は、法令に基づく場合を除き、ご本人の同意なく個人情報を第三者に提供することはありません。一方で、本サービスの提供にあたり、以下の外部サービスに業務委託先として必要な範囲の情報を取り扱わせています。
        </p>
        <ul className="list-disc pl-5 space-y-1.5">
          <li>Supabase（データベース・認証基盤）</li>
          <li>Square・PayPay（決済処理。カード情報等の決済情報は各社が直接取り扱います）</li>
          <li>Resend（予約確認・キャンセル通知等のメール配信）</li>
        </ul>
      </>
    ),
  },
  {
    title: "5. Cookie等の利用",
    body: (
      <p>
        本サービスは、ログイン状態を維持するための認証セッション情報をCookieに保存します。広告目的でのCookie利用は行っておりません。
      </p>
    ),
  },
  {
    title: "6. 安全管理措置",
    body: (
      <p>
        氏名・性別・生年月日等の機微な個人情報は暗号化して保存します。また、データベースへのアクセス制御（Row Level Security）により、ご本人以外が他のユーザーの個人情報にアクセスできない設計としています。
      </p>
    ),
  },
  {
    title: "7. 個人情報の保有期間",
    body: (
      <p>
        取得した個人情報は、本サービスのご利用に必要な期間、または法令上保存が義務付けられる期間保有します。退会・削除をご希望の場合は、下記お問い合わせ窓口までご連絡ください。
      </p>
    ),
  },
  {
    title: "8. 開示・訂正・利用停止等の請求",
    body: (
      <p>
        ご本人からの個人情報の開示・訂正・追加・削除・利用停止等のご請求には、ご本人確認のうえ、法令に従い遅滞なく対応いたします。下記お問い合わせ窓口までご連絡ください。
      </p>
    ),
  },
  {
    title: "9. お問い合わせ窓口",
    body: (
      <p>
        本サービスの個人情報の取り扱いに関するお問い合わせは、下記メールアドレスまでご連絡ください。
        <br />
        Hibi　運営責任者：中村瞭佑
        <br />
        メールアドレス：hibi.wellnessclub@gmail.com
      </p>
    ),
  },
  {
    title: "10. 本ポリシーの改定",
    body: (
      <p>
        当方は、必要に応じて本ポリシーの内容を改定することがあります。重要な変更を行う場合は、本サービス上で周知いたします。
        <br />
        制定日：2026年9月5日
      </p>
    ),
  },
];

export default function PrivacyPolicyPage() {
  return (
    <main className="relative min-h-screen app-bg flex flex-col items-center px-4 pt-10 sm:pt-16 pb-4">
      <div className="relative z-10 w-full max-w-2xl nm-card p-6 sm:p-8 animate-fade-up">
        <div className="text-center mb-6">
          <span className="font-outfit text-2xl font-medium text-ink-700 tracking-wide">Hibi</span>
        </div>
        <h1 className="font-cormorant text-2xl font-semibold text-ink-700 tracking-wide text-center mb-8">
          プライバシーポリシー
        </h1>

        <div className="space-y-7">
          {SECTIONS.map((section) => (
            <section key={section.title}>
              <h2 className="font-outfit text-sm font-semibold text-ink-700 mb-2">{section.title}</h2>
              <div className="font-dm text-sm text-ink-500 leading-relaxed">{section.body}</div>
            </section>
          ))}
        </div>

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
