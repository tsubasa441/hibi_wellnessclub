# Hibi フロントエンドデザインルール

---

## ブランドトーン

- おしゃれさと親しみやすさの両立
- 色は 3 色に絞る（ベース × インク × セージグリーン）
- 上品になりすぎない。温かみのある生活感を大切に

---

## カラーパレット

### CSS 変数定義（`globals.css` に記載）

```css
@theme {
  /* Primary: ベース（背景） */
  --color-base-50:  #FBFBFB;
  --color-base-100: #F4F6F5;  /* 基準色・ページ背景 */
  --color-base-200: #DCDFDD;
  --color-base-300: #BCC0BE;

  /* Secondary: インク（テキスト・ボタン） */
  --color-ink-50:  #F2F3F3;
  --color-ink-100: #DFE1E0;
  --color-ink-200: #BBBEBD;
  --color-ink-300: #919694;
  --color-ink-400: #5A615E;
  --color-ink-500: #2C3531;  /* 基準色・メインテキスト・ボタン */
  --color-ink-600: #242B28;
  --color-ink-700: #1C221F;  /* 見出し・強調 */
  --color-ink-800: #141816;

  /* Accent: セージグリーン */
  --color-sage-50:  #C9D4CC;
  --color-sage-100: #ABBDAF;
  --color-sage-200: #95AB9B;
  --color-sage-300: #87A08D;  /* 基準色・メインカラー（アクセント） */
  --color-sage-400: #79907F;
  --color-sage-500: #6A7E70;  /* プライマリボタン背景 */
  --color-sage-600: #2F6A51;  /* プライマリボタン hover・強調表示 */
}
```

### 使い分けルール

| 用途 | 変数 | 値 |
|------|------|----|
| ページ背景 | `--color-base-100` | #F4F6F5 |
| カード背景 | `white` | #FFFFFF |
| メインカラー（アクセント） | `--color-sage-300` | #87A08D |
| プライマリボタン背景 | `--color-sage-500` | #6A7E70 |
| プライマリボタンテキスト | `white` | #FFFFFF |
| 見出し・強調テキスト | `--color-ink-700` | #1C221F |
| 本文テキスト | `--color-ink-500` | #2C3531 |
| サブテキスト・補足 | `--color-ink-300` | #919694 |
| ボーダー | `--color-base-200` | #DCDFDD |

---

## フォント

### 使用フォント（Google Fonts）

| フォント | 用途 | ウェイト |
|---------|------|---------|
| **Outfit** | UI全般・ボタン・ラベル | 400, 500, 600 |
| **Cormorant Garamond** | タイトル・見出し（ブランド感） | 500, 600 |
| **DM Sans** | 本文・説明文 | 400, 500 |

### 使い分けルール

```
ページタイトル・ヒーロー見出し → Cormorant Garamond 600
セクション見出し（h2, h3）    → Outfit 600
ボタン・ラベル・ナビ         → Outfit 500
本文・説明文                 → DM Sans 400
数値・コード（紹介コードなど） → Outfit 500
```

### サイズスケール

| 用途 | サイズ |
|------|-------|
| ヒーロータイトル | 36px |
| ページ見出し | 24px |
| セクション見出し | 18px |
| 本文 | 14px |
| 補足・ラベル | 12px |

---

## アイコン

- **SVG アウトラインのみ** を使用
- 絵文字（emoji）は使用禁止
- stroke-width: 1.5px 統一
- サイズ: 20px（インライン）/ 24px（アクション）
- カラー: テキストカラーに合わせる（`currentColor` 使用）

---

## 角丸・余白の統一値

### 角丸（border-radius）

| 用途 | 値 |
|------|-----|
| ボタン（ピル型） | `9999px`（`rounded-full`） |
| カード・モーダル | `16px`（`rounded-2xl`） |
| インプット・タグ | `8px`（`rounded-lg`） |
| バッジ・チップ | `9999px`（`rounded-full`） |

### 余白（padding / gap）

| 用途 | 値 |
|------|-----|
| ページ横余白 | `16px`（スマホ）/ `24px`（タブレット以上） |
| カード内余白 | `20px` |
| セクション間余白 | `24px` |
| コンポーネント間 gap | `12px` |
| ボタン padding | `12px 32px` |

### シャドウ

```css
/* カード */
box-shadow: 0 1px 4px rgba(44, 53, 49, 0.08);

/* ホバー時 */
box-shadow: 0 4px 12px rgba(44, 53, 49, 0.12);
```

---

## コンポーネント例

### プライマリボタン

```tsx
<button className="bg-ink-500 text-white font-outfit font-medium
  px-8 py-3 rounded-full hover:bg-ink-600 transition">
  予約する
</button>
```

### セカンダリボタン

```tsx
<button className="border border-ink-500 text-ink-500 font-outfit font-medium
  px-8 py-3 rounded-full hover:bg-sage-100 transition">
  詳細を見る
</button>
```

### カード

```tsx
<div className="bg-white rounded-2xl p-5
  shadow-[0_1px_4px_rgba(44,53,49,0.08)]
  hover:shadow-[0_4px_12px_rgba(44,53,49,0.12)] transition">
  ...
</div>
```
