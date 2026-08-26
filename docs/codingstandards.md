# Hibi コーディング規約

---

## 言語・基本方針

- TypeScript を使用。`any` は極力使わない
- ESLint・Prettier のルールに従う
- コメントは書かない（必要な場合のみ WHY を1行で）

---

## ファイル・ディレクトリ命名

| 種別 | 規則 | 例 |
|------|------|----|
| ページ | `page.tsx`（固定） | `app/events/page.tsx` |
| コンポーネント | PascalCase | `BookingButton.tsx` |
| ライブラリ | camelCase | `supabase/client.ts` |
| 型定義 | PascalCase | `Event`, `Booking` |

---

## コンポーネント

```tsx
// ✅ 関数コンポーネント + export default
export default function EventCard({ event }: { event: Event }) {
  return <div>...</div>;
}

// ❌ アロー関数での export default は使わない
export default () => <div>...</div>;
```

---

## データ取得

```tsx
// ✅ Server Component でのデータ取得
export default async function Page() {
  const supabase = createClient(); // server.ts
  const { data } = await supabase.from("events").select("*");
  return <div>{...}</div>;
}

// ✅ Client Component での操作
"use client";
const supabase = createClient(); // client.ts
await supabase.from("bookings").insert({...});
```

---

## スタイリング

- Tailwind CSS のユーティリティクラスのみ使用
- インラインスタイル（`style={{}}`）は使用禁止
- カスタムカラーは `globals.css` の CSS 変数を経由する（`base-*` / `ink-*` / `sage-*`）
- 絵文字はUI内で使用禁止（アイコンは SVG のみ）
- `brand-*` / `gray-*` / `green-*` / `brown-*` / `cream-*` / `sand-*` / `pink-*` などプロジェクト外のカラーは使用禁止

---

## フォント使い分け

| 用途 | クラス |
|------|-------|
| タイトル・見出し | `font-cormorant` |
| ボタン・ラベル・ナビ | `font-outfit` |
| 本文・説明文 | `font-dm` |

---

## 型定義

```ts
// ✅ 型はコンポーネントファイル内か types/ に定義
type Event = {
  id: string;
  title: string;
  price: number;
};

// ❌ any の多用禁止（Supabase の返却値を除く）
const data: any = await supabase...;
```

---

## 個人情報保護

**個人情報が流出する実装は絶対にしない。個人情報保護を徹底した実装にする。**

- 氏名・性別・生年月日・メールアドレス等の個人情報は必ず暗号化して保存する（`src/lib/encrypt.ts` 経由。@docs/authdesign.md 参照）
  - 例外: `profiles.nickname` はユーザーが自ら公開を意図して設定する表示名であり、氏名等の機微な個人情報とは性質が異なるため平文で保存する
- ログ（`console.log`・エラーメッセージ等）に個人情報を出力しない
- API レスポンスは必要最小限のフィールドのみ返す。本人以外が閲覧できる形で個人情報を含めない
- 個人情報を URL パラメータ・クエリストリングに含めない
- Supabase RLS を必ず有効化し、本人以外がアクセスできないようにする（@docs/authdesign.md の RLS 方針を参照）

---

## 禁止事項

- `brand-*` カラーの使用
- 絵文字の使用
- `style={{}}` インラインスタイル
- 設計書（funcdocument.md）にない機能の独断実装
- `console.log` を本番コードに残す
- 個人情報が流出しうる実装（暗号化の省略、ログ出力、過剰なレスポンス、RLS 未適用など）
