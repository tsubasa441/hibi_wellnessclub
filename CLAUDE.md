# Hibi — Claude 向け索引

## プロジェクト概要
フィットネスコミュニティの Web アプリ。イベント予約・決済・ゲーミフィケーション（ランク・ポイント・バッジ）・紹介システムを提供する。

- スタック: Next.js 14（App Router）/ TypeScript / Tailwind CSS v4 / Supabase / Vercel
- 決済: Square API / PayPay API

## ドキュメント
See @docs/product-vision.md for プロダクトビジョン・スコープ・設計の意図
See @docs/requirements.md for 機能要件・画面一覧
See @docs/funcdocument.md for DB・API・ポイント/バッジ設計
See @docs/architecture.md for システム構成・ディレクトリ構造
See @docs/authdesign.md for 認証フロー・RLS
See @docs/componentdesign.md for コンポーネント定義
See @docs/codingstandards.md for 命名規則・禁止事項
See @docs/frontdesign.md for カラー・フォント・余白

## ルール
See @.claude/rules/frontend.md for フロントエンド実装ルール
See @.claude/rules/backend.md for バックエンド・API実装ルール

## 開発コマンド
See @package.json for 利用可能なnpmコマンド
```bash
npm run dev    # localhost:3000
npm run build
npm run lint
```

## IMPORTANT: 実装前に必ずやること
1. 該当する docs を読む
2. 設計にないものは実装しない
3. 不明点は先に質問する
