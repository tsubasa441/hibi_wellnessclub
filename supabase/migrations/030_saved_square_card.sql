-- クレジットカード保存機能（Square Card on File）用。
-- 生の PAN・CVV は一切保存しない（Square のトークン化を経由するため Hibi のサーバーには届かない）。
-- 保存するのは Square 側の識別子と、表示用の非機微情報（ブランド・下4桁・有効期限）のみ。
alter table public.profiles
  add column square_customer_id text,
  add column square_card_id text,
  add column card_brand text,
  add column card_last4 text,
  add column card_exp_month integer,
  add column card_exp_year integer;
