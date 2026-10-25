-- 新規登録でフリガナ（セイ・メイ）を受け取る（2026-10-25）。
-- 氏名と同じく個人情報のため、アプリ側で暗号化した「セイ メイ」を保存する（src/lib/encrypt.ts）。
-- 既存ユーザーは未入力のまま（null）。RLS は profiles の既存ポリシー（本人と管理者のみ）がそのまま適用される
alter table public.profiles add column if not exists name_kana text;
