-- profiles を本人（authenticated / anon）から直接更新できないようにする（2026-10-28、リリース前の権限の確認で発見）。
--
-- 問題: "Users can update own profile" は行単位の制御のみで、is_admin・points 以外の列は本人がブラウザから書き換えられた。
--   - square_customer_id・square_card_id: 他人の ID に書き換えると、保存済みカードでの支払い・カードの無効化が
--     他人のカードに対して行われうる（アプリ側でも Square に持ち主を確かめるよう修正済み）
--   - rank_level: ランクを上げると、参加ポイント（ランク別 30〜100pt）が増える
--   - referral_code・referred_by 等
-- 本人による更新（ニックネーム変更・新規登録のプロフィール保存・ランクアップのお知らせの既読化・カードの保存）は、
-- すべて本人確認済みの API Route から service_role で行う。

drop policy if exists "Users can update own profile" on public.profiles;

-- 新規登録時に auth.users のメタデータへ平文で入っていた氏名を消す（以後の登録では送らない）
update auth.users set raw_user_meta_data = raw_user_meta_data - 'name' where raw_user_meta_data ? 'name';
