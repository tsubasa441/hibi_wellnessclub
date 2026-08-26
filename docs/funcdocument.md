# Hibi フィットネスコミュニティ Web アプリ 設計書

**Version:** 1.0  
**Date:** 2026-06-14  
**Author:** Hibi 開発チーム

---

## 1. システム構成

| レイヤー | 技術 |
|---------|------|
| フロントエンド | Next.js 14（App Router） |
| バックエンド | Next.js API Routes / Supabase Functions |
| データベース | Supabase（PostgreSQL） |
| 認証 | Supabase Auth（メール + パスワード） |
| 決済 | Square API + PayPay API |
| ホスティング | Vercel |
| スタイリング | Tailwind CSS v4 |

---

## 2. DB 設計

### profiles

| カラム | 型 | 備考 |
|--------|-----|------|
| id | uuid | PK、auth.users と連携 |
| name | text | 氏名（暗号化）。管理者画面・CSVエクスポート・メール等、本人特定が必要な場面でのみ使用 |
| nickname | text | ニックネーム（平文、最大20文字）。ユーザーが見るUI画面の表示名はすべてこちらを使用する |
| avatar_url | text | プロフィール画像 |
| referral_code | text | UNIQUE、紹介コード |
| referred_by | uuid | FK → profiles.id |
| points | integer | 累計ポイント |
| is_admin | boolean | 管理者フラグ。既定値 false。付与は Supabase Studio から手動 UPDATE（@docs/authdesign.md 参照） |
| created_at | timestamptz | |

### events

| カラム | 型 | 備考 |
|--------|-----|------|
| id | uuid | PK |
| title | text | イベント名 |
| description | text | 説明文 |
| event_type | text | yoga / training / running / boxing / pilates |
| start_at | timestamptz | 開催日時 |
| end_at | timestamptz | 終了日時 |
| location | text | 開催場所 |
| meeting_place | text | 集合場所（開催場所とは別の具体的な待ち合わせ情報。任意） |
| remarks | text | 備考（説明文とは別の自由記述欄。任意） |
| belongings | text | 持ち物設定（参加者が持参すべき物の自由記述欄。任意） |
| capacity | integer | 定員 |
| price | integer | 価格（円） |
| status | text | draft / published / cancelled |
| created_at | timestamptz | |

### bookings

| カラム | 型 | 備考 |
|--------|-----|------|
| id | uuid | PK |
| user_id | uuid | FK → profiles.id |
| event_id | uuid | FK → events.id |
| payment_method | text | square / paypay / free |
| payment_status | text | pending / paid / refunded |
| payment_id | text | 決済 ID |
| status | text | confirmed / cancelled |
| points_used | integer | 予約時に充当したポイント数（1pt = 1円）。デフォルト0 |
| amount_charged | integer | Square / PayPay に実際に請求した金額（円）。ポイント全額充当時は0。価格変動時の返金額算出にはこの値を使う（`events.price` は使わない） |
| created_at | timestamptz | |

### badges

| カラム | 型 | 備考 |
|--------|-----|------|
| id | uuid | PK |
| name | text | バッジ名 |
| description | text | 説明 |
| condition_type | text | monthly_first_running / monthly_first_yoga / monthly_first_training / monthly_first_boxing / monthly_first_pilates / monthly_event_count / monthly_referral_count |
| condition_value | integer | 達成条件の数値 |
| icon_url | text | アイコン画像 |

### user_badges

| カラム | 型 | 備考 |
|--------|-----|------|
| id | uuid | PK |
| user_id | uuid | FK → profiles.id |
| badge_id | uuid | FK → badges.id |
| period | text | 対象月（"YYYY-MM"）。`(user_id, badge_id, period)` で複合ユニーク制約 |
| earned_at | timestamptz | 取得日時 |

### referrals

| カラム | 型 | 備考 |
|--------|-----|------|
| id | uuid | PK |
| referrer_id | uuid | FK → profiles.id（紹介した人） |
| referee_id | uuid | FK → profiles.id（紹介された人） |
| status | text | pending / rewarded |
| rewarded_at | timestamptz | ポイント付与日時 |
| created_at | timestamptz | |

### journals

| カラム | 型 | 備考 |
|--------|-----|------|
| id | uuid | PK |
| user_id | uuid | FK → profiles.id |
| recorded_at | date | 記録日 |
| mood | integer | 気分スコア（1〜5） |
| energy | integer | 体調スコア（1〜5） |
| note | text | 自由記述（任意） |
| created_at | timestamptz | |

---

## 3. API 設計

| メソッド | エンドポイント | 説明 | 認証 |
|---------|--------------|------|------|
| POST | `/api/payments/square` | Square 決済処理（予約作成込み） | 必要 |
| POST | `/api/payments/paypay` | PayPay 決済処理（予約作成込み） | 必要 |
| POST | `/api/bookings/[id]/cancel` | 予約キャンセル・返金処理 | 必要 |
| GET / POST | `/api/journals` | ジャーナル取得・記録 | 必要 |
| POST | `/api/signup/profile` | サインアップ時プロフィール作成・紹介報酬付与 | 必要 |
| POST | `/api/convert-name` | 名前ローマ字変換 | 必要 |
| GET | `/api/cron/badges` | 月次バッジボーナス付与（Vercel Cron。GETのみexport、Vercel Cronの既定に合わせた実装） | 不要（Cron Secret） |
| POST | `/api/rank/notify` | ランクアップ通知の既読化 | 必要 |
| POST | `/api/admin/events` | イベント作成 | 必要（管理者のみ） |
| PATCH | `/api/admin/events/[id]` | イベント更新 | 必要（管理者のみ） |
| DELETE | `/api/admin/events/[id]` | イベント削除（論理削除。`status` を `cancelled` に更新するのみ） | 必要（管理者のみ） |
| GET | `/api/admin/events/[id]/participants/export` | 参加者一覧の CSV エクスポート | 必要（管理者のみ） |

イベント一覧・詳細・プロフィールの取得は API Routes を介さず、Server Component から Supabase に直接クエリする（`docs/architecture.md` のデータフロー参照）。管理画面のイベント一覧・編集・参加者一覧も同様に Server Component から直接クエリし、書き込み（作成・更新・削除・CSV）のみ上記 API Routes を介する。

---

## 4. ポイント設計

| アクション | 付与ポイント | 付与タイミング | 失効 |
|-----------|------------|--------------|------|
| ジャーナル回答（1日1回） | 3pt | ジャーナル保存時 | なし |
| イベント参加（ランク別 30〜100pt） | ランク依存 | イベント翌日以降、ホーム画面ロード時 | なし |
| 月間全イベント参加ボーナス | 500pt | 月末を過ぎた後、ホーム画面ロード時 | なし |
| 紹介者への報酬 | 200pt | 被紹介者のイベント翌日以降、ホーム画面ロード時 | なし |
| 被紹介者への報酬 | 200pt | 自身のイベント翌日以降、ホーム画面ロード時 | なし |
| バッジ獲得数ボーナス（月次） | 3個:300pt / 5個:500pt / 9個:1000pt | 翌月1日 Cron 実行時 | なし |

**キャンセル時のポイント取り消し：** 予約キャンセル時、`event_participation` で付与済みのポイントを `points_log` から削除し `profiles.points` から減算する。`decrement_points` RPC を使用（最低0ptで保護）。

## 4-1. ポイントによる予約割引

イベント予約時、保有ポイントを 1pt = 1円としてその場で参加費に充当できる（`bookings.points_used`）。上限は参加費全額（0円決済も可）。

- 充当は `spend_points` RPC（残高が足りる場合のみ原子的に減算し成否を返す）で行い、`points_log`（reason: `booking_discount`）に記録する
- 決済額（Square / PayPay への請求額）は `参加費 - 充当ポイント`。0円になる場合は決済自体をスキップし、`payment_status` を即時 `paid` にする
- 決済成功後に予約作成が失敗した場合は、決済（あれば）とポイント充当の両方を取り消す（`src/lib/points.ts` の `refundUsedPoints` を使用）
- **キャンセル時：** キャンセルポリシー（2日前まで）を満たす場合、現金分の返金と同時に充当ポイントも全額 `profiles.points` へ払い戻す。2日前を過ぎたキャンセルは現金と同様、ポイントも払い戻し対象外

---

## 5. バッジ設計

バッジは**月間バッジ**のみ（累計参加数によるマイルストーンバッジは廃止）。`period`（"YYYY-MM"）単位で毎月リセットされ、`condition_type` + `condition_value` の組み合わせで判定する。

| バッジ名 | 条件 | condition_type | condition_value |
|---------|------|----------------|-----------------|
| Running First | 今月ランニングクラスに初参加 | monthly_first_running | 1 |
| Yoga First | 今月ヨガクラスに初参加 | monthly_first_yoga | 1 |
| Training First | 今月トレーニングクラスに初参加 | monthly_first_training | 1 |
| Boxing First | 今月ボクシングクラスに初参加 | monthly_first_boxing | 1 |
| Pilates First | 今月ピラティスクラスに初参加 | monthly_first_pilates | 1 |
| 3 Classes | 今月3回クラスに参加 | monthly_event_count | 3 |
| 5 Classes | 今月5回クラスに参加 | monthly_event_count | 5 |
| Bridge Builder | 今月友人を1人招待 | monthly_referral_count | 1 |
| Community Recruiter | 今月友人を3人招待 | monthly_referral_count | 3 |
| Ambassador | 今月友人を5人招待 | monthly_referral_count | 5 |

バッジ自体にポイント付与はなく、月間の獲得数に応じたボーナスポイント（3個:300pt / 5個:500pt / 9個:1000pt、最高ティアのみ付与）を翌月1日の Cron で一括付与する（4. ポイント設計を参照）。

---

## 6. 実装順序

| ステップ | 内容 | 状態 |
|---------|------|------|
| Step1 | Next.js・Supabase・認証フロー | ✅ 完了 |
| Step2 | イベント一覧・詳細・予約・決済 | ✅ 完了 |
| Step3 | マイページ・参加履歴・累計カウント | ✅ 完了 |
| Step4 | ポイント・バッジ | ✅ 完了 |
| Step5 | 紹介コード・報酬付与 | ✅ 完了 |
| Step6 | ジャーナル機能（当日記録のみ） | ✅ 完了 |
| Step7 | テスト・Vercel デプロイ・本番切り替え | 進行中（Vercel連携済み、決済本番申請待ち） |
| Step8 | 管理者機能（イベントCRUD・参加者一覧・CSVエクスポート） | ✅ 完了 |
