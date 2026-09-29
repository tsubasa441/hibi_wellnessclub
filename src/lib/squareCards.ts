import type { SupabaseClient } from "@supabase/supabase-js";
import { getSquareClient } from "@/lib/squareClient";

export type SavedCardInfo = {
  cardId: string;
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
};

// profiles.square_customer_id があれば返す。無ければ Square の Customer を作成して保存する。
// Customer には氏名等の個人情報を渡さない（メールアドレスのみ、参照用の referenceId は自分の user_id）
export async function getOrCreateCustomerId(
  supabase: SupabaseClient,
  userId: string,
  existingCustomerId: string | null,
  email: string | null
): Promise<string> {
  if (existingCustomerId) return existingCustomerId;

  const { customer } = await getSquareClient().customers.create({
    idempotencyKey: crypto.randomUUID(),
    referenceId: userId,
    emailAddress: email ?? undefined,
  });
  const customerId = customer?.id;
  if (!customerId) throw new Error("カードの保存に失敗しました");

  const { error } = await supabase.from("profiles").update({ square_customer_id: customerId }).eq("id", userId);
  if (error) throw new Error("カードの保存に失敗しました");

  return customerId;
}

// カードのノンス（sourceId）を Square に保存する（課金は行わない）。戻り値は表示用の非機微情報のみ
export async function saveCard(customerId: string, sourceId: string): Promise<SavedCardInfo> {
  const { card } = await getSquareClient().cards.create({
    idempotencyKey: crypto.randomUUID(),
    sourceId,
    card: { customerId },
  });
  if (!card?.id) throw new Error("カードの保存に失敗しました");

  return {
    cardId: card.id,
    brand: card.cardBrand ?? null,
    last4: card.last4 ?? null,
    expMonth: card.expMonth != null ? Number(card.expMonth) : null,
    expYear: card.expYear != null ? Number(card.expYear) : null,
  };
}

// 失敗しても呼び出し元の処理は止めない（カード保存の後片付け・置き換え用の無効化のため）
export async function disableCard(cardId: string): Promise<void> {
  try {
    await getSquareClient().cards.disable({ cardId });
  } catch {
    // 無効化に失敗しても致命的ではない（Square側にカードが残るだけ）ため握りつぶす
  }
}

export async function persistSavedCard(
  supabase: SupabaseClient,
  userId: string,
  info: SavedCardInfo | null
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({
      square_card_id: info?.cardId ?? null,
      card_brand: info?.brand ?? null,
      card_last4: info?.last4 ?? null,
      card_exp_month: info?.expMonth ?? null,
      card_exp_year: info?.expYear ?? null,
    })
    .eq("id", userId);
  if (error) throw new Error("カードの保存に失敗しました");
}
