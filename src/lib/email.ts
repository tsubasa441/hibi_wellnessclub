import { Resend } from "resend";
import { getJstParts } from "@/lib/date";
import * as Sentry from "@sentry/nextjs";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

// お問い合わせの通知先（運営）。特商法・プライバシーポリシーに掲載している連絡先と同じ
const SUPPORT_ADMIN_EMAIL = process.env.SUPPORT_ADMIN_EMAIL ?? "hibi.wellnessclub@gmail.com";

// メール送信の失敗で予約・決済・キャンセルの結果を変えないよう、例外は投げずに Sentry へ記録する
// （Resend は API エラーを例外ではなく戻り値の error で返す。宛先は個人情報のため記録しない）
async function sendEmail(kind: string, payload: Parameters<typeof resend.emails.send>[0]): Promise<void> {
  try {
    const { error } = await resend.emails.send(payload);
    if (error) {
      Sentry.captureMessage("Email send failed", {
        level: "error",
        tags: { area: "email", kind },
        extra: { errorName: error.name, errorMessage: error.message, from: FROM },
      });
    }
  } catch (err) {
    Sentry.captureException(err, { tags: { area: "email", kind } });
  }
}

// ユーザーやイベントの文字列をメールの HTML に入れるときは、タグとして解釈されないように変換する
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDateTime(iso: string): string {
  const DAYS = ["日", "月", "火", "水", "木", "金", "土"];
  const { year: y, month, day: dayNum, hours: h, minutes: mi, dayOfWeek } = getJstParts(new Date(iso));
  const mo = String(month).padStart(2, "0");
  const day = String(dayNum).padStart(2, "0");
  const min = String(mi).padStart(2, "0");
  return `${y}年${mo}月${day}日（${DAYS[dayOfWeek]}） ${h}:${min}`;
}

// ---- メールのデザイン（2026-10-27、依頼者の指定でアプリと同じテイストに作り直し） ----
// アプリの色：背景はトップ・認証画面と同じクリーム（nav-bg #FAFAEC）、カードは白・角丸なし、
// 文字は ink（#1C221F / #2C3531 / #919694）、ボタンはインク色の角丸 6px、最下部はアプリのフッターと同じ濃い帯。
// メールソフトは外部の CSS・Web フォントを読めないため、すべてインラインの style と端末の日本語フォントで組む
const C = {
  page: "#FAFAEC",
  card: "#FFFFFF",
  box: "#F4F6F5",
  border: "#DCDFDD",
  heading: "#1C221F",
  text: "#2C3531",
  muted: "#919694",
  button: "#2C3531",
  footer: "#1C221F",
};
const FONT = "'Hiragino Sans','Hiragino Kaku Gothic ProN','Noto Sans JP','Yu Gothic',Meiryo,sans-serif";

function emailLayout(content: string): string {
  return `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background-color:${C.page};font-family:${FONT};-webkit-text-size-adjust:100%;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:${C.page};">
    <tr>
      <td align="center" style="padding:32px 12px 0;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
          <tr>
            <td align="center" style="padding:0 0 20px;">
              <img src="${SITE_URL}/images/hibi-logo.png" alt="Hibi" height="28" style="display:block;height:28px;width:auto;border:0;" />
              <p style="margin:6px 0 0;font-size:11px;color:#5A615E;letter-spacing:0.1em;">wellness club</p>
            </td>
          </tr>
          <tr>
            <td style="background-color:${C.card};padding:32px 28px;">
              ${content}
            </td>
          </tr>
          <tr>
            <td style="background-color:${C.footer};padding:24px 28px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td valign="middle">
                    <img src="${SITE_URL}/images/hibi-logo-white.png" alt="Hibi" height="20" style="display:block;height:20px;width:auto;border:0;" />
                  </td>
                  <td valign="middle" align="right" style="font-size:11px;line-height:1.9;">
                    <a href="${SITE_URL}/faq" style="color:#E5E7E6;text-decoration:none;">よくあるご質問</a><br />
                    <a href="${SITE_URL}/legal/terms" style="color:#E5E7E6;text-decoration:none;">利用規約</a><br />
                    <a href="${SITE_URL}/legal/privacy" style="color:#E5E7E6;text-decoration:none;">プライバシーポリシー</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:16px 12px 32px;font-size:11px;color:${C.muted};line-height:1.7;">
              このメールは送信専用です。ご返信いただいてもお答えできません。<br />
              © 2026 Hibi Wellness Club
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

function greeting(userName: string): string {
  return `<p style="margin:0 0 6px;font-size:13px;color:${C.muted};">${escapeHtml(userName)} さん</p>`;
}

function title(text: string): string {
  return `<p style="margin:0 0 16px;font-size:20px;font-weight:700;color:${C.heading};line-height:1.5;">${text}</p>`;
}

function paragraph(html: string, marginBottom = 24): string {
  return `<p style="margin:0 0 ${marginBottom}px;font-size:14px;color:${C.text};line-height:1.8;">${html}</p>`;
}

// イベント名と、ラベル・値の行（日時・場所など）を薄いグレーの四角に並べる
function infoBox(params: { heading: string; sub?: string; rows: [string, string][]; extraHtml?: string }): string {
  const rows = params.rows
    .map(
      ([label, value]) => `
                      <tr>
                        <td valign="top" style="padding:6px 0;font-size:13px;color:${C.muted};width:84px;">${label}</td>
                        <td valign="top" style="padding:6px 0;font-size:13px;color:${C.heading};font-weight:600;line-height:1.6;">${value}</td>
                      </tr>`
    )
    .join("");
  return `
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:${C.box};margin-bottom:24px;">
                <tr>
                  <td style="padding:20px 20px 14px;">
                    <p style="margin:0 0 ${params.sub ? 2 : 12}px;font-size:17px;font-weight:700;color:${C.heading};line-height:1.5;">${escapeHtml(params.heading)}</p>
                    ${params.sub ? `<p style="margin:0 0 12px;font-size:12px;color:${C.muted};">${escapeHtml(params.sub)}</p>` : ""}
                    ${params.extraHtml ?? ""}
                    ${rows ? `<table width="100%" cellpadding="0" cellspacing="0">${rows}</table>` : ""}
                  </td>
                </tr>
              </table>`;
}

// 返金・キャンセルポリシー等の補足（細い枠線の四角）
function noteBox(heading: string, bodyHtml: string): string {
  return `
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${C.border};margin-bottom:24px;">
                <tr>
                  <td style="padding:14px 18px;">
                    <p style="margin:0 0 6px;font-size:12px;font-weight:700;color:${C.text};">${heading}</p>
                    <p style="margin:0;font-size:12px;color:${C.muted};line-height:1.8;">${bodyHtml}</p>
                  </td>
                </tr>
              </table>`;
}

function button(href: string, label: string): string {
  return `
              <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                <tr>
                  <td align="center" style="background-color:${C.button};border-radius:6px;">
                    <a href="${href}" style="display:block;padding:14px 20px;color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:700;">${label}</a>
                  </td>
                </tr>
              </table>`;
}

function smallNote(text: string): string {
  return `<p style="margin:0;font-size:12px;color:${C.muted};line-height:1.8;">${text}</p>`;
}

// ---- 予約確定・キャンセル ----

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

function priceLabel(price: number): string {
  return price === 0 ? "無料" : `¥${price.toLocaleString("ja-JP")}`;
}

export async function sendCancellationNotification(params: CancellationNotificationParams) {
  const { to, userName, eventTitle, startAt, price, paymentMethod, refunded, pointsUsed } = params;
  const pointsText = pointsUsed && pointsUsed > 0
    ? `（ご利用いただいた${pointsUsed.toLocaleString("ja-JP")}ptも残高に払い戻されます）`
    : "";
  // 充当したポイントは時期を問わず払い戻す（2026-10-28）。現金を返金しない場合も、ポイントの払い戻しは伝える
  const pointsOnlyText = pointsUsed && pointsUsed > 0
    ? `ご利用いただいた${pointsUsed.toLocaleString("ja-JP")}ptは、ポイント残高に払い戻されます。`
    : "";
  const refundText = !refunded
    ? (paymentMethod === "free"
        ? "このイベントは無料のため、返金はありません。"
        : "キャンセルポリシーの適用対象外（イベント2日前を過ぎてのキャンセル）のため、お支払い金額の返金はありません。") + pointsOnlyText
    : `お支払い金額（${priceLabel(price)}）は自動的に返金されます${pointsText}。反映までに数日かかる場合があります。`;

  await sendEmail("cancellation", {
    from: FROM,
    to,
    subject: `【Hibi】予約キャンセル：${eventTitle}`,
    html: emailLayout(`
              ${greeting(userName)}
              ${title("予約をキャンセルしました")}
              ${paragraph("以下のイベントの予約がキャンセルされました。")}
              ${infoBox({ heading: eventTitle, rows: [["日時", formatDateTime(startAt)], ["金額", priceLabel(price)]] })}
              ${noteBox("返金について", refundText)}
              ${button(`${SITE_URL}/events`, "ほかのイベントを探す")}
              ${smallNote("またのご参加をお待ちしております。")}`),
  });
}

export async function sendBookingConfirmation(params: BookingConfirmationParams) {
  const { to, userName, eventTitle, eventType, description, startAt, location, belongings, price, paymentMethod, pointsUsed } = params;
  const rows: [string, string][] = [
    ["日時", formatDateTime(startAt)],
    ["場所", escapeHtml(location)],
    ["金額", priceLabel(price)],
  ];
  if (pointsUsed && pointsUsed > 0) rows.push(["ポイント利用", `-${pointsUsed.toLocaleString("ja-JP")}pt`]);
  rows.push(["お支払い", paymentLabel(paymentMethod)]);

  await sendEmail("booking_confirmation", {
    from: FROM,
    to,
    subject: `【Hibi】予約確定：${eventTitle}`,
    html: emailLayout(`
              ${greeting(userName)}
              ${title("予約が確定しました")}
              ${paragraph("以下のイベントへのご予約を承りました。当日お待ちしております。")}
              ${infoBox({
                heading: eventTitle,
                sub: eventTypeLabel(eventType),
                extraHtml: description
                  ? `<p style="margin:0 0 12px;font-size:13px;color:${C.text};line-height:1.8;">${escapeHtml(description)}</p>`
                  : "",
                rows,
              })}
              ${belongings ? noteBox("持ち物", escapeHtml(belongings).replace(/\n/g, "<br />")) : ""}
              ${noteBox(
                "チェックイン",
                "当日、アプリの下のメニュー中央「チェックイン」から、イベントの開始30分前から開始15分後までの間にチェックインしてください。"
              )}
              ${noteBox(
                "キャンセルポリシー",
                "・イベント当日までキャンセル可能です<br />・2日前まで：全額返金<br />・前日・当日：返金対象外（キャンセル料100%）。使ったポイントは払い戻し<br />・悪天候等による中止：時期を問わず全額返金"
              )}
              ${button(`${SITE_URL}/bookings`, "予約を確認する")}
              ${smallNote("ご不明な点は、アプリのマイページ「お問い合わせ」からご連絡ください。")}`),
  });
}

// 運営がイベントを中止したことを予約者へ知らせる（代金は時期を問わず全額返金、ポイントも払い戻し）
export async function sendEventCancelledNotification(params: {
  to: string;
  userName: string;
  eventTitle: string;
  startAt: string;
  refundedAmount: number;
  pointsRefunded: number;
}) {
  const { to, userName, eventTitle, startAt, refundedAmount, pointsRefunded } = params;
  const refundLines: string[] = [];
  if (refundedAmount > 0) refundLines.push(`お支払い金額（${priceLabel(refundedAmount)}）は全額返金します。反映までに数日かかる場合があります。`);
  if (pointsRefunded > 0) refundLines.push(`ご利用いただいた${pointsRefunded.toLocaleString("ja-JP")}ptは、ポイント残高に払い戻しました。`);
  if (refundLines.length === 0) refundLines.push("お支払いはありませんでした。");

  await sendEmail("event_cancelled", {
    from: FROM,
    to,
    subject: `【Hibi】イベント中止のお知らせ：${eventTitle}`,
    html: emailLayout(`
              ${greeting(userName)}
              ${title("イベント中止のお知らせ")}
              ${paragraph("誠に申し訳ございません。ご予約いただいていた以下のイベントは、中止となりました。ご予約はキャンセルしております。")}
              ${infoBox({ heading: eventTitle, rows: [["日時", formatDateTime(startAt)]] })}
              ${noteBox("返金について", refundLines.join("<br />"))}
              ${button(`${SITE_URL}/events`, "ほかのイベントを探す")}
              ${smallNote("ご不明な点は、アプリのマイページ「お問い合わせ」からご連絡ください。")}`),
  });
}

// ---- お問い合わせ・キャンセル待ち ----

// ユーザーからのお問い合わせを運営へ通知する（本文と、管理画面の該当スレッドへのリンク）
export async function sendSupportInquiryToAdmin(params: { userId: string; userName: string; body: string }) {
  const { userId, userName, body } = params;

  await sendEmail("support_inquiry", {
    from: FROM,
    to: SUPPORT_ADMIN_EMAIL,
    subject: `【Hibi】お問い合わせ：${userName} さん`,
    html: emailLayout(`
              ${title("新しいお問い合わせがあります")}
              <p style="margin:0 0 8px;font-size:13px;color:${C.muted};">${escapeHtml(userName)} さん</p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:${C.box};margin-bottom:24px;">
                <tr>
                  <td style="padding:18px 20px;font-size:14px;color:${C.heading};line-height:1.8;white-space:pre-wrap;">${escapeHtml(body)}</td>
                </tr>
              </table>
              ${button(`${SITE_URL}/admin/support/${userId}`, "管理画面で返信する")}
              ${smallNote("このメールに返信しても、ユーザーには届きません。返信は管理画面から行ってください。")}`),
  });
}

// キャンセル待ちしていたイベントに空きが出たことを知らせる（先着順のため、予約ページへのリンクを置く）
export async function sendWaitlistSeatAvailable(params: {
  to: string;
  userName: string;
  eventId: string;
  eventTitle: string;
  startAt: string;
}) {
  const { to, userName, eventId, eventTitle, startAt } = params;

  await sendEmail("waitlist_available", {
    from: FROM,
    to,
    subject: `【Hibi】キャンセル待ちのイベントに空きが出ました：${eventTitle}`,
    html: emailLayout(`
              ${greeting(userName)}
              ${title("キャンセル待ちのイベントに空きが出ました")}
              ${infoBox({ heading: eventTitle, rows: [["日時", formatDateTime(startAt)]] })}
              ${paragraph("キャンセル待ちに登録していた皆さまに同時にお知らせしています。先にご予約いただいた方から確定しますので、お早めにどうぞ。")}
              ${button(`${SITE_URL}/events/${eventId}`, "予約ページを開く")}
              ${smallNote("このお知らせでキャンセル待ちは終了しました。再び満席になった場合は、イベントのページからもう一度キャンセル待ちに登録してください。")}`),
  });
}

// 運営が返信したことをユーザーへ知らせる（本文はメールに載せず、アプリで読んでもらう）
export async function sendSupportReplyToUser(params: { to: string; userName: string }) {
  const { to, userName } = params;

  await sendEmail("support_reply", {
    from: FROM,
    to,
    subject: "【Hibi】お問い合わせへの返信があります",
    html: emailLayout(`
              ${greeting(userName)}
              ${title("お問い合わせへの返信があります")}
              ${paragraph("Hibi 運営からメッセージが届きました。アプリでご確認ください。")}
              ${button(`${SITE_URL}/support`, "メッセージを見る")}
              ${smallNote("このメールへの返信はお受けできません。お問い合わせはアプリからお願いいたします。")}`),
  });
}
