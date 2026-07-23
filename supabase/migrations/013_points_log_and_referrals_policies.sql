-- points_log: ユーザーが自分のレコードを削除できるように（キャンセル時のポイント取り消し）
create policy "users can delete own points_log"
  on public.points_log for delete
  using (auth.uid() = user_id);

-- referrals: サーバーサイドからのUPDATEを許可（紹介報酬確定処理）
-- service_role は RLS をバイパスするため、このポリシーは anon/authenticated 向け
-- 紹介された本人（referee）がホーム画面ロード時にサーバー経由で更新する
create policy "referees can update own referral status"
  on public.referrals for update
  using (auth.uid() = referee_id)
  with check (auth.uid() = referee_id);
