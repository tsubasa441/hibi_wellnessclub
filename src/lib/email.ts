import { Resend } from "resend";
import { getJstParts } from "@/lib/date";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";

type BookingConfirmationParams = {
  to: string;
  userName: string;
  eventTitle: string;
  eventType: string;
  description: string;
  startAt: string;
  location: string;
  belongings?: string;
  price: number;
  paymentMethod: "square" | "paypay" | "free";
  pointsUsed?: number;
};

function formatDateTime(iso: string): string {
  const DAYS = ["日", "月", "火", "水", "木", "金", "土"];
  const { year: y, month, day: dayNum, hours: h, minutes: mi, dayOfWeek } = getJstParts(new Date(iso));
  const mo = String(month).padStart(2, "0");
  const day = String(dayNum).padStart(2, "0");
  const min = String(mi).padStart(2, "0");
  return `${y}年${mo}月${day}日（${DAYS[dayOfWeek]}） ${h % 12 || 12}:${min} ${h < 12 ? "AM" : "PM"}`;
}

type CancellationNotificationParams = {
  to: string;
  userName: string;
  eventTitle: string;
  startAt: string;
  price: number;
  paymentMethod: "square" | "paypay" | "free";
  refunded: boolean;
  pointsUsed?: number;
};

function paymentLabel(method: "square" | "paypay" | "free"): string {
  if (method === "square") return "クレジットカード（Square）";
  if (method === "paypay") return "PayPay";
  return "無料";
}

export async function sendCancellationNotification(params: CancellationNotificationParams) {
  const { to, userName, eventTitle, startAt, price, paymentMethod, refunded, pointsUsed } = params;
  const dateStr = formatDateTime(startAt);
  const priceStr = price === 0 ? "無料" : `¥${price.toLocaleString("ja-JP")}`;
  const pointsText = pointsUsed && pointsUsed > 0
    ? `（ご利用いただいた${pointsUsed.toLocaleString("ja-JP")}ptも残高に払い戻されます）`
    : "";
  const refundText = !refunded
    ? paymentMethod === "free"
      ? "このイベントは無料のため、返金はありません。"
      : "キャンセルポリシーの適用対象外（イベント2日前を過ぎてのキャンセル）のため、返金はありません。"
    : `お支払い金額（${priceStr}）は自動的に返金処理されます${pointsText}。反映までに数日かかる場合があります。`;

  await resend.emails.send({
    from: FROM,
    to,
    subject: `【Hibi】予約キャンセル：${eventTitle}`,
    html: `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background-color:#FBFBFB;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#FBFBFB;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #DCDFDD;">

          <!-- ヘッダー -->
          <tr>
            <td style="background-color:#1C221F;padding:32px 40px;text-align:center;">
              <p style="margin:0;font-size:24px;font-weight:600;color:#ffffff;letter-spacing:4px;">Hibi</p>
              <p style="margin:6px 0 0;font-size:12px;color:#919694;letter-spacing:2px;">Wellness Club</p>
            </td>
          </tr>

          <!-- 本文 -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <p style="margin:0 0 8px;font-size:14px;color:#2C3531;">${userName} さん</p>
              <p style="margin:0 0 24px;font-size:22px;font-weight:600;color:#1C221F;line-height:1.4;">
                予約をキャンセルしました
              </p>
              <p style="margin:0 0 24px;font-size:14px;color:#2C3531;line-height:1.7;">
                以下のイベントの予約がキャンセルされました。
              </p>

              <!-- イベント情報 -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F2F3F3;border-radius:12px;margin-bottom:24px;">
                <tr>
                  <td style="padding:24px 28px;">
                    <p style="margin:0 0 16px;font-size:18px;font-weight:600;color:#1C221F;">${eventTitle}</p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:6px 0;font-size:13px;color:#919694;width:80px;">日時</td>
                        <td style="padding:6px 0;font-size:13px;color:#1C221F;font-weight:500;">${dateStr}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;font-size:13px;color:#919694;">金額</td>
                        <td style="padding:6px 0;font-size:13px;color:#1C221F;font-weight:500;">${priceStr}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- 返金案内 -->
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #DCDFDD;border-radius:8px;margin-bottom:32px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#2C3531;">返金について</p>
                    <p style="margin:0;font-size:12px;color:#919694;line-height:1.6;">${refundText}</p>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:13px;color:#919694;line-height:1.7;">
                またのご参加をお待ちしております。<br/>
                引き続き Hibi をよろしくお願いいたします。
              </p>
            </td>
          </tr>

          <!-- フッター -->
          <tr>
            <td style="background-color:#F2F3F3;padding:20px 40px;text-align:center;">
              <p style="margin:0;font-size:11px;color:#919694;">Hibi Wellness Club</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim(),
  });
}

function eventTypeLabel(type: string): string {
  const map: Record<string, string> = {
    yoga: "ヨガ",
    training: "トレーニング",
    running: "ランニング",
    boxing: "ボクシング",
    pilates: "ピラティス",
  };
  return map[type] ?? type;
}

export async function sendBookingConfirmation(params: BookingConfirmationParams) {
  const { to, userName, eventTitle, eventType, description, startAt, location, belongings, price, paymentMethod, pointsUsed } = params;
  const dateStr = formatDateTime(startAt);
  const priceStr = price === 0 ? "無料" : `¥${price.toLocaleString("ja-JP")}`;
  const pointsRow = pointsUsed && pointsUsed > 0
    ? `<tr><td style="padding:6px 0;font-size:13px;color:#919694;">ポイント利用</td><td style="padding:6px 0;font-size:13px;color:#1C221F;font-weight:500;">-${pointsUsed.toLocaleString("ja-JP")}pt</td></tr>`
    : "";
  const belongingsBlock = belongings
    ? `<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #DCDFDD;border-radius:8px;margin-bottom:24px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#2C3531;">持ち物</p>
                    <p style="margin:0;font-size:12px;color:#919694;line-height:1.6;">${belongings}</p>
                  </td>
                </tr>
              </table>`
    : "";

  await resend.emails.send({
    from: FROM,
    to,
    subject: `【Hibi】予約確定：${eventTitle}`,
    html: `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background-color:#FBFBFB;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#FBFBFB;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #DCDFDD;">

          <!-- ヘッダー -->
          <tr>
            <td style="background-color:#1C221F;padding:32px 40px;text-align:center;">
              <p style="margin:0;font-size:24px;font-weight:600;color:#ffffff;letter-spacing:4px;">Hibi</p>
              <p style="margin:6px 0 0;font-size:12px;color:#919694;letter-spacing:2px;">Wellness Club</p>
            </td>
          </tr>

          <!-- 本文 -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <p style="margin:0 0 8px;font-size:14px;color:#2C3531;">${userName} さん</p>
              <p style="margin:0 0 24px;font-size:22px;font-weight:600;color:#1C221F;line-height:1.4;">
                予約が確定しました
              </p>
              <p style="margin:0 0 24px;font-size:14px;color:#2C3531;line-height:1.7;">
                以下のイベントへのご予約を承りました。当日お待ちしております。
              </p>

              <!-- イベント情報 -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F2F3F3;border-radius:12px;margin-bottom:24px;">
                <tr>
                  <td style="padding:24px 28px;">
                    <p style="margin:0 0 4px;font-size:18px;font-weight:600;color:#1C221F;">${eventTitle}</p>
                    <p style="margin:0 0 16px;font-size:12px;color:#919694;">${eventTypeLabel(eventType)}</p>
                    ${description ? `<p style="margin:0 0 16px;font-size:13px;color:#2C3531;line-height:1.7;">${description}</p>` : ""}
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:6px 0;font-size:13px;color:#919694;width:80px;">日時</td>
                        <td style="padding:6px 0;font-size:13px;color:#1C221F;font-weight:500;">${dateStr}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;font-size:13px;color:#919694;">場所</td>
                        <td style="padding:6px 0;font-size:13px;color:#1C221F;font-weight:500;">${location}</td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;font-size:13px;color:#919694;">金額</td>
                        <td style="padding:6px 0;font-size:13px;color:#1C221F;font-weight:500;">${priceStr}</td>
                      </tr>
                      ${pointsRow}
                      <tr>
                        <td style="padding:6px 0;font-size:13px;color:#919694;">お支払い</td>
                        <td style="padding:6px 0;font-size:13px;color:#1C221F;font-weight:500;">${paymentLabel(paymentMethod)}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              ${belongingsBlock}

              <!-- キャンセルポリシー -->
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #DCDFDD;border-radius:8px;margin-bottom:32px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#2C3531;">キャンセルポリシー</p>
                    <p style="margin:0;font-size:12px;color:#919694;line-height:1.6;">
                      ・イベント当日までキャンセル可能です<br/>
                      ・2日前まで：全額返金<br/>
                      ・前日・当日：返金対象外（キャンセル料100%）<br/>
                      ・悪天候等による中止：時期を問わず全額返金
                    </p>
                  </td>
                </tr>
              </table>

              <p style="margin:0;font-size:13px;color:#919694;line-height:1.7;">
                ご不明な点はアプリよりお問い合わせください。<br/>
                引き続き Hibi をよろしくお願いいたします。
              </p>
            </td>
          </tr>

          <!-- フッター -->
          <tr>
            <td style="background-color:#F2F3F3;padding:20px 40px;text-align:center;">
              <p style="margin:0;font-size:11px;color:#919694;">Hibi Wellness Club</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim(),
  });
}
