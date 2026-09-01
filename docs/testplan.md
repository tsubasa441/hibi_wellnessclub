# Hibi テスト項目チェックリスト

**Version:** 1.0
**Date:** 2026-08-18

---

## 目的・使い方

`docs/requirements.md` の画面一覧・`docs/funcdocument.md` の API 設計に対応する確認項目一覧。リリース前や大きな変更後に、このチェックリストを上から順になぞることで「仕様書通りに動くか」を確認する。

- **自動テスト**列に記載があるものは `npm run test` で自動的に確認できる（ロジック単体テスト）。ファイルは `src/**/*.test.ts`。
- 自動テストがない項目（画面表示・画面遷移・UIの見た目）は、開発サーバー（`npm run dev`）を起動し手動でなぞる。
- **状態**列は直近の確認結果。確認したら日付と結果（✅ OK / ❌ NG＋内容）を書き換える。
- Square / PayPay の実決済（カード情報入力〜実際の課金）は本番/サンドボックス環境への副作用があるため、本チェックリストでは**確認手順のみ記載**し、実行は都度judgeする（本番決済情報を用いた実行は慎重に行う）。

---

## ⚠️ 既知の不具合

| ID | 内容 | 影響範囲 | 状態 |
|----|------|---------|------|
| BUG-1 | `src/app/login/LoginForm.tsx` の `POST /api/signup/profile` 呼び出しがレスポンスの成否を確認していなかった。ローマ字氏名に長音（マクロン、例: 「号」→`Gō`）を含む場合、`src/app/api/signup/profile/route.ts` の `NAME_ROMAN_REGEX` に一致せず400が返るが、クライアントはエラーを無視してそのまま「登録が完了しました」画面に遷移していた。結果、性別・生年月日・氏名（暗号化）・`name_roman`・紹介コード適用が一切保存されず、紹介者・被紹介者への200pt付与も発生しない状態だった | 日本語氏名に長音を含むケース全般（例:陽子→Yōko、裕太→Yūta等）でサインアップが部分的に失敗し、紹介システムが機能しない事例になりうる | ✅ 2026-08-18 修正済み。`NAME_ROMAN_REGEX` をUnicode文字全般（`\p{L}`）を許容する形に変更し、`LoginForm.tsx`はレスポンス失敗時に1回リトライ→それでも失敗時は`/register-complete?profileError=1`で警告表示するよう修正。macron入り氏名で紹介コード付きサインアップ→200pt付与・Bridge Builderバッジ付与・紹介履歴表示まで再現テストし正常動作を確認 |
| BUG-2 | `POST /api/journals` に同日2回目の記録を送ると、ユニーク制約違反が握りつぶされず 500 Internal Server Error（`{"error":"保存に失敗しました"}`）として返る。二重付与は防げているが、想定内の重複という状況を500として扱っている | ログ監視上「サーバーエラー」として誤検知されうる（実害は小さい） | ✅ 2026-08-27 再検証したところ再現せず。`journals` は `unique(user_id, recorded_at)` を`onConflict`に指定した`upsert`で実装されており、同日2回目の送信（直列・並行いずれも）は正しく既存行を更新して200を返すことをローカルで複数パターン確認（同一内容の連続送信・異なる内容での上書き・`Promise.all`による完全同時送信）。記録当時と実装は変わっていない（このファイルの唯一のコミットは初期コミット）ため、当時の症状は別要因だった可能性が高いが再現しないため対応不要と判断しクローズ |
| DOC-1 | `docs/funcdocument.md` は `POST /api/cron/badges` と記載しているが、実装（`src/app/api/cron/badges/route.ts`）は `GET` のみ export（Vercel Cron の既定に合わせた実装として妥当）。ドキュメントの表記が実装と不一致 | ドキュメントのみ。動作に影響なし | ✅ 2026-08-27 修正済み。`docs/funcdocument.md`のAPI一覧を`GET`表記に修正し、GETのみexportである旨の注記を追加 |
| BUG-3 | パスワード再設定メールのリンクをタップしても、新しいパスワード入力画面に遷移しない不具合。原因は複合的だった：(1) Vercel本番環境に `NEXT_PUBLIC_SITE_URL` が未設定/`localhost`のままで、`resetPasswordForEmail` の `redirectTo` が本番ドメインを指していなかった、(2) Supabase Dashboard の Authentication > URL Configuration で本番ドメインが Redirect URLs に未登録だった、(3) `NEXT_PUBLIC_SITE_URL` の値に末尾スラッシュが付いていたため `${siteUrl}/auth/reset-password` が二重スラッシュになり、Redirect URLs 登録後もSupabase側の許可リストと一致せずSite URL（トップページ）にフォールバックしていた。加えて `src/app/auth/reset-password/page.tsx` がリンク無効・期限切れ時のエラーを検知せず空フォームを表示するだけだった | 全ユーザーがパスワード再設定機能を利用できない状態だった | ✅ 2026-08-22 修正済み。Vercelの `NEXT_PUBLIC_SITE_URL` を本番ドメイン（末尾スラッシュなし）に設定し直し、Supabase Dashboard の Redirect URLs に `https://hibi-wellnessclub.jp/**` を登録。あわせて `LoginForm.tsx`・`impact/page.tsx`・`api/payments/paypay/route.ts` で `NEXT_PUBLIC_SITE_URL` 使用時に末尾スラッシュを除去する防御的処理を追加し、`reset-password/page.tsx` を作り直して `onAuthStateChange` の `PASSWORD_RECOVERY` イベント検知・エラーパラメータ検知・タイムアウトによる「リンクが無効です」表示を実装。本番でメールリンク→パスワード再設定→ログインまで一連の動作を確認 |
| BUG-4 | 本番（`https://hibi-wellnessclub.jp/login`）のSIGN UPタブで、iPhone実機（Safari）表示時に DATE OF BIRTH の入力欄（`input[type="date"]`）が他の入力欄と揃った角丸カードの枠からはみ出して表示される。iOS Safari が `input[type="date"]` の内部表示（年/月/日）にCSS指定幅を超える最小幅を確保することがある既知のWebKitの挙動が原因 | 新規登録フォームの見た目が崩れる（入力・登録自体は可能） | ✅ 2026-08-27 修正済み。1回目の対応（`overflow-hidden`でクリップ）はユーザーの実機確認で「若干見切れている」ままと判明したため、`input[type="date"]`自体をやめてネイティブ描画に依存しない年・月・日の3つの`<select>`プルダウンに置き換え。年は1900〜今年を降順、月は1〜12、日は選択中の年月に応じた日数（うるう年考慮）に動的に絞り込み、月/年変更で選択中の日が無効になった場合は自動リセットする実装。ローカルで年=2000・月=2（うるう年）を選び日の選択肢が29日までに絞られ31日選択がリセットされることを確認、実際にサインアップも完了し暗号化された生年月日が保存されることを確認。プルダウン方式のためブラウザ・OS依存のレンダリング差異が原理的に発生しない。`npm run test`93件・lintとも通過 |
| BUG-5（重大） | 定員に達したイベントでも、まだそのイベントを予約していない一般ユーザーからは満席と認識されず、予約が通ってしまう（定員超過の予約が作成される）。原因は`bookings`テーブルのRLS（本人の行のみ閲覧可）により、予約確定前の残席チェック・詳細画面の残り枠表示・決済画面への到達可否判定が、いずれもログインユーザー自身のRLS付きセッションで「他人の予約件数」を数えており、常に0件として扱われていたため。3-6の確認中にユーザーが「別アカウントで満席表示にならない」ことを発見し、実際に定員1のテストイベントで2件の確定予約（2/1）が作られていたことをDBで確認して発覚 | 一般ユーザーの予約フロー全体で定員超過（オーバーブッキング）が発生しうる、本番でも再現する重大な不具合 | ✅ 2026-08-23 修正済み。`api/payments/square/route.ts`・`api/payments/paypay/route.ts`・`events/[id]/page.tsx`・`events/[id]/checkout/page.tsx`の残席カウントを`createServiceClient()`（service_role、RLS迂回・集計目的のみ）経由に変更。`npm run test`（93件）全通過を確認。なお同時リクエストによる競合（check-then-insertのTOCTOU）は今回の修正範囲外で、4-8として別途未確認のまま |
| BUG-6 | `src/app/events/[id]/BookingButton.tsx`の`handleFreeBooking`・`handleCancel`が、成功時に`loading`／`cancelLoading`を`false`へ戻していなかった。無料イベントを予約→キャンセルすると、同一ページ内で「予約する」ボタンが「予約中...」表示のまま`disabled`に固まり、逆に予約→キャンセル→再予約すると「予約をキャンセルする」ボタンが「キャンセル中...」表示のまま固まる（いずれもフルリロードするまで再操作不能）。5-5の確認中に発見 | 無料イベントで予約・キャンセルを繰り返すと同一ページ内で操作不能になる（ページ再読み込みで回避可能なため実害は限定的） | ✅ 2026-08-26 修正済み。`userBooking` propが実際に切り替わったタイミングでのみ`loading`/`cancelLoading`をリセットする`useEffect`を追加（fetch直後に即リセットすると、`router.refresh()`の反映前に一瞬ボタンが再度押せる状態になり二重予約・二重キャンセルにつながるため、あえてprop変化をトリガーにした）。予約⇔キャンセルを2周連続で行い、両方向とも固まらないことを確認 |
| BUG-7（重大） | BUG-5修正後も、`api/payments/square・paypay/route.ts`の残席チェックが「SELECT件数→比較→INSERT」の2ステップのままで、2つのリクエストがほぼ同時に届くと両方とも「空きあり」と判定してしまうTOCTOU競合が残っていた。4-8の確認のため、定員1のテストイベントに2ユーザーから`Promise.all`で完全同時にINSERTするNode検証スクリプトを作成したところ、実際に確定予約が2件（定員超過）作られることを再現した | 短時間に複数の予約が競合した場合、定員超過（オーバーブッキング）が発生しうる。本番でも起こりうる重大な不具合 | ✅ 2026-08-26 修正済み。`supabase/migrations/023_booking_capacity_trigger.sql`を追加し、`bookings`へのINSERT前に`events`行を`FOR UPDATE`でロックしてから残席を数え、満席なら例外を投げるDBトリガー（`check_booking_capacity`）で同一イベントへの同時予約を直列化。Supabase StudioのSQL Editorで本番に適用。適用後、同じ検証スクリプトを3回連続実行し、いずれも確定予約が1件のみ（もう一方は「イベントは満席です」で拒否）になることを確認。満席でない通常の単独予約が誤ってブロックされないことも別途確認。`npm run test`93件全通過 |
| BUG-9（重大） | BUG-3 修正後も、リセット申請した端末・ブラウザと別の端末でメールのリンクを開くとパスワード再設定画面に進めず「リンクが無効です」になる。原因は `@supabase/ssr` の `createBrowserClient` が `flowType` を `pkce` に固定しており（node_modules 実装で確認）、`resetPasswordForEmail` が PKCE の `code_verifier` を申請元ブラウザの Cookie に保存する方式のため。メールの `{{ .ConfirmationURL }}`（`/auth/v1/verify` → `?code=` 付きで `/auth/reset-password` へリダイレクト）を別端末で開くと verifier が無く `exchangeCodeForSession` が失敗し、`reset-password/page.tsx` が5秒でタイムアウト無効判定していた。加えて Gmail 等のリンクプリフェッチで `/auth/v1/verify` の1回限りトークンが消費され `otp_expired` になるケースもあった | 別端末（PCで申請→スマホでメール等）でのパスワード再設定が全滅。実運用で最も多いパターン | ✅ 2026-09-01 修正。token_hash 方式に変更：`src/app/auth/confirm/route.ts`（route handler）を新設し `verifyOtp({ type: "recovery", token_hash })` をサーバー側で実行して Cookie にリカバリーセッションを確立してから `/auth/reset-password` へリダイレクト（PKCE verifier 不要＝別端末で成立）。`reset-password/page.tsx` は `getSession` を最大8秒ポーリングして Cookie セッション確立を待ち、`error_description`/`error_code` を画面に表示するよう改善。ローカルで `admin.generateLink({ type: "recovery" })` の token_hash を `/auth/confirm` に通し、307で `/auth/reset-password`（error なし）へ遷移＋`sb-*-auth-token` Cookie が発行されることを確認。`npm run test` 128件・lint・build 通過。**本番反映には Supabase Dashboard の対応が必須**（下記 更新履歴 2026-09-01 参照） |
| BUG-8（重大） | 日付・時刻を扱う多数の箇所が`getHours()`・`getMonth()`・`toLocaleDateString()`（timeZone未指定）等、サーバーの実行タイムゾーンに依存する方法で実装されていた。ローカル開発機（JST）では正しく見えるが、Vercelのサーバーレス関数はUTCで動作するため、同じイベントの開始時刻がローカルで「19:00」、本番で「10:00」と9時間ズレて表示されることが判明。`api/cron/badges/route.ts`だけは過去に手動でJSTオフセットを適用済みだったが（開発者が問題を認識していた形跡）、他の箇所には展開されていなかった。表示（イベント日時・予約確認メール・Member since等）だけでなく、月間バッジ・月間ボーナスの集計期間（`badges.ts`の`monthBounds`等）やジャーナルの「今日」判定（`toISOString().split("T")[0]`はUTC基準になるため、JST 0:00〜9:00は前日として扱われてしまう）にも影響する業務ロジック上のバグだった | 表示の見た目のズレに加え、月境界付近でのバッジ・ボーナス誤集計、深夜早朝のジャーナル記録の日付ズレなど、実データに影響しうる重大な不具合 | ✅ 2026-08-27 修正済み。`src/lib/date.ts`にJST基準の共通ヘルパー（`getJstParts`・`getTodayJst`・`getYearMonthJst`・`getJstMonthBounds`・`toJstDateTimeLocal`・`fromJstDateTimeLocal`）を新設し、`badges.ts`・`points.ts`・`impact/page.tsx`・`home/page.tsx`・`api/journals/route.ts`・`api/signup/profile/route.ts`（集計・判定ロジック）と、`email.ts`・`events/page.tsx`・`events/[id]/page.tsx`・`bookings/page.tsx`・`events/[id]/checkout/page.tsx`・`admin/events/page.tsx`・`admin/events/[id]/participants/page.tsx`・`admin/events/EventForm.tsx`（表示・管理画面の日時入力フォーム）を置き換え。`date.test.ts`で13件のユニットテスト（うるう年・年またぎ・往復変換含む）を追加。`TZ=UTC`／`TZ=Asia/Tokyo`双方で同じイベントの計算結果が一致すること（修正前は10時/19時とズレ、修正後は両方19時）を確認し、`npm run build`の型チェック・実機（ローカルサーバー）での表示・管理画面での編集保存の往復もズレないことを確認。`npm run test`106件（93件+新規13件）・lintとも通過 |

---

## 1. 認証・アカウント（`/login`, `/register-complete`, `/auth/reset-password`）

| # | 確認項目 | 期待結果 | 自動テスト | 状態 |
|---|---------|---------|-----------|------|
| 1-1 | `/login` にサインアップフォームで NAME・EMAIL・PASSWORD・GENDER・DATE OF BIRTH を入力し登録 | 登録成功、自動ログイン、`/register-complete` へ遷移 | - | ✅ 2026-08-18 |
| 1-2 | サインアップ時に REFERRAL CODE を入力（紹介経由） | `referrals` レコード作成、紹介者・被紹介者双方に200pt付与 | - | ✅ 2026-08-18（BUG-1修正後に再テスト。長音入り氏名でも紹介者+200pt・被紹介者+200pt・`referrals`が`rewarded`になることを確認） |
| 1-3 | パスワードが「8文字以上・英大文字/英小文字/数字/記号すべて含む」を満たさない場合 | バリデーションエラーが表示され登録できない | - | ✅ 2026-08-18 |
| 1-4 | `/login` の SIGN IN タブでメール・パスワードを入力しログイン | `/home` へ遷移 | - | ✅ 2026-08-18 |
| 1-5 | 認証済み状態で `/login` に直接アクセス | 自動で `/home` にリダイレクト | - | ✅ 2026-08-18 |
| 1-6 | ヘッダーの「ログアウト」を押す | セッションが切れ `/` へ遷移 | - | ✅ 2026-08-18 |
| 1-7 | `/login` の「パスワードをお忘れの方」からメールアドレスを送信 | 「メールを送信しました」画面が表示される | - | ✅ 2026-08-18 |
| 1-8 | 送信されたリセットメールのリンクから `/auth/reset-password` を開き新パスワードを設定 | 再設定完了画面→「ログイン画面へ」で `/login` に遷移しログイン可能 | - | ✅ 2026-08-22（BUG-3修正後に本番環境で確認。スマホ実機でメールリンク→`/auth/reset-password`遷移→新パスワード設定→ログインまで一連の動作を確認） |
| 1-9 | 未認証で `/home`・`/impact`・`/bookings`・`/events/[id]/checkout` にアクセス | すべて `/login` にリダイレクト | - | ✅ 2026-08-18 |

## 2. ホーム（`/home`）

| # | 確認項目 | 期待結果 | 自動テスト | 状態 |
|---|---------|---------|-----------|------|
| 2-1 | ホーム画面表示 | ランク・累計参加数・Points・次回イベント・「次のランクまであと n 回」が表示される | - | ✅ 2026-08-18 |
| 2-2 | 予約済みイベントが0件のとき | ホーム上部の「予約済みイベント」セクション自体が非表示になる（`upcomingBookings.length > 0` の場合のみ表示。「次回のイベント」欄は予約有無に関わらず、直近の公開イベントを常に表示する） | - | ✅ 2026-08-18（項目の記述を実装に合わせて修正） |
| 2-3 | 今日のジャーナル未記録のとき | 気分・体調・気づき入力フォームが表示される | - | ✅ 2026-08-18 |
| 2-4 | 今日のジャーナル記録済みのとき | 「今日の記録は完了しています」表示に切り替わる | - | ✅ 2026-08-18 |
| 2-5 | ホーム画面ロード時、未付与ポイント（参加・月間ボーナス）がある場合 | `checkAndAwardPendingPoints` が実行されポイントが加算される | `points.test.ts` | ✅ 2026-08-28（参加ポイント：price=0の過去日時テストイベントを作成・予約→`/home`ロードで`points_log`に`event_participation`理由で30pt記録、`profiles.points`加算をDBで確認（2026-08-23）。月間全イベント参加ボーナス：既存イベントが1件もない過去月（2026年6月）にテストイベント2件を作成・全予約→`/home`ロードで`points_log`に`monthly_bonus`理由（`reference_id: "2026-06"`）で500pt記録、参加ポイント2件（30pt×2）と合計してprofile.pointsが560になることを確認。再度`/home`をロードしても重複付与されないことも確認。**紹介報酬（200pt）はこの一括付与処理の対象外と判明**——`checkAndAwardPendingPoints`のコードを確認したところ紹介関連のロジックは実装されておらず、実際はサインアップ完了時（`/api/signup/profile`）に即時付与される別経路（1-2・6-7で確認済み）。`docs/funcdocument.md`の「イベント翌日以降、ホーム画面ロード時」という記載は実装と不一致だったため修正した） |

## 3. イベント一覧・詳細（`/events`, `/events/[id]`）

| # | 確認項目 | 期待結果 | 自動テスト | 状態 |
|---|---------|---------|-----------|------|
| 3-1 | `/events` 一覧表示 | 種別バッジ・タイトル・日時・場所・価格・定員が表示される | - | ✅ 2026-08-18 |
| 3-2 | 開催日時が本日より前のイベント | 一覧に表示されない（`status=published` かつ `start_at` が未来のみ） | - | ✅ 2026-08-18（本セッションで修正・確認） |
| 3-3 | `status` が `draft` / `cancelled` のイベント | 一般ユーザーの一覧・詳細に表示されない（RLS） | - | ✅ 2026-08-30（本番DBに対し実地検証。service_roleで draft / cancelled / published のテストイベントを1件ずつ作成し、anonキー（＝一般ユーザーと同じ非管理者ロール。events SELECT のRLSは「published は全員可」＋「管理者は全件可」の2ポリシーのみで `authenticated` と `anon` で結果は同一）で確認：(1) id指定の単一取得で draft・cancelled はともに0行（`events/[id]/page.tsx` は status で絞らず RLS 依存のため `event=null`→`notFound()` になる）、published のみ取得可、(2) 一覧取得でも published のみ返る（`events/page.tsx` は加えて明示的に `.eq("status","published")` でも二重に防御）。service_roleでは3件すべて見えることを対照確認。テストイベント3件は検証後ハード削除で後片付け済み） |
| 3-4 | `/events/[id]` 詳細表示 | 日時・場所・参加費・残り枠（n / capacity）・詳細・キャンセルポリシーが表示される | - | ✅ 2026-08-18 |
| 3-5 | `meeting_place`・`remarks`・`belongings` が設定されているイベントの詳細 | 集合場所・備考・持ち物が表示される | - | ✅ 2026-08-23（テストイベント「testイベント」で集合場所・備考・持ち物の3項目すべてが表示されることを確認） |
| 3-6 | 満席（残り0）のイベント詳細 | 予約ボタンが無効化される、または満席表示になる | - | ✅ 2026-08-23 BUG-5修正後、定員1・確定予約1件の状態で未予約の別アカウントから開き、「残り枠：満席」＋予約ボタンがdisabledで「満席」表示になることを確認 |

## 4. 予約・決済（`/events/[id]/checkout`）

| # | 確認項目 | 期待結果 | 自動テスト | 状態 |
|---|---------|---------|-----------|------|
| 4-1 | チェックアウト画面表示 | イベント情報・お支払い金額・Square/PayPay選択・ポイント利用欄が表示される | - | ✅ 2026-08-18 |
| 4-2 | ポイント利用欄に保有pt以下の数値を入力 | 参加費からポイント割引が引かれ、お支払い金額が再計算される（1pt=1円） | - | ✅ 2026-08-18 |
| 4-3 | ポイント利用欄に保有pt超の数値を入力 | 保有pt以内に制限される、またはエラー | - | ✅ 2026-08-26（UIは`maxPoints=min(pointsBalance, event.price)`でクランプ済み。念のためAPIを直接叩き、保有10ptに対し15pt充当を指定→サーバー側`spendPointsForBooking`（`spend_points`RPC）が原子的に拒否し400「ポイント残高が不足しています」を返すことを確認） |
| 4-4 | 参加費全額をポイントで充当（0円決済） | Square/PayPay決済がスキップされ即時 `payment_status=paid` で予約確定 | `square/route.test.ts` 等のロジック側で該当ケースを確認 | ✅ 2026-08-26（価格10円・保有10ptのテストイベントを全額ポイント充当で予約。CSVで決済方法=Square・決済ステータス=支払済み・使用ポイント=10・請求金額=0を確認。ポイント残高も10→0に減算） |
| 4-5 | Square でカード情報を入力し決済を実行 | 決済成功→`bookings` に insert→`/events/[id]?booked=1` へリダイレクト | `square/route.test.ts` | 未実施（実決済のため） |
| 4-6 | PayPay を選択し決済を実行 | PayPayアプリへの遷移→コールバック後に予約確定 | `paypay/route.test.ts` | 未実施（実決済のため） |
| 4-7 | 決済成功後、予約作成（insert）が失敗するケース | 決済とポイント充当の両方が取り消される（`refundUsedPoints`） | - | ✅ 2026-08-26（`square/route.test.ts`に決済成功→insert失敗→Square自動返金＋`refundUsedPoints`呼び出し、および返金自体が失敗した場合のケースまで自動テストで網羅されており全通過を確認。実決済を伴うため live 実行はせず自動テストの内容確認に留めた） |
| 4-8 | 満席になった直後に2人が同時予約 | 定員超過の予約が作られない（競合制御） | - | ✅ 2026-08-26（BUG-7として発見・修正。定員1のテストイベントに2ユーザーから完全同時にINSERTを行うNode検証スクリプトで実際にオーバーブッキング（確定予約2件）を再現→`023_booking_capacity_trigger.sql`でevents行をロックしてから残席を数えるDBトリガーを追加しSupabase Studioで本番適用→再検証で3回連続、定員超過が防がれ確定予約が1件のみになることを確認。満席でない通常予約が誤ってブロックされないことも確認。`npm run test`93件全通過） |

## 5. 予約済みイベント・キャンセル（`/bookings`, `/api/bookings/[id]/cancel`）

| # | 確認項目 | 期待結果 | 自動テスト | 状態 |
|---|---------|---------|-----------|------|
| 5-1 | 予約が0件のとき `/bookings` を開く | 「予約中のイベントはありません」＋「イベントを探す」導線 | - | ✅ 2026-08-18 |
| 5-2 | 予約済みイベントがあるとき | 予約一覧が表示され、キャンセルボタンがある | - | ✅ 2026-08-23（テスト予約で`/bookings`に一覧・キャンセルボタン表示を確認） |
| 5-3 | イベント2日前までにキャンセル | 全額返金（現金分＋充当ポイント両方が払い戻される） | `cancel/route.test.ts` | ✅ 2026-08-23（価格20円・開始5日後のテストイベントを20pt全額充当で予約→キャンセルし、`profiles.points`が20pt払い戻され元の残高に復元することをDBで確認。現金決済なし＝amount_charged=0のため現金返金経路は本テストでは検証していない） |
| 5-4 | イベント1日前・当日にキャンセル | キャンセル自体は可能だが返金・ポイント払い戻し対象外 | `cancel/route.test.ts` | ✅ 2026-08-23（価格20円・開始が数時間後（当日）のテストイベントを20pt全額充当で予約→キャンセル。予約は正常にキャンセルされるが`points_log`の`booking_discount`(-20pt)は削除されず、`profiles.points`も10ptのまま（払い戻しなし）であることをDBで確認） |
| 5-5 | 無料イベント（price=0）のキャンセル | 返金処理なしでキャンセルできる | `cancel/route.test.ts` | ✅ 2026-08-26（価格0円・定員10名のテストイベントを作成し予約→キャンセル。`payment_method=free`のため返金APIは呼ばれず、エラーなく即キャンセルされ予約状況が0/10に戻ることを確認。確認中にBUG-6を発見・修正） |
| 5-6 | キャンセル時、付与済みイベント参加ポイントがある場合 | `points_log` から削除、`profiles.points` から減算（0未満にならない） | `points.test.ts` | ✅ 2026-08-30（コード解析で確定。`event_participation` の付与は `checkAndAwardPendingPoints`（ホームロード時、条件 `start_at+2h <= now`）のみ、`revokeEventPoints` の呼び出し元は `cancel/route.ts` のみでキャンセルは `start_at+2h <= now` のとき拒否。両条件は完全排他のため、正規フローでは「参加ポイント付与済み かつ キャンセル可能」は同時成立せず `revokeEventPoints` は `if (!log) return` で空振りする。唯一到達する経路は「参加ポイント付与後に管理者がイベントを未来日時へ延期」した場合で、このとき `revokeEventPoints` が正しく30ptを取り消す。`revokeEventPoints` の両分岐（ログ無し=no-op／ログ有り=`decrement_points`）は `points.test.ts` の単体テストでカバー済み、`decrement_points` RPC は `greatest(0, points - amount)` で0未満保護（`012_decrement_points_rpc.sql`）。cancel ルートのテストも成功キャンセル時に `revokeEventPoints` が必ず呼ばれることを確認済み） |

## 6. Impact（`/impact`）— プロフィール・ランク・バッジ・紹介

| # | 確認項目 | 期待結果 | 自動テスト | 状態 |
|---|---------|---------|-----------|------|
| 6-1 | Impact画面表示 | 現在のランク・累計参加回数・ポイント残高・ランク一覧が表示される | - | ✅ 2026-08-18 |
| 6-2 | ランクアップ条件（累計参加回数・紹介人数）を満たした場合 | `checkRankUp()` によりランクが上がる。降格しない | `ranks.test.ts` | ✅ 2026-08-26（テストイベントを3件予約し累計参加回数を2→5にしたところ、Seed→Sproutにランクアップし`/home`にRANK UPモーダルが表示されることを確認。降格処理自体が実装されていない＝`Math.max(earnedLevel, currentLevel)`で常に非減少であることをコードで確認。なお本テストでこのアカウントのランクは実データ上Sproutのまま戻せない状態になっており、ユーザー承知の上で対応） |
| 6-3 | 月間バッジの進捗表示 | 今月のクラス初参加／参加回数／紹介人数の進捗が表示される | `badges.test.ts` | ✅ 2026-08-18（0件表示のみ確認） |
| 6-4 | 月間バッジ獲得条件を満たす（紹介1人でBridge Builder） | `user_badges` に `(user_id, badge_id, period)` でレコードが作られる | `badges.test.ts` | ✅ 2026-08-18（BUG-1修正後に再テスト。紹介1人達成でBridge Builderバッジが獲得バッジ欄に表示。イベント参加系バッジは実予約が必要なため別途未確認） |
| 6-5 | 紹介コード表示 | 自分のユニークな紹介コードが表示される | - | ✅ 2026-08-18 |
| 6-6 | 「紹介リンクをシェア」「リンクをコピー」ボタン | クリックでエラーが出ない（共有 or クリップボードにコピー） | - | ✅ 2026-08-18 |
| 6-7 | 紹介実績（紹介人数・初回参加完了数・履歴） | 紹介した人がいる場合に一覧表示される | - | ✅ 2026-08-18（BUG-1修正後に再テスト。紹介した人数1・初回参加完了1・紹介履歴に相手の名前と+200ptが表示されることを確認）。2026-08-27にユーザー依頼で「獲得ポイント」カードを削除（`docs/requirements.md`も合わせて更新） |

## 7. ジャーナル

| # | 確認項目 | 期待結果 | 自動テスト | 状態 |
|---|---------|---------|-----------|------|
| 7-1 | ホーム画面から気分・体調を選択し記録する | 保存成功、3pt付与、「記録済み」表示に切り替わる | - | ✅ 2026-08-18 |
| 7-2 | 同じ日に2回目の記録を試みる | 1日1回のみ（`journals` に同日重複レコードが作られない） | - | ✅ 2026-08-18（重複挿入は防止されポイントも二重付与なし。ただしBUG-2としてレスポンスが500になる点は別記） |
| 7-3 | 気づき（note）を空のまま記録 | 任意項目のため記録できる | - | ✅ 2026-08-18 |

## 8. Cron・バックエンドロジック

| # | 確認項目 | 期待結果 | 自動テスト | 状態 |
|---|---------|---------|-----------|------|
| 8-1 | `/api/cron/badges` を `CRON_SECRET` なしで叩く | 401 等で拒否される | - | ✅ 2026-08-18（実装は`GET`のみ。`POST`は405。DOC-1参照） |
| 8-2 | 月初、`CRON_SECRET` 付きで `/api/cron/badges` を実行 | 前月の月間バッジ獲得数に応じたボーナス（3個:300pt / 5個:500pt / 9個:1000pt、最高ティアのみ）が付与される | `route.test.ts`, `points.test.ts` | ✅ 2026-08-28（正しいSecretで実行し200が返ること、ポイントティア計算3/5/9個→300/500/1000ptは`points.test.ts`の`awardBadgeCountPoints`テスト7パターンで確認済み。「月初(1日)のみ実行」の日付ゲート自体は、本日が1日でないため実地では再現できないが、`api/cron/badges/route.test.ts`が`vi.setSystemTime()`で日時を偽装し、JST月初1日での前月分付与・JST2日以降は付与しない・UTC/JSTの年またぎ境界（UTC 12/31 15:00=JST 1/1 0:00）・UTC日付だけ見ると1日でもJSTではまだ前月末という境界の4パターンを検証しており、日付ゲート自体も自動テストでカバー済みと判断） |
| 8-3 | `POST /api/rank/notify` | ランクアップ通知が既読化される | - | ✅ 2026-08-26（6-2でランクアップ直後の`/home`でRANK UPモーダル表示→「ホームに戻る」クリックで`POST /api/rank/notify`が200、再度`/home`を開いてもモーダルが再表示されないことを確認） |
| 8-4 | `POST /api/convert-name` | 日本語名がローマ字に変換される | - | ✅ 2026-08-18（サインアップ時に内部呼び出しを確認） |

## 9. 管理者機能（`/admin/*`, `is_admin=true` が必要）

| # | 確認項目 | 期待結果 | 自動テスト | 状態 |
|---|---------|---------|-----------|------|
| 9-1 | 非管理者が `/admin/events` にアクセス | `/home` にリダイレクト | `admin.test.ts` | ✅ 2026-08-18 |
| 9-2 | 未認証で `/admin/events` にアクセス | `/login` にリダイレクト | - | ✅ 2026-08-26（ログアウト状態で`/admin/events`にアクセスし`/login`にリダイレクトされることを確認。あわせて未認証で`POST /api/admin/events`を直接叩き401が返ることも確認） |
| 9-3 | 管理者で `/admin/events` を開く | draft/publishedのイベント一覧が表示される（cancelledは一覧から除外） | - | ✅ 2026-08-23（管理者アカウントで確認。あわせて仕様変更：削除済み(cancelled)イベントは一覧から非表示にするようDB取得クエリに`.neq("status","cancelled")`を追加し、`docs/requirements.md`・`docs/architecture.md`を更新） |
| 9-4 | `/admin/events/new` でイベントを新規作成 | `POST /api/admin/events` が成功し一覧に反映される | `admin/events/route.test.ts` | ✅ 2026-08-26（管理画面フォームおよびAPI直接呼び出しの両方でイベント作成に成功し、一覧に反映されることを確認） |
| 9-5 | 不正な入力（定員0以下、価格負数など）で作成 | バリデーションエラーで作成されない | `eventValidation` 関連 | ✅ 2026-08-26（管理画面フォームでは`input[type=number] min`属性によりUI上そもそも投稿がブロックされる。念のためAPIを直接叩き、定員0・価格-100を指定→400「定員は1以上の整数で入力してください」で拒否されることを確認） |
| 9-6 | `/admin/events/[id]` で既存イベントを編集 | `PATCH /api/admin/events/[id]` が成功し変更が反映される | `admin/events/[id]/route.test.ts` | ✅ 2026-08-26（テストイベントのタイトル・説明・開催場所・定員・価格をPATCHで変更し、一覧に反映されることを確認） |
| 9-7 | `/admin/events/[id]` の削除ボタン | 確認ダイアログ→`DELETE /api/admin/events/[id]`で論理削除（`status=cancelled`）。予約履歴は保持される | `admin/events/[id]/route.test.ts` | ✅ 2026-08-23（テストイベント「ポイント確認テスト」で確認。確認ダイアログ→論理削除まで正常動作。削除後、管理者一覧に「削除済み」表示のまま残る仕様だったが、9-3の仕様変更に伴い一覧からは非表示に変更） |
| 9-8 | `/admin/events/[id]/participants` で参加者一覧表示 | 予約者一覧が表示される | - | ✅ 2026-08-26（テスト予約1件に対し、氏名（復号済み）・決済方法・決済状況・使用ポイント・予約日時が正しく表示されることを確認） |
| 9-9 | 参加者一覧のCSVエクスポート | `GET /api/admin/events/[id]/participants/export` でCSVがダウンロードされ、氏名等が正しく復号されている | `participants/export/route.test.ts` | ✅ 2026-08-26（`GET .../export`が200・`text/csv`で返り、氏名が正しく復号（「水元　翼」）された状態でCSVに出力されることを確認） |
| 9-10 | 一般ユーザーが `/api/admin/events` 系APIを直接叩く | 401/403で拒否される | `admin/events/route.test.ts` | ✅ 2026-08-26（自分のメールの+エイリアスで非管理者のテストアカウントを新規作成し、`POST`/`PATCH`/`DELETE` `/api/admin/events`系を直接叩いたところ、いずれも403「権限がありません」で拒否されることを確認） |

## 10. 個人情報保護・横断チェック

| # | 確認項目 | 期待結果 | 状態 |
|---|---------|---------|------|
| 10-1 | 氏名・性別・生年月日・メールアドレスが暗号化されて保存されている（Supabase Studioで`profiles`テーブルを直接確認） | 平文で保存されていない | ✅ 2026-08-18（service_roleでの読み取り専用クエリで`name`/`name_roman`/`gender`/`birth_date`が`iv:tag:ciphertext`形式で暗号化されていることを確認。メールアドレスは`auth.users`管理でSupabase側の暗号化に依存） |
| 10-2 | ブラウザの開発者ツール・サーバーログに個人情報が出力されていない | `console.log`等に個人情報が出力されない | ✅ 2026-08-18（本セッションのコンソールログ確認範囲では未検出） |
| 10-3 | 参加者CSVエクスポートに含まれる項目 | 必要最小限（氏名・連絡先程度）で、他人の個人情報が混入していない | ✅ 2026-08-26（4-4/9-9の確認時にCSVを取得し、予約ID・氏名・メールアドレス・予約日時・決済方法・決済ステータス・使用ポイント・請求金額のみで、性別・生年月日など他の個人情報や他人の行が含まれていないことを確認） |
| 10-4 | URLパラメータ・クエリストリングに個人情報が含まれていない | ネットワークタブで確認 | ✅ 2026-08-26（本セッションで操作したログイン・サインアップ・home・events・bookings・impact・admin各画面・CSVエクスポートのネットワークログを確認し、氏名・メール・生年月日等を含むクエリストリングは見られなかった。紹介リンクは`?ref=紹介コード`のみで個人情報ではない） |
| 10-5 | 他ユーザーの `bookings`・`journals`・`profiles` に自分のアカウントでアクセスできない（RLS） | 403 または空レスポンス | ✅ 2026-08-26（非管理者テストアカウントから、管理者の実在する予約IDに対し`POST /api/bookings/[id]/cancel`を実行→RLSのSELECTで他人の行が返らず404「予約が見つかりません」。`journals`・`profiles`関連のAPIはいずれもセッションの`user.id`のみで参照しており、他人のIDを指定して取得する経路がコード上存在しないことも確認） |

---

## 更新履歴

| 日付 | 内容 |
|------|------|
| 2026-08-18 | 初版作成。決済(Square/PayPay)・管理者機能を除く範囲を手動確認し反映。イベント一覧の過去イベント非表示化の修正を反映 |
| 2026-08-18 | 決済・管理者機能以外の未確認項目を追加確認。BUG-1（紹介ポイント未付与）・BUG-2（ジャーナル重複時500）・DOC-1（cronのPOST/GET不一致）を発見し記録 |
| 2026-08-18 | BUG-1を修正（`NAME_ROMAN_REGEX`をUnicode全般許容に変更、`LoginForm.tsx`にレスポンスチェック＋リトライ＋失敗時警告表示を追加）。`npm run test`（93件）全通過を確認のうえ、長音入り氏名での紹介フローを再テストし正常動作を確認。BUG-2・DOC-1は未修正のまま |
| 2026-08-22 | BUG-3（パスワード再設定リンクが機能しない）を発見・修正。Vercelの`NEXT_PUBLIC_SITE_URL`設定・Supabase DashboardのRedirect URLs登録・末尾スラッシュ除去・`reset-password/page.tsx`のリンク無効判定を対応し、本番環境で1-8を含む一連の動作を確認 |
| 2026-08-23 | BUG-4（iPhone 15実機でSIGN UPのDATE OF BIRTH欄がカード枠からはみ出す）をユーザー報告により発見。`LoginForm.tsx`の日付入力欄を`overflow-hidden`ラッパーで囲む修正を実施。ローカルのモバイルエミュレーションでは解消を確認したが、実機での最終確認は未実施 |
| 2026-08-23 | 2-5（ホーム画面ロード時の未付与ポイント付与）を確認。price=0・過去日時のテストイベントを管理画面で作成し予約→`/home`ロードでイベント参加ポイント（30pt）が付与されることをDBで確認。月間ボーナス・紹介報酬分は未確認のまま |
| 2026-08-23 | 9-3・9-7（管理者イベント一覧・削除）を確認。ユーザー報告を受け、削除済み(cancelled)イベントが管理者一覧に残り続ける挙動を仕様変更し、一覧から除外するよう`src/app/admin/events/page.tsx`を修正。`docs/requirements.md`・`docs/architecture.md`を合わせて更新 |
| 2026-08-23 | 3-5を確認（meeting_place・remarks・belongingsの表示OK）。3-6の確認中にBUG-5（重大）＝定員超過の予約が作成できてしまう不具合を発見。`api/payments/square・paypay/route.ts`・`events/[id]/page.tsx`・`events/[id]/checkout/page.tsx`の残席カウントをservice_role経由に修正し、`npm run test`93件全通過を確認。修正後、未予約の別アカウントから満席イベントを開き「残り枠：満席」＋予約ボタンdisabled表示になることを確認し3-6を✅に更新 |
| 2026-08-26 | 5-5（無料イベントのキャンセル）を確認。価格0円のテストイベントを作成し予約→キャンセルが正常に行えることを確認。確認中にBUG-6（`BookingButton.tsx`の`handleFreeBooking`/`handleCancel`が成功時に`loading`/`cancelLoading`をリセットせず、同一ページ内で予約⇔キャンセルを繰り返すとボタンが「予約中...」「キャンセル中...」表示のまま固まる）を発見し修正。`userBooking`propの変化をトリガーに両フラグをリセットする`useEffect`に変更し、2周連続の予約⇔キャンセルで固まらないことを確認。5-6は`checkAndAwardPendingPoints`のポイント付与条件と`cancel/route.ts`のキャンセル可否判定が同一の`start_at+2時間<=now`を使っているため正規フローでは再現できない可能性が高いと判明し、対応方針の判断待ちとして保留 |
| 2026-08-26 | 4-3・4-4・4-7・6-2・8-2（部分）・8-3・9-2・9-4・9-5・9-6・9-8・9-9・9-10・10-3・10-4・10-5を確認。テスト用イベント・予約を作成/APIを直接叩いて検証し、確認後は都度後片付け（論理削除）した。9-10・10-5の確認のため、自分のメールの+エイリアスで非管理者のテストアカウントを新規作成。6-2の検証で管理者アカウント（`tsubasabbc5@gmail.com`）のランクがSeed→Sproutへ実際に変化し、ランクダウン機構がないためアプリ側では元に戻せない状態になったが、ユーザー了承の上でそのままとした。8-2は月初(1日)以外は日付ゲートを実地検証できないため🟡のまま。4-8・5-6・9-10（非管理者403の一部確認は完了、RLSの厳密な401/403切り分けの深掘りは未実施）は引き続き保留・未確認。`npm run test`（93件）全通過を確認 |
| 2026-08-26 | 4-8を確認。定員1のテストイベントに2ユーザーから完全同時にINSERTするNode検証スクリプトで、BUG-5修正後も残っていたTOCTOU競合（確定予約2件＝定員超過）をBUG-7として再現。`supabase/migrations/023_booking_capacity_trigger.sql`（events行をFOR UPDATEでロックしてから残席を数えるDBトリガー）を追加し、Supabase StudioのSQL Editorで本番に適用。適用後、同じ検証を3回連続実行しいずれも定員超過が防がれることを確認、通常の単独予約が誤ってブロックされないことも確認。`npm run test`93件全通過。これでtestplan.mdの全項目についてひとまず一巡（保留中の5-6を除く）完了 |
| 2026-08-26 | 本セッションで追加したニックネーム機能・ピラティス種別の追加検証を実施。ニックネームは21文字・絵文字・記号のみの入力がクライアント側（`LoginForm.tsx`）・サーバー側（`api/signup/profile/route.ts`）双方で400/エラー表示により拒否され、20文字ちょうどは双方で成功することを確認。ニックネーム未設定（空文字）の既存アカウントでホーム画面が`name_roman`に正しくフォールバックすることも確認。ピラティスは、月間バッジボーナスの300pt/500ptティア判定が`user_badges`の件数を種別を問わずカウントする実装（`awardBadgeCountPoints`）のため、Pilates Firstを含む場合も正しくティアが切り替わることをDBで確認（4個→300pt、5個目にBoxing Firstを追加取得→500pt）。ピラティスイベントのCSVエクスポートも正常に生成されることを確認（CSVは元々event_typeを含まない設計のため影響なし）。既存4種別との月間集計併用は、クラス参加バッジ（3/5 Classes）が種別非依存の実装であることをコード・実地の両方で確認済み。コード変更なし |
| 2026-08-27 | 既知の不具合3件（BUG-2・BUG-4・DOC-1）をまとめてクローズ。BUG-2はローカルで同日2回目のジャーナル記録（直列・同一内容・並行送信）を複数パターン試したが500エラーは再現せず、`upsert`＋`onConflict`の実装通り正しく更新されることを確認しクローズ。DOC-1は`docs/funcdocument.md`のCron API表記をPOST→GETに修正。BUG-4はユーザーの実機確認で前回の`overflow-hidden`対応後も「若干見切れている」ことが判明したため、`input[type="date"]`自体を年・月・日の3つの`<select>`プルダウンに置き換える方式に変更（ブラウザ・OS依存のレンダリング差異が原理的に発生しなくなる）。うるう年を含む日数の動的絞り込み・不正な日の自動リセットをローカルで確認し、実際にサインアップも完了。`npm run test`93件・lintとも通過 |
| 2026-08-27 | ユーザー依頼「テストしていない・考慮できていない項目の洗い出し」に対応する過程で、ローカル開発機（JST）と本番Vercel（UTC）で同一イベントの表示時刻が9時間ズレる問題（BUG-8・重大）を発見。サブエージェントによる全コード監査で、`getHours()`等のローカルタイムゾーン依存メソッドを使っている業務ロジック7箇所（月間バッジ・月間ボーナス集計期間、ジャーナルの「今日」判定等）・表示13箇所を特定。`src/lib/date.ts`にJST基準の共通ヘルパーを新設し全箇所を置き換え、`date.test.ts`で13件のユニットテスト（うるう年・年またぎ・往復変換）を追加。`TZ=UTC`／`TZ=Asia/Tokyo`双方で計算結果が一致することを直接検証し、修正前後で挙動の差（10時→19時に是正）を確認。管理画面のイベント編集フォーム（datetime-local⇔UTC変換）も往復で時刻がズレないことをDBで確認。`npm run build`の型チェック含め全通過（テスト106件・lint）。あわせて依存パッケージの脆弱性（`npm audit`で高4・中3件）、特定商取引法/プライバシーポリシーページの不在、レート制限・CSP等セキュリティヘッダー未設定、エラー監視の仕組みの不在、アカウント削除導線の不在、実機ブラウザ検証の手薄さなど、testplan.mdの範囲外の本番運用上の懸念点をあわせて洗い出しユーザーに報告（対応は今後の判断） |
| 2026-08-30 | 未実施・保留だった 5-6・3-3 を確認しクローズ。**5-6**：コード解析で、`event_participation` ポイント付与（`checkAndAwardPendingPoints`、条件 `start_at+2h<=now`）と `revokeEventPoints` 呼び出し元の cancel ルート（`start_at+2h<=now` でキャンセル拒否）が完全排他のため、正規フローでは `revokeEventPoints` は常に空振りすると確定。唯一の到達経路は「参加ポイント付与後に管理者がイベントを未来日時へ延期」で、その場合は正しく30ptを取り消す（`decrement_points` は `greatest(0,...)` で0未満保護）。両分岐は `points.test.ts` の単体テストでカバー済みのため追加テストは不要と判断。**3-3**：本番DBに service_role で draft/cancelled/published のテストイベントを作成し、anonキー（非管理者ロール、events SELECT のRLSは `authenticated`/`anon` で挙動同一）で id指定取得・一覧取得ともに published のみ見えること、service_role では全件見えることを検証。`events/[id]/page.tsx` は status で絞らず RLS 依存だが draft/cancelled は0行→`notFound()` になる。テストイベントは検証後ハード削除。`npm run test` 114件全通過。残る未実施は 4-5・4-6（Square/PayPay 実決済、実課金の副作用があるため意図的に未実施。ロジックは `square/route.test.ts`・`paypay/route.test.ts` で網羅）のみ |
| 2026-09-01 | 仕様変更：紹介報酬 200pt の付与タイミングを「被紹介者のサインアップ完了時に即時」→「被紹介者が初回イベントにチェックインし、そのイベント終了後、ホーム画面ロード時」に変更。`/api/signup/profile` は `referrals` を `pending` で作成するのみに変更（即時付与・`checkReferralBadges` 呼び出しを削除）。新規 `src/lib/referrals.ts` の `checkAndAwardReferralReward`（service_role、被紹介者ホームロード時に `checkAndAwardPendingPoints` の直後に実行）で、被紹介者に「confirmed かつ checked_in_at セット済み かつ 終了済み」の予約があれば紹介者・被紹介者双方に 200pt（`referral_reward`/`referral_joined`、冪等）・`referrals` を `rewarded` 化・`checkReferralBadges` を実行。新規 `referrals.test.ts`（5ケース）。本番の `referrals` は既存1件が既に `rewarded`・`pending` は0件のため遡及処理・マイグレーション不要。Impact 画面の文言を実装に合わせて微修正（「初回イベントに参加」「報酬確定」）。1-2・6-4・6-7 は次回この新フローで再確認予定。`npm run test` 142件・lint・build 通過。
| 2026-09-01 | 新機能：イベントのチェックイン。予約済み画面（`/bookings`）の各カードに「チェックイン」ボタンを追加し、イベント開始時刻〜終了時刻（`end_at`、未設定時は開始+2時間）の間だけ活性（開始前・終了後は非活性）。`POST /api/bookings/[id]/checkin`（本人確認＋サーバー側時間ゲート＋service_role で `bookings.checked_in_at` を条件付き更新、冪等）。**チェックインを「参加」の唯一の条件に変更**：`checkAndAwardPendingPoints`（参加ポイント・月間ボーナス）・`checkEventBadges`（クラス初参加・回数バッジ）・`checkRankUp`（累計参加回数）・ホーム/Impact の「累計参加数」をすべて `checked_in_at IS NOT NULL` で絞る。`checkRankUp`/`checkEventBadges` の呼び出しを決済API（square/paypay/paypay callback）から削除し、チェックインAPI と月末 cron から呼ぶよう変更。マイグレーション `027_booking_checkin.sql`（`checked_in_at` カラム追加＋**既に終了したイベントの確定予約に `start_at` をバックフィル**＝過去分は参加済み扱い）。管理者の参加者一覧・CSV にチェックイン列（済/未・時刻）を追加。新規テスト `checkin/route.test.ts`（9ケース）、`points`/`ranks`/`badges` テストを checked_in ベースに更新。`npm run test` 137件・lint・build 通過。**本番適用時は `027_booking_checkin.sql` を Supabase Studio で実行すること。**
| 2026-09-01 | BUG-9（別端末でパスワード再設定リンクが機能しない）をユーザー報告で発見・修正。token_hash 方式（`/auth/confirm` route handler ＋ `verifyOtp`）に切り替え、`reset-password` 画面のセッション待ちポーリング化・エラー詳細表示を追加。トップページ CTA ボタン拡大も別途反映済み。**本番で有効化するには Supabase Dashboard で以下が必要**：(1) Authentication > Email Templates > 「Reset Password」の本文リンクを `<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery">パスワードを再設定する</a>` に変更、(2) Authentication > URL Configuration の Site URL が `https://hibi-wellnessclub.jp`（末尾スラッシュなし）、Redirect URLs に `https://hibi-wellnessclub.jp/**` があること（BUG-3 で登録済みのはず）。テンプレート変更前は旧 `?code=` 方式のまま（同一ブラウザなら動作、別端末では従来どおり失敗）。 |
| 2026-08-31 | 新機能：イベントの「選択項目」（`event_options`）を追加。管理者がイベント作成/編集時に任意個数（最大10）のプルダウン選択項目を設定でき（項目名・選択肢・必須/任意・単一/複数選択）、ユーザーはイベント詳細画面で回答してから予約、回答は `bookings.option_selections` にスナップショット保存され参加者一覧・CSV（動的列）に表示される。金額・ポイント・返金には非関与。マイグレーション `026_event_options.sql`（新テーブル＋`bookings.option_selections` カラム）。`src/lib/eventValidation.ts` に `validateEventOptions`・`buildOptionSelections` を追加し `eventValidation.test.ts` で14ケース検証。決済API（square/paypay）でサーバー側再検証。定員（`price` の頭0スタート解消）に加え本機能を実装。`npm run test` 128件・lint・build 通過。**本番適用時は `026_event_options.sql` を Supabase Studio で実行すること。**
| 2026-08-28 | 2-5の残り（月間全イベント参加ボーナス500pt・紹介報酬200ptの未付与分付与）を確認。既存の公開イベントが1件もない過去月（2026年6月）にテストイベント2件を作成し、新規テストアカウントで全予約→`/home`ロードで`points_log`に`event_participation`30pt×2・`monthly_bonus`（`reference_id: "2026-06"`）500ptが記録され、`profiles.points`が560になることをDBで確認。再ロードしても重複付与されないことも確認。紹介報酬200ptについては`checkAndAwardPendingPoints`のコードに紹介関連ロジックが存在しないことが判明し、実装はサインアップ完了時の即時付与（1-2・6-7で確認済み）のみであることが確定。`docs/funcdocument.md`の付与タイミング記載（「イベント翌日以降、ホーム画面ロード時」）を実装に合わせて修正。あわせて、コミットされずリポジトリに残っていた自動テスト2件（`src/lib/points.test.ts`への`checkAndAwardPendingPoints`テスト追加、新規`src/app/api/cron/badges/route.test.ts`）を発見。後者は`vi.setSystemTime()`で日時を偽装し、8-2で保留していた「月初(1日)のみ実行」というJST日付ゲート（UTC/JSTの年またぎ境界を含む4パターン）を検証済みだったため、8-2も✅に更新。`npm run test`114件（106件+新規8件）・lintとも通過。これでtestplan.mdの全項目が一巡し、残るは4-5・4-6（実決済のため意図的に未実施）・5-6（保留）のみ |
