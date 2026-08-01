# バックエンドルール

## Supabase（Server Component / API Routes）

- `src/lib/supabase/server.ts` を使う
- RLS が全テーブルに適用されている前提で実装する
- 直接 SQL は書かず、Supabase クライアント経由でアクセスする

## ポイント付与

- 付与は必ず `src/lib/points.ts` の `awardPoints()` を経由する
- `points_log` の unique 制約（`user_id`, `reason`, `reference_id`）で二重付与を防ぐ
- キャンセル時は `revokeEventPoints()` でポイントを取り消す

## ランク処理

- ランクアップ判定は `src/lib/ranks.ts` の `checkRankUp()` を使う
- ランクダウンなし。`Math.max(earnedLevel, currentLevel)` で降格しない

## バッジ付与

- イベント参加バッジ: `src/lib/badges.ts` の `checkEventBadges()`
- 紹介バッジ: `src/lib/badges.ts` の `checkReferralBadges()`
- バッジは月単位（`period = "YYYY-MM"`）でリセットされる

## API Routes 共通

- 認証必須のエンドポイントは冒頭で `supabase.auth.getUser()` を確認する
- エラー時は適切な HTTP ステータスコードを返す（401 / 403 / 404 / 500）
- `console.log` を残さない
- `any` 型禁止。Supabase の返却値は型アサーションで対応する

## シークレット

- 環境変数は `.env.local` で管理し、コードへのハードコード禁止
- `.env.local.example` に変数名だけ記載する

## 個人情報保護

**個人情報が流出する実装は絶対にしない。個人情報保護を徹底した実装にする。**

- 氏名・性別・生年月日・メールアドレス等の個人情報は `src/lib/encrypt.ts` で暗号化してから保存する
- `console.log`・エラーメッセージに個人情報を出力しない
- API レスポンスは必要最小限のフィールドのみ返す（本人以外が閲覧できる形で個人情報を含めない）
- 個人情報を URL パラメータ・クエリストリングに含めない
- 全テーブルで RLS が有効であることを前提とし、本人以外がアクセスできる実装をしない
