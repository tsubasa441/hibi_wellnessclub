import { getSquareClient } from "@/lib/squareClient";
import { createServiceClient } from "@/lib/supabase/service";

export type SavedCardInfo = {
  cardId: string;
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
};

// profiles のカード列（square_customer_id・square_card_id 等）は本人に書き換えさせない（036）。
// 書き込みは本人確認済みの API から service_role で行う
function cardColumns() {
  return createServiceClient().from("profiles");
}

// Customer は作成時に referenceId へ user_id を入れている。他人の Customer ID が profiles に入っていても
// 使わないよう、Square 側の referenceId で持ち主を確かめる
export async function isOwnCustomer(customerId: string, userId: string): Promise<boolean> {
  try {
    const { customer } = await getSquareClient().customers.get({ customerId });
    return customer?.referenceId === userId;
  } catch {
    return false;
  }
}

// カードがその Customer のもので、有効なときだけ true
export async function isOwnCard(cardId: string, customerId: string): Promise<boolean> {
  try {
    const { card } = await getSquareClient().cards.get({ cardId });
    return card?.customerId === customerId && card?.enabled !== false;
  } catch {
    return false;
  }
}

// 本人の Customer があれば返す。無ければ（または profiles の値が本人のものでなければ）Square の Customer を作成して保存する。
// Customer には氏名等の個人情報を渡さない（メールアドレスのみ、参照用の referenceId は自分の user_id）
export async function getOrCreateCustomerId(
  userId: string,
  existingCustomerId: string | null,
  email: string | null
): Promise<string> {
  if (existingCustomerId && (await isOwnCustomer(existingCustomerId, userId))) return existingCustomerId;

  const { customer } = await getSquareClient().customers.create({
    idempotencyKey: crypto.randomUUID(),
    referenceId: userId,
    emailAddress: email ?? undefined,
  });
  const customerId = customer?.id;
  if (!customerId) throw new Error("カードの保存に失敗しました");

  const { error } = await cardColumns().update({ square_customer_id: customerId }).eq("id", userId);
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

// 本人の Customer のカードのときだけ無効化する（他人のカードを止めさせない）。
// 失敗しても呼び出し元の処理は止めない（カード保存の後片付け・置き換え用の無効化のため）
export async function disableOwnCard(cardId: string, customerId: string | null): Promise<void> {
  if (!customerId || !(await isOwnCard(cardId, customerId))) return;
  try {
    await getSquareClient().cards.disable({ cardId });
  } catch {
    // 無効化に失敗しても致命的ではない（Square側にカードが残るだけ）ため握りつぶす
  }
}

export async function persistSavedCard(userId: string, info: SavedCardInfo | null): Promise<void> {
  const { error } = await cardColumns()
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
