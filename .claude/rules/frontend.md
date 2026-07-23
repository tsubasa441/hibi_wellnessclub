# フロントエンドルール

## コンポーネント

- 関数コンポーネント + `export default function` を使う（アロー関数の export default は禁止）
- Server Component がデフォルト。インタラクションが必要な場合のみ `"use client"` を付ける
- Server Component 内で `useState` / `useEffect` 等のクライアント専用 API は使用禁止

## スタイリング

- Tailwind CSS ユーティリティクラスのみ使用
- インラインスタイル（`style={{}}`）禁止
- 使用できるカラーは `base-*` / `ink-*` / `sage-*` のみ（`globals.css` の CSS 変数）
- 設計外のカラー（`brand-*` / `gray-*` / `green-*` / `brown-*` / `cream-*` / `sand-*` / `pink-*` 等）禁止
- UI に絵文字禁止。アイコンは SVG アウトラインのみ（stroke-width: 1.5px、`currentColor`）

## フォント使い分け

| 用途 | クラス |
|------|--------|
| タイトル・見出し | `font-cormorant` |
| ボタン・ラベル・ナビ・数値 | `font-outfit` |
| 本文・説明文 | `font-dm` |

## 画像

- `<Image>` コンポーネント使用必須
- `width` / `height` 属性必須
- ファイルは `public/images/` に配置

## Supabase（Client Component）

- `src/lib/supabase/client.ts` を使う
- コンポーネント内への直接クエリは禁止。API Routes または Server Component 経由にする
