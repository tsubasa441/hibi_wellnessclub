-- gender / birth_date は暗号化して保存しているため、DB レベルでは平文の値（'male'/'female'/'other' など）を
-- 検証できない（gender の CHECK 制約は暗号化対応のため 015 で削除済み、以後未再追加）。
-- 代わりに、API バリデーション（src/app/api/signup/profile/route.ts）を経由しない書き込みが発生した場合の
-- 保険として、暗号化後の文字列長に上限を設ける。
-- 上限は encrypt() の出力形式（ivHex 24桁 + ":" + authTagHex 32桁 + ":" + ciphertextHex）と
-- 各フィールドの平文文字数上限（name: 50字, name_roman: 100字, gender: 6字, birth_date: 10字,
-- referral_code_used: 20字、日本語3バイト換算）から算出し、余裕を持たせた値。

alter table public.profiles
  add constraint profiles_name_length check (length(name) <= 500),
  add constraint profiles_name_roman_length check (length(name_roman) <= 800),
  add constraint profiles_gender_length check (gender is null or length(gender) <= 150),
  add constraint profiles_birth_date_length check (birth_date is null or length(birth_date) <= 150),
  add constraint profiles_referral_code_used_length check (referral_code_used is null or length(referral_code_used) <= 150);
