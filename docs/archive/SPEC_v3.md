# Days Count in AUS — 開発仕様書 (SPEC v3)

> **正式名称**: Days Count in AUS
> **通称（アイコン下表示）**: Count
> **コンセプト**: 「Make Days Count」ー ワーホリの365日を、一生の資産（遊びと成長）に変える。
> **ターゲット**: ワーホリ渡航前・滞在中・帰国後の全フェーズのユーザー

---

## 1. 技術スタック

| カテゴリ | 技術 |
|---|---|
| Frontend | Next.js 16.1.6 (App Router) + TypeScript |
| スタイリング | Tailwind CSS v4 |
| アニメーション | Framer Motion |
| 認証 | Firebase Authentication（**Googleログインのみ**） |
| DB | Cloud Firestore |
| ストレージ | Firebase Storage |
| 分析 | Firebase Analytics |
| セキュリティ | Firebase App Check（reCAPTCHA Enterprise） |
| 画像処理 | react-easy-crop + Canvas API（EXIF自動除去 + 圧縮） |
| 通知 | FCM Web Push（トークン登録 + Cloud Functions v2 による通知発火） |
| エラー監視 | Sentry（無料枠） |
| デプロイ | Vercel |
| ドメイン | https://days-count.com（Vercel管理） |
| PWA | manifest.json + Service Worker（オフラインフォールバック + FCM） + OGP + iOS standalone（next-pwa未使用、手動設定） |
| ビルドツール | Turbopack（Next.js 16 デフォルト） |
| フォント | Geist / Geist Mono（Google Fonts） |

### 主要依存パッケージ

```json
{
  "firebase": "^12.10.0",
  "framer-motion": "^12.35.2",
  "next": "16.1.6",
  "react": "19.2.3",
  "react-easy-crop": "^5.5.6",
  "tailwindcss": "^4"
}
```

---

## 2. デバイス・表示仕様

- **レスポンシブ・シェル設計**: PC閲覧時は画面中央に **最大幅450px** でコンテンツ表示。シェル内側は白背景 + `shadow-lg`。
- **背景色**: Sand Beige `#F5F5DC`（シェル外側）。
- **最小高さ**: `min-h-dvh`（Dynamic Viewport Height）。
- **PWA要件**: manifest.json設定済み。`standalone` モード。テーマカラー `#1A3C2E`。`short_name: "days-count"`。
- **PWAアイコン**: 192×192px / 512×512px の PNG アイコン。
- **PWAインストールバナー**: 未インストールユーザーに毎回表示（z-[200]で最前面）。iOS向けはビジュアルステップガイド（Step 1: Share → Step 2: Add to Home Screen → Step 3: Add）をSVGアイコン+アニメーション矢印で案内。Android向けは `beforeinstallprompt` ネイティブプロンプト使用。
- **オフラインフォールバック**: Service Worker が `offline.html` をキャッシュ。ナビゲーション失敗時にブランドデザインの「You're Offline」ページ（Retryボタン付き）を表示。スクロール完全無効化。
- **OG画像**: `opengraph-image.tsx` で動的生成（1200×630px）。アプリアイコン + "days-count" テキスト + タグライン + Working Holiday / Journal / Community ピル。カンガルー透かし。
- **セキュリティヘッダー** (`next.config.ts`):
  - `Cross-Origin-Opener-Policy: same-origin-allow-popups`（Google OAuth popup 対応）
  - `X-Content-Type-Options: nosniff`（MIMEスニッフィング防止）
  - `X-Frame-Options: DENY`（クリックジャッキング防止）
  - `Referrer-Policy: strict-origin-when-cross-origin`（リファラー漏洩防止）
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`（不要なブラウザ機能の無効化）
- **HTMLサニタイゼーション**: Legal文書の `dangerouslySetInnerHTML` 表示時に DOMPurify でサニタイズ（XSS防止）。
- **URL検証**: バナー・お知らせのリンクURLは `isSafeUrl()` で `https?://` プロトコルのみ許可（`javascript:` スキーム等をブロック）。
- **SEOメタデータ**: 各ルート（home, explore, mypage, groups, settings, login, post）に `layout.tsx` でページ固有の `title` と `description` を設定。
- **エラーUI**: ルートの `error.tsx` でランタイムエラー時にブランドデザインのリトライ画面を表示。
- **アクセシビリティ**: モーダルに `role="dialog" aria-modal="true"`、アイコンボタンに `aria-label`、オーバーレイに `aria-hidden="true"`、トーストに `aria-live="polite"` を全コンポーネントに適用。

---

## 3. ユーザーフェーズとカウントロジック

すべて **ユーザー端末のローカル時間（0:00〜23:59）** 基準。

| フェーズ | 表記 | 起点 | 内容 |
|---|---|---|---|
| 渡航前 (Pre-departure) | `D - 数値` | 渡航予定日 | カウントダウン（出発日を過ぎたら自動的にD+カウント） |
| ワーホリ中 (In Australia) | `D + 数値` | 渡航日（当日は D+1） | 経過日数（D+365以降も継続） |
| 帰国後 (Post-return) | `D + 数値` | アカウント作成日（createdAt） | アプリ利用日数カウントアップ |

### フェーズ遷移ルール
- **手動切り替え**が基本。設定画面からいつでも変更可能（確認ダイアログ付き）。
- 帰国後に切り替えた場合、`returnStartDate` に当日日付を自動設定。
- D+365を超えてもカウント継続。帰国後フェーズへの切り替えはユーザー任意。

### 日付の保存形式
- `departureDate`, `returnStartDate` は **`YYYY-MM-DD`（文字列）** で保存。
- Timestamp（UTC変換）は使用しない。タイムゾーン跨ぎのバグを防止。
- カウント計算はローカル日付同士の差分で行う。

### カウント計算詳細（`getDayCount` 関数）
- **pre-departure**: `departureDate` との差分。正の場合 `D - N`、ゼロ以下は `D + N`（自動切替表示）。
- **in-australia**: `departureDate` からの経過日数 + 1。
- **post-return**: `createdAt`（アカウント作成日）からの経過日数 + 1。

---

## 4. 5つのフォーカスモード

| モード | ID | ラベル | アイコン | 用途 |
|---|---|---|---|---|
| WH Enjoy | `enjoying` | WH Enjoy | ☕ コーヒー | ワーホリの楽しみ・体験 |
| WH Challenge | `challenging` | WH Challenge | 🌏 地球 | ワーホリならではの挑戦 |
| English | `english` | English | 💬 吹き出し | 英語学習 |
| Skill | `skills` | Skill | 💻 パソコン | スキル習得 |
| SNS | `social-media` | SNS | 📷 カメラ | SNS活動 |

### マイページでのカテゴリ分類
- **Fun（遊び）タブ**: `enjoying` + `social-media` の投稿
- **Growth（成長）タブ**: `skills` + `challenging` + `english` の投稿

---

## 5. XP・レベル設計

**設計目標**: 365日毎日継続 → 帰国時高レベル到達。

### XP獲得ルール

| アクション | XP | 制限 |
|---|---|---|
| 週間投稿（段階制） | +5/7/10/15/25/35/50 | 週7回まで（火曜リセット、合計147XP） |
| 初投稿ウェルカムボーナス | +100 | 初回のみ |
| いいねをもらう（受信） | +10 | 無制限（自己いいねではXP付与なし） |
| いいねを送る（送信） | +5 | **XP付与は1日5回まで**（計25XP）。いいね自体は**無制限**に可能。自己いいねではXP付与なし |
| 連続週ボーナス | +5/投稿/週 | 週間チャレンジ（週5日以上投稿）連続達成で加算、最大10週（+50/投稿） |

### レベル計算式

```
Level = floor( sqrt( TotalXP / 1.5 ) ) + 1
```

- `xpForLevel(level) = round((level - 1)² × 1.5)`
- **設計目標**: ガチ勢（週6投稿+いいね活用）が10ヶ月で Lv.90 到達。普通の利用者は Lv.60〜70。
- UI: 名前の横に **`Lv.数値`** を常時表示。
- プログレスバー: 次のレベルまでの進捗（%）を表示。

### ストリークルール（連続投稿日数）
- 最終投稿日が **昨日** であればストリーク +1。
- 最終投稿日が **今日** であればストリーク維持（変更なし）。
- 最終投稿日が **それ以前** であればストリーク 1 にリセット。
- 判定は `lastPostAt`（ISO 8601文字列）の日付部分で比較。

### いいねのXPルール
- **他人の投稿にいいね**: 送信者 +5XP（1日5回まで）、受信者 +10XP。
- **自分の投稿にいいね**: いいねカウント増減のみ。XP付与なし。
- **いいね取り消し**: XPは戻さない（いいね/取り消しによるXPファーミング防止）。
- **XP上限超過時**: トースト通知「XP limit reached — like still counted!」。いいね自体はブロックしない。
- **いいねアニメーション**: タップ位置にハートバースト + 6個のパーティクル散布（CSS keyframes）。
- **いいねしたユーザー一覧**: いいね数タップで `posts/{postId}/likes` から最大50件取得しボトムシート表示。

---

## 6. 画面・機能詳細

### 6.1 認証・オンボーディング

**ルート**: `/login`（`(auth)` route group）, `/onboarding`（`(auth)` route group）

**ログイン**: Googleログインのみ（`signInWithPopup` → `signInWithRedirect` フォールバック）。ログイン画面に利用規約・プライバシーポリシーのリンク（LegalModals）を表示。

**ルートリダイレクトロジック** (`/`):
- 未認証 → `/login`
- 認証済み & プロフィール未作成 → `/onboarding`
- 認証済み & プロフィール作成済み → `/home`

**初回登録フロー**:
1. Googleログイン
2. オンボーディング画面（**1画面完結・スクロール不要のコンパクトUI**）:
   - **1行目**: プロフィール写真（丸型、任意）+ ニックネーム入力を横並び
   - **2行目**: ステータス選択（横並び3ボタン: Before / In AUS / Returned）
   - **3行目（条件付き）**:
     - Before: 渡航予定日のdate picker
     - In AUS: 渡航日（到着日）のdate picker
     - Returned: 本日を `departureDate` と `returnStartDate` に自動設定、入力不要
   - **4行目**: フォーカスモード5つ横並び
   - **ニックネーム**: 半角英数字のみ、15文字以内、**重複不可**（500msデバウンスチェック）
   - **プロフィール写真**: 丸型クロップUI（512×512px出力）
3. プロフィール作成後、選択したメインモードの公式グループに自動参加
4. 初回特典: 初投稿時に **ウェルカムボーナス 100XP**

**デフォルトアバター**: ニックネームの頭文字 + ユーザーIDからHSL色相ハッシュ生成した背景色の円。

---

### 6.2 HOME画面 (Dashboard)

**ルート**: `/home`

- **ヒーローヘッダー**: 画面上部にAussie Gold → amber-500 → orange-400グラデーション背景、白文字で `D + 124` 等を大型表示。フェーズラベル + 挨拶テキスト。
- **週間ゴールカード**: ヘッダーに重なるカード。ユーザー設定のゴール表示 + 編集ボタン（WeeklyHistoryModal を開く）+ WeeklyChallenge コンポーネント（週間投稿進捗バー7本、冠位十二階ランクカラー、weekStreak表示、5日ストリーク破線、週の期間 "Mar. 18 – Mar. 24" 表示）。7投稿達成時は「Complete!」バッジ + ゴールド演出。ストリーク継続条件は **週5日以上**（ユニーク日数）。
- **WeeklyHistoryModal**: 鉛筆ボタンから開く。ゴール編集 + 過去12週のモード別スタック棒グラフ（英語=青、スキル=紫、挑戦=緑、仕事=橙、チル=石）+ 現在/最高ストリーク表示。フッター上に表示。
- **XP/Lvバー**: コンパクトな1行表示（Lv + プログレスバー + 次Lvまでの残XP）。
- **バナーカルーセル**: BannerCarousel（`location="home"`）+ adminConfig のバナー画像。
- **お知らせ**: `admin_config/main.announcements` 配列から `active: true` のものを表示（info/warning/event 3タイプ、リンク付き対応）。
- **通知バナー**: 初回訪問時にプッシュ通知許可バナー表示（dismissで `localStorage` に記録）。
- **フェーズ自動遷移**: 渡航予定日超過 or D+365超過時に ConfirmModal で切り替え提案。
- **マイルストーン演出**: D+30, 100, 200, 365 到達時にフルスクリーンアニメーション。`localStorage` で表示済みフラグ管理（1回のみ表示）。

---

### 6.3 EXPLORE画面（タイムライン）

**ルート**: `/explore`

- **全ユーザーの公開（public）かつアクティブ（active）な投稿** をスコアベースランキングで表示。
- **フィードアルゴリズム** (`feedScore.ts`): クライアント側でスコア計算（Firestore追加読み取りなし）。
  - フォロー中: +50pt
  - 同じメインモード: +20pt
  - いいね数（0〜10pt、対数スケール）
  - 新しさ（0〜10pt、24時間以内が最大）
  - 新規ユーザー発見ボーナス: +5pt
  - 既読ペナルティ: -30pt
  - 検索モード時はスコアリングをスキップ（マッチ結果をそのまま表示）。
- **既読追跡**: `localStorage` に投稿IDを保存（最大500件、3日間TTL）。`markSeen()` で記録。
- **無限スクロール**: Firestoreの `limit(20)` + `startAfter(lastVisibleDoc)` で20件ずつ追加読み込み。スクロール位置がページ下端500pxに達したら次ページ取得。
- **フィルタ**: 上部に固定ヘッダーで2行レイアウト。Row1: All + WH系モード、Row2: その他モード。**WH系（enjoying/challenging）は amber系カラー、その他は blue系カラー**（選択/非選択とも色分け）。
- **検索**: ユーザー名・地域でのデバウンス検索（400ms）。500ユーザーまでスキャン。初回検索時にキャッシュし、以降はメモリ内フィルタリング。
- **いいね**: 投稿カードのハートボタンで送信。ダブルタップでもいいね可能。**タップ位置にハートバースト + パーティクルアニメーション**。**楽観的UI更新**（即座に反映、失敗時ロールバック）。
- **自分の投稿にもいいね可能**（ただしXP付与なし）。
- **いいね取り消し可能**（XPは戻さない — ファーミング防止）。
- **いいねは無制限**。XP付与のみ1日5回制限。超過時はトースト通知。
- **いいねしたユーザー一覧**: いいね数タップでボトムシート表示（最大50件）。
- **フォロー/アンフォロー**: 投稿カード内のFollowボタンからトグル。**楽観的UI更新**（即座に反映、失敗時ロールバック）。
- **ユーザー遷移**: 投稿者アイコンタップ → `/user/[uid]` 公開版マイページを閲覧可能。
- **ブロックユーザー非表示**: `privateData.blockedUsers` に含まれるユーザーの投稿はクライアント側でフィルタリング。
- **投稿メニュー（···）**: 自分の投稿→編集/削除、他人の投稿→ブロック/通報。
- **投稿詳細モーダル**: Shorts風スナップスクロール。**右スワイプで閉じる**（GPU加速アニメーション）。
- **Empty State**: 投稿ゼロ時ユーカリアイコン + 誘導テキスト表示。

---

### 6.4 POST画面（ログ投稿）

**ルート**: `/post`, `/post/edit/[postId]`

**2ステップ投稿フロー**:

**Step 1 — Setup**:
- **モード選択**: 5つのフォーカスモードからpill型ボタンで1つ選択（必須）。デフォルトはプロフィールのメインモード。
- **公開設定**: Public / Private のトグル。
- **画像（任意）**: タップで画像選択 → react-easy-crop で1:1クロップ → Canvas APIで1024×1024pxにリサイズ（JPEG品質85%、最大300KB） → EXIF自動除去。
- **プレビューカード**: 選択内容をリアルタイムでカード形式でプレビュー。画像なしの場合はフォーカスモード対応グラデーション背景を表示。

**Step 2 — Diary & Post**:
- **テキスト入力**: 400文字以内（ASCII文字のみ、リアルタイム文字数カウント）。
- **禁止語句チェック**: 投稿前にクライアント側で `moderation_config/main.bannedWords`（またはデフォルトリスト）と照合。該当時は投稿ブロック。
- 少なくとも1文字以上の入力が必須。

**投稿制限**: 1日1回。当日すでに投稿済みの場合は投稿完了メッセージを表示。

**画像保存先**: `posts/{userId}/{postId}.jpg`

**画像なし投稿**: フォーカスモードに対応したブランドカラーグラデーション背景にテキスト中央寄せのカードデザインで表示。アスペクト比 4:3。

**XP付与**: 投稿完了時に +50XP。初投稿時はさらに +100XP。XPToast で獲得XP表示（1.2秒）。レベルアップ時は LevelUpAnimation を追加表示。

**ストリーク更新**: 最終投稿日が昨日なら `currentStreak + 1`、今日なら維持、それ以前なら `1` にリセット。7の倍数到達時は追加 +100XP。

**投稿の編集** (`/post/edit/[postId]`): 投稿後 **5分以内** のみ可能。テキストとモードのみ編集可（画像変更不可）。期限超過時はエラー表示。

**投稿の削除**: いつでも可能（本人のみ、confirm確認付き）。

---

### 6.5 GROUPS画面（フォーカスグループ）

**ルート**: `/groups`, `/groups/create`, `/groups/[groupId]`

#### Live Session（ライブセッション）
- `admin_config/main.liveSession` から取得。`label`, `url`, `description` フィールド。
- `url` が設定されている場合: 緑のパルスドット + 「LIVE」バッジ + 青い「Join」ボタン（外部リンク）。
- `url` が未設定の場合: グレーのドット + 「Next session TBD」 + 無効化された「Join」ボタン。
- グループ一覧の最上部に表示。

#### 公式グループ（Official Groups）
- 各フォーカスモードごとに1つの公式グループが存在（`isOfficial: true`）。
- ユーザーのメインモード変更時に自動参加/退出。
- 公式グループはメンバー上限なし。
- グループ一覧でモード別に表示。

#### ユーザー作成グループ
- **グループ一覧** (`/groups`): クローズ済みグループは非表示。モードフィルタ・検索機能あり。
- **参加条件**: **Lv.13以上**（約2日間の活動で到達）。未満の場合はプログレスバー表示。
- **作成条件**: **Lv.20以上**（約8日間の活動で到達）。未満の場合はプログレスバー表示。
- **リーダー制限**: 1ユーザーにつきリーダーになれるグループは1つまで。
- **グループ作成** (`/groups/create`): グループ名（30文字以内、**アクティブグループ内で重複不可**）+ フォーカスモード選択 + アイコン画像（任意）+ グループ目標（任意）。
- **最大人数**: **10名**。満員時は **「FULL」バッジ** 表示。
- **識別**: 「フォーカスモードアイコン」+「グループ名」+「人数/10 members」+ リーダー情報。
- **リーダー**: 作成者に **Leaderマーク** 付与。
- **参加**: 即参加（承認制なし）。ボタンクリックで `memberIds` に追加。
- **退出**: 自由に退出可能。メンバーが0になったグループは自動クローズ。
- **キック**: リーダーのみ可能。
- **リーダー退出時**: 確認ダイアログ「リーダーが退出するとグループは解散されます」→ `isClosed: true` に更新。

#### グループチャット (`/groups/[groupId]`)
- リアルタイム (`onSnapshot`) テキストメッセージ。100文字以内。
- Enterキーで送信可能。
- **リアクション**: メッセージごとのハートリアクション（Map形式 `{ userId: true }`）。
- **既読管理**: `lastRead/{userId}` サブコレクションで各ユーザーの最終読み取り時刻を記録。
- **最終メッセージプレビュー**: グループ一覧にて `lastMessageText` / `lastMessageBy` を表示。

---

### 6.6 MY PAGE画面

**ルート**: `/mypage`

- **Instagram風中央レイアウト**: アバター（80px）→ 名前 → モード+地域タグ → ゴール → 統計（Likes/Streak/Following）→ 所属グループ（プリセット含む、アイコン+名前）を縦に中央配置。
- **設定ボタン**: 右上に歯車アイコン → `/settings` へ遷移。
- **AI振り返りボタン**: 日曜日のみ表示（「Copy AI Review Data」）。
- **フォロー中リスト**: Followingタップでフルスクリーンモーダル表示（最大50件）。**右スワイプで閉じる**。
- **モードフィルター**: 5つのモードアイコン（48px）+ All ボタン。コンパクト配置。
- **投稿グリッド**: 4列グリッドでサムネイル表示。フッターの裏まで表示領域を拡張（末尾にスペーサー）。タップで投稿詳細モーダル。Private投稿には鍵アイコン。
- **投稿詳細モーダル**: 全投稿を縦スクロール表示。**右スワイプで閉じる**（GPU加速アニメーション）。

---

### 6.7 設定画面 (Settings)

**ルート**: `/settings`

- **プロフィール編集**: ニックネーム（半角英数字15文字、**重複不可**）、滞在地域（スクロール選択式）、目標（100文字、リアルタイム文字数カウント）、メインモード（pill型ボタン選択）、渡航予定日、プロフィール写真（**丸型クロップ**付き、512×512px → `avatars/{userId}.jpg` に保存）。
- **フェーズ切り替え**: ステータス（渡航前/ワーホリ中/帰国後）を手動変更。各選択肢にconfirm確認ダイアログ付き。現在のステータスに ✓ マーク表示。
- **通報機能**: 対象ユーザーID + 理由 + スクリーンショット画像を入力して `reports` コレクションに送信（画像は `reports/` に保存）。
- **通知設定**: アコーディオン内に3つのトグル（いいね通知、グループメッセージ通知、ストリーク警告通知）。
- **法定項目**: プライバシーポリシー、利用規約、法的通知（Firestoreの `legal_docs` コレクションから取得、フォールバック付き）。
- **アカウント管理**: ログアウト（confirm付き）、アカウント削除（confirm付き + 再認証）。
- **拡張枠**: 将来的な Stripe サブスク導入の余白。

### 地域選択肢（REGIONS）
Sydney, Melbourne, Brisbane, Perth, Adelaide, Gold Coast, Canberra, Cairns, Darwin, Hobart, Japan, Other

---

### 6.8 AI振り返りデータコピー機能（マイページ内）

毎週日曜にマイページで「AI振り返り用データをコピー」ボタンを表示。

**コピー内容の構成**:
1. **【現在の目標】**: ユーザーの `goal` フィールド
2. **【直近7日間の活動ログ】**: クライアント側で集計した日付・カテゴリ・テキスト + 各カテゴリ投稿数 + 獲得XP + ストリーク日数 + 現在のD+とLv
3. **【AIへの指示プロンプト】**: Firestore `admin_config.ai_prompt_template` から取得

**運営メリット**: Firebase Console で `ai_prompt_template` を書き換えるだけで、アプリ更新なしにAIの分析スタイルを変更可能。

---

### 6.9 マイルストーン演出

以下の節目に **Framer Motion を用いた全画面祝祭アニメーション** を表示:
- D+30, D+100, D+200, D+365

**実装詳細**:
- HOME画面読み込み時に `dayNumber` をチェック。
- `localStorage` に `milestone_{N}_shown` フラグを保存し、各マイルストーンは1回のみ表示。
- Spring アニメーション（scale + 揺れ）+ カラフルドットのconfetti風パーティクル。
- 「Keep Going! 🪃」ボタンで閉じる。

---

### 6.10 通報・ブロック・モデレーション機能

#### 投稿レベルの通報
- 投稿カードの「···」メニューから「Report」で通報。
- `posts/{postId}/reports/{reporterId}` サブコレクションに記録（1ユーザー1回のみ）。
- `reportCount` をインクリメント。
- **自動非表示**: `reportCount` が **3以上** に達したら `status: "hidden"` に自動更新。

#### ユーザーレベルの通報
- 設定画面から対象ユーザーIDと理由 + スクリーンショット画像を入力。
- `reports` コレクションに記録（画像は Storage `reports/` に保存）。
- 運営が Firebase Console で確認・対応。

#### ブロック
- 投稿カードの「···」メニューから「Block」でブロック。
- `users/{uid}/private/config.blockedUsers` 配列に相手UIDを追加。
- ブロックしたユーザーの投稿を EXPLORE で非表示（クライアント側フィルタリング）。
- 解除（unblock）機能あり。

#### 禁止語句フィルター
- `moderation_config/main.bannedWords` 配列をキャッシュ。
- 投稿前にクライアント側で照合。一致した場合は投稿をブロック。
- Firestoreにデータがない場合はデフォルトリスト使用。

---

### 6.11 フォロー機能

- **フォロー/アンフォロー**: EXPLORE の投稿カード内 Follow ボタン、または公開プロフィール画面からトグル。
- **楽観的UI更新**: フォロー/アンフォロー操作は即座にUI反映。Firestore書き込みはバックグラウンド。失敗時はロールバック。`AuthContext` に `optimisticFollow` / `optimisticUnfollow` メソッド。
- **データ構造**: `users/{uid}/following/{targetUid}` サブコレクション。
- **キャッシュ**: 最大200件のフォローIDをAuthContextでキャッシュ。
- **フォロー優先表示**: EXPLOREでフォロー中ユーザーの投稿をスコアベースで優先表示（+50pt）。
- **フォロワー非表示**: 意図的にフォロワー数/一覧は表示しない（SNS依存防止デザイン）。
- **アカウント削除時**: following サブコレクションも一括削除。

---

### 6.12 公開プロフィール画面

**ルート**: `/user/[uid]`

- **Instagram風中央レイアウト**: アバター（96px）→ 名前 → モード+地域タグ → ゴール → 統計（Likes/Streak/Following）→ 所属グループ（プリセット含む）を縦に中央配置。MyPageと同一デザイン。
- そのユーザーの **公開 (public) かつアクティブ (active)** な投稿を4列グリッドで表示。フッターの裏まで表示領域拡張。モードフィルター付き。
- **フォロー/アンフォロー**: 楽観的UI更新（即座に反映、失敗時ロールバック）。
- **ブロック/アンブロック**: ブロックボタンタップでブロック、「Blocked」バッジタップで解除（confirm付き）。
- **投稿詳細モーダル**: タップで全投稿縦スクロール表示。**右スワイプで閉じる**。
- **閉じるボタン**: 右上に × ボタン。

---

## 7. UI/UXデザイン（Aussie Vibes）

### テーマカラー

| 名前 | コード | Tailwind名 | 意味 |
|---|---|---|---|
| Aussie Gold | `#FFB800` | `aussie-gold` | 太陽、喜び、Fun |
| Ocean Blue | `#0077BE` | `ocean-blue` | 海、成長、Growth |
| Outback Clay | `#B85C38` | `outback-clay` | 赤土、情熱、運営メッセージ |
| Sand Beige | `#F5F5DC` | `sand-beige` | 背景（シェル外側） |

### テキストなし投稿のグラデーション（5種）

| インデックス | クラス | 対応モード |
|---|---|---|
| 0 | `from-aussie-gold to-amber-400` | enjoying |
| 1 | `from-ocean-blue to-cyan-400` | challenging |
| 2 | `from-outback-clay to-orange-400` | english |
| 3 | `from-purple-500 to-pink-400` | skills |
| 4 | `from-green-500 to-teal-400` | social-media |

### フッターナビゲーション（5タブ）

固定フッター（`fixed bottom-0`、シェル幅に合わせて `max-w-[450px]` で中央配置）。

| タブ | ルート | アイコン | 機能 |
|---|---|---|---|
| HOME | `/home` | 🦘 カンガルー（SVG） | メインカウンター、Lv、Zoom、週間レポート |
| EXPLORE | `/explore` | 🐹 クオッカ風（SVG） | 全投稿タイムライン |
| POST | `/post` | 🪃 ブーメラン（SVG） | **中央配置・フローティング（-mt-6）・14×14の円**。Aussie Gold背景。 |
| GROUPS | `/groups` | 🐨 コアラ（SVG） | フォーカスグループチャット |
| MY PAGE | `/mypage` | ユーザーのプロフィール写真（正円24px） | アクティブ時はゴールドの `ring-2` 枠線 |

### モードカラー規則
- **WH系（enjoying / challenging）**: 選択時 `bg-aussie-gold text-white`、非選択時 `bg-amber-50 text-amber-700`
- **その他（english / skills / social-media）**: 選択時 `bg-ocean-blue text-white`、非選択時 `bg-blue-50 text-blue-700`
- すべてのモード選択UI（Explore、Post、Edit、Groups Create、MyPage、User Profile）で統一適用。

### 共通UIパターン
- ローディング: カンガルーアイコン7匹が円軌道を自転+公転するアニメーション（LoadingSpinnerコンポーネント、fullScreen対応）。ルートの `loading.tsx` でページ遷移時にも表示。
- カード: `rounded-2xl shadow-sm border border-gray-100`
- ボタン（プライマリ）: `bg-aussie-gold text-white font-bold rounded-full`
- フォーム入力: `border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-aussie-gold`
- ページ下部余白: `pb-20`（フッターナビ分）
- 確認ダイアログ: `ConfirmModal` コンポーネント（汎用）
- XPトースト: `XPToast` コンポーネント（1.2秒表示後自動消去）
- レベルアップ演出: `LevelUpAnimation` コンポーネント（フルスクリーンオーバーレイ）
- **右スワイプで閉じる**: フルスクリーンモーダル（Explore詳細、MyPage投稿/フォロー一覧、User Profile投稿）。`useSwipeDismiss` フック。GPU加速（`will-change: transform` + `translateZ(0)`）。水平移動が垂直の1.5倍以上で発動。しきい値80px。
- **いいねアニメーション**: `@keyframes like-burst`（スプリングスケール）+ `@keyframes like-particle`（放射散布）+ `@keyframes fade-in-out`（トースト）。`globals.css` で定義。

### Empty State
- 投稿ゼロ時: **「🪃 最初の1枚を投稿して、カウントを始めよう！」** の誘導表示。

---

## 8. Firestore データベース構造

### `users` コレクション

| フィールド | 型 | 説明 |
|---|---|---|
| uid | string | ユーザーID（ドキュメントIDと同一） |
| displayName | string | ニックネーム（15文字以内、半角英数字のみ） |
| photoURL | string | プロフィール画像URL（未設定時は空文字） |
| status | string | `pre-departure` / `in-australia` / `post-return` |
| totalXP | number | 累計XP |
| currentStreak | number | 現在の連続投稿日数 |
| lastPostAt | string | 最終投稿日時（ISO 8601） |
| departureDate | string | 渡航予定日 `YYYY-MM-DD` |
| returnStartDate | string | 帰国開始日 `YYYY-MM-DD` |
| mainMode | string | メインフォーカスモード |
| region | string | 滞在地域 |
| goal | string | 目標（100文字以内） |
| isPro | boolean | サブスクリプション状態（将来用、初期は `false`） |
| dailyLikeCount | number | 当日のいいね送信数 |
| lastLikeDate | string | 最終いいね送信日 `YYYY-MM-DD` |
| weeklyGoal | number | 週間投稿目標（表示用） |
| weekStreak | number | 週間チャレンジ連続達成数（冠位十二階ランク表示用） |
| groupIds | array | 所属グループIDの配列 |
| createdAt | timestamp | アカウント作成日時 |

### `users/{uid}/private/config` サブコレクション（プライベートデータ）

| フィールド | 型 | 説明 |
|---|---|---|
| blockedUsers | array | ブロックしたユーザーUIDの配列 |
| fcmToken | string | FCMプッシュ通知トークン |
| notificationPrefs | map | `{ likes: bool, groupMessage: bool, streakWarning: bool }` — 通知種別ごとのON/OFF |

### `users/{uid}/following` サブコレクション

| フィールド | 型 | 説明 |
|---|---|---|
| （ドキュメントID = フォロー先UID） | — | — |
| createdAt | timestamp | フォロー日時 |

### `posts` コレクション

| フィールド | 型 | 説明 |
|---|---|---|
| id | string | 投稿ID（自動生成） |
| userId | string | 投稿者UID |
| mode | string | フォーカスモード |
| imageUrl | string | 画像URL（画像なし投稿は空文字） |
| content | string | 投稿テキスト（400文字以内） |
| phase | string | 投稿時のフェーズ |
| dayNumber | number | D+数値 or D-数値 |
| likeCount | number | いいね数 |
| visibility | string | `public` / `private` |
| status | string | `active` / `hidden` / `pending` |
| reportCount | number | 通報数（3以上で自動非表示） |
| createdAt | timestamp | 投稿日時 |
| editableUntil | timestamp | 編集可能期限（投稿から5分後） |

### `posts/{postId}/likes` サブコレクション

| フィールド | 型 | 説明 |
|---|---|---|
| （ドキュメントID = いいねしたユーザーUID） | — | — |
| userId | string | いいねしたユーザーUID |
| createdAt | timestamp | いいね日時 |

### `posts/{postId}/reports` サブコレクション

| フィールド | 型 | 説明 |
|---|---|---|
| （ドキュメントID = 通報者UID） | — | 1ユーザー1回のみ |
| reason | string | 通報理由 |
| createdAt | timestamp | 通報日時 |

### `groups` コレクション

| フィールド | 型 | 説明 |
|---|---|---|
| id | string | グループID |
| mode | string | フォーカスモード |
| groupName | string | グループ名（30文字以内） |
| creatorId | string | リーダーUID |
| memberIds | array | メンバーUIDの配列（ユーザー作成は最大10） |
| memberCount | number | 現在の参加人数 |
| isOfficial | boolean | 公式グループフラグ |
| iconUrl | string | グループアイコンURL（任意） |
| goal | string | グループ目標/説明（任意） |
| isClosed | boolean | クローズ済みフラグ |
| lastMessageAt | timestamp | 最終メッセージ日時 |
| lastMessageText | string | 最終メッセージテキスト（プレビュー用） |
| lastMessageBy | string | 最終メッセージ送信者UID |
| createdAt | timestamp | グループ作成日時 |

### `groups/{groupId}/messages` サブコレクション

| フィールド | 型 | 説明 |
|---|---|---|
| senderId | string | 送信者UID |
| text | string | メッセージ本文（100文字以内） |
| createdAt | timestamp | 送信日時 |
| reactions | map | `{ userId: true }` 形式 |

### `groups/{groupId}/lastRead` サブコレクション

| フィールド | 型 | 説明 |
|---|---|---|
| （ドキュメントID = ユーザーUID） | — | — |
| readAt | timestamp | 最終読み取り日時 |

### `reports` コレクション（ユーザー通報）

| フィールド | 型 | 説明 |
|---|---|---|
| reporterId | string | 通報者UID |
| targetUserId | string | 対象ユーザーUID |
| targetPostId | string | 対象投稿ID（任意） |
| reason | string | 通報理由 |
| imageUrl | string | スクリーンショットURL |
| createdAt | timestamp | 通報日時 |
| resolved | boolean | 対応済みフラグ |

### `admin_config/main` ドキュメント

| フィールド | 型 | 説明 |
|---|---|---|
| message | string | 運営メッセージ |
| bannerImageUrl | string | バナー画像URL |
| zoomUrl | string | ZoomミーティングURL |
| zoomLabel | string | Zoomボタンラベル |
| zoomSchedules | array | `{ dayOfWeek, startTime, endTime }` 形式のスケジュール配列 |
| zoomNextInfo | string | 次回セッション情報テキスト（deprecated） |
| liveSession | map | `{ label, url, description }` — Community タブのライブセッション表示用 |
| announcements | array | `{ title, body?, type, linkUrl?, linkLabel?, active }` — HOME画面のお知らせ |
| ai_prompt_template | string | AI振り返り用プロンプトテンプレート |

### `banners` コレクション（読み取り専用）

運営バナー情報。認証済みユーザーのみ読み取り可。

### `moderation_config/main` ドキュメント

| フィールド | 型 | 説明 |
|---|---|---|
| bannedWords | array | 禁止語句リスト |

---

## 9. Firestore セキュリティルール

ファイル: `firestore.rules`

### Users
- **読み取り**: 認証済みユーザーは全ユーザーを読み取り可。
- **作成・削除**: 本人のみ。
- **更新（本人）**: ホワイトリスト制。変更可能フィールド: `displayName`, `displayNameLower`, `photoURL`, `region`, `showRegion`, `goal`, `mainMode`, `departureDate`, `returnStartDate`, `status`, `weeklyGoal`, `groupIds`, `currentStreak`, `lastPostAt`, `totalXP`, `dailyLikeCount`, `lastLikeDate`, `streakWarningSent`, `weekStreak`, `lastCompletedWeekStart`。`isPro`, `createdAt`, `uid` は不変。
- **更新（他人）**: `totalXP` のみ（いいねシステム用、+5固定のインクリメントのみ許可）。`groupIds` の同期は Cloud Function `syncGroupMembership` が担当。

### Users > Private
- 読み取り・作成・更新すべて本人のみ。更新は `blockedUsers`, `fcmToken`, `notificationPrefs` のみ。

### Users > Following
- 読み取り: **本人のみ**（フォロワーリストのプライバシー保護）。作成・削除: 本人のみ。

### Posts
- **読み取り**: 自分の投稿は常に閲覧可。他人の投稿は `status == "active"` かつ `visibility == "public"` のみ。
- **作成**: 認証済み + `userId` が自身 + `content` 0〜500文字（画像のみ投稿で空文字許可） + `status == "active"` + `reportCount == 0` + `likeCount == 0`。
- **更新（作成者）**: (1) `imageUrl` のみ（投稿後の画像アップロード用）、または (2) `editableUntil` 内で `content` + `mode` のみ（0〜500文字）。
- **更新（いいね）**: 認証済み + `visibility == "public"` + `likeCount` の +1/-1 のみ。
- **更新（通報）**: 他人の投稿 + `visibility == "public"` + `reportCount` +1、または `reportCount` +1 + `status: "hidden"`（3件以上）。
- **削除**: 作成者本人のみ。

### Posts > Likes
- 読み取り: 認証済み全員。作成: 自分のUID = ドキュメントID + 対象投稿が `public` かつ `active` であること。削除: 自分のいいねのみ。

### Posts > Reports
- 読み取り: 不可。作成: 認証済み + 自分のUID = ドキュメントID（重複防止）。

### Groups
- **読み取り**: オープンなグループ、またはメンバー/作成者のクローズ済みグループ。
- **作成**: 認証済み + 正しい初期状態（`creatorId` = 自身、`memberIds` = [自身]、`memberCount` = 1、`isClosed` = false、`isOfficial` = false、`groupName` 1〜30文字）。
- **更新（リーダー）**: 設定変更（goal, iconUrl, isClosed）、キック（memberIds 削除 + memberCount -1）、クローズ。
- **参加**: 未メンバーが自身を追加 + memberCount +1。公式グループは上限なし、ユーザー作成は10名まで。
- **退出（非リーダー）**: 自身を削除 + memberCount -1。空になったら自動クローズ。
- **退出（リーダー）**: `isClosed: true` に更新。
- **メッセージ送信時**: `lastMessageAt`, `lastMessageText`, `lastMessageBy` の更新。
- **削除**: 不可。

### Groups > LastRead
- 読み書き: 本人のみ。

### Groups > Messages
- 読み取り・作成: グループメンバーのみ。作成時は `senderId` = 自身、`text` 1〜100文字。
- 更新（リアクション）: グループメンバーのみ。`reactions` フィールドのみ変更可。
- 更新（送信者編集/取り消し）: 送信者のみ。`text`, `edited`, `unsent` フィールドのみ。取り消し時（`unsent == true`）はテキスト長制約を免除。

### Reports
- 読み取り: 不可。作成: 認証済み + `reporterId` = 自身 + `resolved` = false。

### Admin Config / Banners / Moderation Config / Legal Docs
- 読み取り: 認証済み全員。書き込み: 不可（管理者はConsoleで編集）。
- `legal_docs/{docId}`: Terms(`terms`), Privacy(`privacy`), Legal Notice(`legal_notice`)。`content` フィールドにHTML。

---

## 10. アカウント削除時の処理

設定画面から実行（confirm付き + Google再認証）。以下を順次実行:

1. ユーザーの全 `posts` ドキュメントをバッチ削除（最大500件）
2. Firebase Storage 内の `posts/{userId}/` 配下の全画像ファイル削除
3. Firebase Storage 内の `avatars/{userId}.jpg` を削除
4. 全 `groups` をスキャンし:
   - リーダーのグループは `isClosed: true` に更新（自動クローズ）
   - メンバーとして参加中のグループから `memberIds` を除去 & `memberCount` を -1
5. `users/{uid}/following` サブコレクション全削除
6. `users/{uid}/private/config` ドキュメント削除
7. `users` ドキュメント削除
8. Google再認証（`reauthenticateWithPopup` → `reauthenticateWithRedirect` フォールバック）
9. Firebase Auth アカウント削除

---

## 11. 文字数制限まとめ

| フィールド | 上限 |
|---|---|
| ニックネーム | 15文字（半角英数字のみ） |
| 投稿テキスト (content) | 400文字（ASCII文字のみ） |
| 目標 (Goal) | 100文字 |
| グループメッセージ | 100文字 |
| グループ名 | 30文字 |

---

## 12. 投稿編集ルール

- **編集**: 投稿後 **5分以内** のみ可能。テキスト（content）とモードのみ変更可。画像は変更不可。
- **削除**: いつでも可能（本人のみ、confirm確認付き）。

---

## 13. 画像処理仕様

### 圧縮パイプライン（`imageUtils.ts`）

| パラメータ | デフォルト値 |
|---|---|
| 最大サイズ（幅/高さ） | 1024px |
| 最大ファイルサイズ | 300KB |
| 初期JPEG品質 | 0.85 |
| 最低JPEG品質 | 0.6 |

- Canvas を通すことで **EXIF メタデータ（GPS座標、カメラ情報等）を自動除去**。
- ファイルサイズが300KBを超える場合、品質を0.1刻みで下げて再圧縮。

### 用途別出力

| 用途 | 出力サイズ | 保存先 |
|---|---|---|
| 投稿画像 | 1024×1024px（1:1クロップ） | `posts/{userId}/{postId}.jpg` |
| アバター | 512×512px（丸型クロップ） | `avatars/{userId}.jpg` |
| グループアイコン | — | `groups/{groupId}.jpg` |
| 通報スクリーンショット | 最大1024px | `reports/{reporterId}_{timestamp}.jpg` |

---

## 14. ファイル構成

```
src/
├── app/
│   ├── layout.tsx              # ルートレイアウト（AuthProvider、450pxシェル）
│   ├── page.tsx                # ルートリダイレクト
│   ├── loading.tsx             # ルートローディング（カンガルースピナー）
│   ├── error.tsx               # ルートエラー画面（リトライ+ホーム遷移）
│   ├── opengraph-image.tsx     # OG画像動的生成（1200×630px）
│   ├── globals.css             # Tailwind v4 + テーマカラー定義
│   ├── (auth)/
│   │   ├── login/page.tsx      # ログイン画面（法的同意リンク付き）
│   │   └── onboarding/page.tsx # オンボーディング画面
│   ├── home/page.tsx           # HOME画面
│   ├── explore/page.tsx        # EXPLORE画面
│   ├── post/
│   │   ├── page.tsx            # 投稿画面（2ステップ）
│   │   └── edit/[postId]/page.tsx  # 投稿編集画面
│   ├── groups/
│   │   ├── page.tsx            # グループ一覧・検索
│   │   ├── create/page.tsx     # グループ作成
│   │   └── [groupId]/page.tsx  # グループチャット
│   ├── mypage/page.tsx         # マイページ
│   ├── settings/page.tsx       # 設定画面
│   └── user/[uid]/page.tsx     # 公開プロフィール
├── components/
│   ├── Avatar.tsx              # アバター（写真 or イニシャル）
│   ├── PostCard.tsx            # 投稿カード（いいね・フォロー・通報・ブロック・いいね一覧モーダル）
│   ├── WeeklyChallenge.tsx     # 週間チャレンジ進捗（冠位十二階ランクカラー、5日ストリーク線、週期間表示）
│   ├── WeeklyHistoryModal.tsx  # ゴール編集 + 過去12週モード別棒グラフ + ストリーク履歴
│   ├── ImageCropper.tsx        # 画像クロップUI
│   ├── MilestoneAnimation.tsx  # マイルストーン演出
│   ├── LevelUpAnimation.tsx    # レベルアップ演出
│   ├── XPToast.tsx             # XP獲得トースト
│   ├── LoadingSpinner.tsx      # ローディングスピナー（カンガルー7匹公転+自転）
│   ├── ConfirmModal.tsx        # 汎用確認ダイアログ
│   ├── LegalModals.tsx         # 利用規約・プライバシーポリシーモーダル（Firestore管理+フォールバック）
│   ├── NotificationToast.tsx   # 通知トーストUI（Framer Motion、スワイプ dismissible）
│   ├── BannerCarousel.tsx      # 運営バナーカルーセル
│   ├── PWAInstallBanner.tsx   # PWAインストール促進バナー（iOS視覚ステップガイド）
│   ├── PostDetailModal.tsx    # 共通投稿詳細モーダル（list/snap 2バリアント）
│   ├── PostGrid.tsx           # 共通4列サムネイルグリッド
│   ├── ModeFilterBar.tsx      # 共通モードフィルターバー
│   ├── FollowingModal.tsx     # フォロー一覧モーダル
│   ├── ProfileGroups.tsx      # 所属グループ表示コンポーネント
│   ├── AsciiWarn.tsx           # ASCII入力警告バナー
│   ├── GroupCard.tsx           # グループカード
│   ├── icons/index.tsx         # SVGアイコンコンポーネント群
│   └── layout/
│       └── BottomNav.tsx       # フッターナビゲーション
├── contexts/
│   └── AuthContext.tsx         # 認証コンテキスト（user, profile, privateData, following）
├── hooks/
│   ├── useAuthGuard.ts         # 認証ガードフック
│   ├── useSwipeDismiss.ts      # 右スワイプで閉じるジェスチャー（GPU加速）
│   └── useAsciiInput.ts        # ASCII文字のみ入力制限 + 警告表示
├── lib/
│   ├── firebase.ts             # Firebase初期化（Auth, Firestore, Storage, Analytics, App Check）
│   ├── auth.ts                 # Google認証ヘルパー（popup → redirect fallback）
│   ├── utils.ts                # ユーティリティ（レベル計算、日数カウント、色生成）
│   ├── constants.ts            # 定数（フォーカスモード、マイルストーン、グラデーション、地域、制限値）
│   ├── validators.ts           # バリデーション（ニックネーム・グループ名重複チェック）
│   ├── feedScore.ts            # フィードスコアリングアルゴリズム + 既読追跡
│   ├── follow.ts               # フォロー/アンフォロー操作
│   ├── groups.ts               # 公式グループ参加/退出 + fetchUserGroups
│   ├── postUtils.ts            # 共通投稿ユーティリティ（getPostThumb）
│   ├── fcm.ts                  # FCMトークン登録・メッセージリスナー
│   ├── imageUtils.ts           # 画像圧縮・EXIF除去
│   └── services/
│       ├── posts.ts            # 投稿CRUD、XP更新、モデレーション、禁止語句
│       └── users.ts            # プロフィールCRUD、アバター、アカウント削除、通報、ブロック
└── types/
    ├── index.ts                # Post, Group, UserProfile, UserPrivate インターフェース
    └── next-pwa.d.ts           # PWA型定義

firestore.rules                 # Firestoreセキュリティルール
next.config.ts                  # Next.js設定（セキュリティヘッダー + Sentry）
sentry.client.config.ts         # Sentry クライアント設定
sentry.server.config.ts         # Sentry サーバー設定
sentry.edge.config.ts           # Sentry Edge設定
functions/src/index.ts          # Cloud Functions（全7つ）
public/
├── manifest.json               # PWAマニフェスト（OGP、iOS standalone対応）
├── robots.txt                  # クローラー設定
├── sitemap.xml                 # サイトマップ
├── firebase-messaging-sw.js    # Service Worker（FCM + オフラインフォールバック）
├── offline.html                # オフラインフォールバックページ
└── icons/                      # PWAアイコン（192×192, 512×512, kangaroo-like）
```

---

## 15. Cloud Functions（全7つ、デプロイ済み）

| 関数名 | トリガー | 機能 |
|---|---|---|
| `moderatePost` | `onDocumentCreated("posts/{postId}")` | 投稿自動モデレーション。禁止語句チェック + 毒性スコア計算。該当時は `status: "hidden"` に更新 + ログ記録。 |
| `checkReportThreshold` | `onDocumentCreated("posts/{postId}/reports/{reporterId}")` | 通報3件で自動非表示。`reportCount` を記録。管理者メール通知は1件目と3件目のみ送信（スパム防止）。管理者メールは `ADMIN_EMAIL` シークレット（Firebase Secret Manager）で管理。 |
| `onLikeCreated` | `onDocumentCreated("posts/{postId}/likes/{likerId}")` | いいね通知。投稿者にFCMプッシュ通知「{likerName} liked your post」を送信。自己いいねはスキップ。`notificationPrefs.likes` を尊重。無効トークンは自動クリーニング。**レート制限**: 同一投稿者への通知は60秒間クールダウン。 |
| `checkStreaks` | `onSchedule("every 1 hours")` | ストリーク管理。48時間超過でリセット。42時間経過時にFCM警告通知。`notificationPrefs.streakWarning` を尊重。 |
| `cleanupHiddenPosts` | `onSchedule("every day 03:00")` | 非表示投稿の30日後自動削除（100件/回）。 |
| `onGroupMessageCreated` | `onDocumentCreated("groups/{groupId}/messages/{messageId}")` | グループメッセージ通知。送信者以外の全メンバーにFCM通知。`notificationPrefs.groupMessage` を尊重。**レート制限**: 同一グループへの通知は10秒間クールダウン。 |
| `syncGroupMembership` | `onDocumentUpdated("groups/{groupId}")` | メンバー除外時の `groupIds` 同期。キック/退出で除外されたユーザーの `groupIds` から自動削除。 |

---

## 16. 未実装・将来対応項目

| 項目 | ステータス | 備考 |
|---|---|---|
| フォロー通知 | 未実装 | — |
| プライバシーポリシー・利用規約の内容精査 | 未完了 | LegalModals + Firestore `legal_docs` は実装済み、本文は仮 |
| Stripeサブスクリプション | 未実装 | `isPro` フィールドのみ用意済み |
| App Check の Cloud Firestore 強制適用 | 未有効化 | reCAPTCHA Enterprise トークン取得が本番で失敗する問題の解決が必要 |
| 全体的なUIデザイン改善 | 継続 | — |
| ~~OG画像作成~~ | **実装済み** | `opengraph-image.tsx` で動的生成（アプリアイコン + カンガルー使用） |
| ~~FCM VAPID key修正~~ | **解決済み** | 本番で動作確認済み |

---

## 変更履歴

| バージョン | 日付 | 内容 |
|---|---|---|
| v2 Final | — | 最終確定仕様書 |
| v3 | 2025-03-10 | Phase 1〜9 実装完了。実装詳細・ルート・ファイル構成・未実装項目を追記。 |
| v3 改訂 | 2026-03-12 | 現在の実装に完全準拠して全面書き直し。主な差分: レベル計算式を `sqrt(TotalXP/4)+1` に修正、投稿テキストを統合 `content` フィールド（400文字）に変更、投稿に `visibility`（public/private）と `status`（active/hidden/pending）を追加、フォロー機能・公式グループ・投稿モデレーション（自動非表示）・禁止語句フィルター・ブロックUI を追記、グループ作成条件を Lv.5 に修正、自己いいね（XP付与なし）を明記、ダブルタップいいね・2ステップ投稿フロー・画像圧縮仕様を追記、Firestore構造に `users/private`・`users/following`・`posts/reports`・`groups/lastRead`・`banners`・`moderation_config` を追加、セキュリティルールを実装準拠で全面更新、アカウント削除手順を拡充。 |
| v3 改訂2 | 2026-03-17 | いいねシステム刷新（無制限いいね、XP上限5回/日、タップ位置アニメーション、いいね一覧モーダル、楽観的UI、XP取り消し廃止）。フィードアルゴリズム導入（スコアベースランキング + localStorage既読追跡）。フォロー楽観的UI更新。公開プロフィールUI刷新（MyPageと統一、ブロック/アンブロックトグル）。モードカラー統一（WH=amber、その他=blue、全6画面）。Live SessionをHOMEからCommunityタブへ移動。HOME画面リファクタ（WeeklyChallenge抽出、ストリーク火消去）。右スワイプで閉じるジェスチャー（useSwipeDismiss、GPU加速）。いいね通知Cloud Function（onLikeCreated、未デプロイ）。新規ファイル: feedScore.ts, WeeklyChallenge.tsx, useSwipeDismiss.ts, AsciiWarn.tsx, useAsciiInput.ts。 |
| v3 改訂5 | 2026-03-27 | セキュリティ監査・強化。Firestoreルール: XP更新を+5固定に制限、フォローリスト読み取りをオーナーのみに制限、いいね作成時にpublic+active検証、メッセージ取消し時のテキスト長制約免除。Cloud Functions: 管理者メールをFirebase Secret Manager (`ADMIN_EMAIL`) で管理、通報メール送信を1件目+3件目のみに最適化、いいね通知60秒クールダウン、グループ通知10秒クールダウン、個人情報ログ削除。クライアント: セキュリティヘッダー5種追加（X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy, COOP）、DOMPurify導入（Legal文書XSS防止）、`isSafeUrl()` でリンクURL検証。Firebase最適化: PostCardプロフィールキャッシュ（モジュールレベルMap）、未読グループバッジをローカルタイムスタンプ比較に変更（getCountFromServer廃止）、グループメンバー差分フェッチ（Promise.all）。 |
| v3 改訂4 | 2026-03-27 | コード品質・パフォーマンス・UX大規模改善。共通コンポーネント抽出（PostDetailModal, PostGrid, ModeFilterBar, FollowingModal, ProfileGroups, postUtils）。PWAインストールバナー（iOSビジュアルステップガイド、毎回表示、z-[200]最前面）。OG画像リデザイン（アプリアイコン+カンガルー使用、opengraph-image.tsx）。manifest short_name変更（"days-count"）。オフラインフォールバック（Service Worker + offline.html）。ローディングスピナー刷新（カンガルー7匹公転+自転アニメーション）。エラーページ追加（error.tsx）。SEOメタデータ追加（7ページにlayout.tsx）。アクセシビリティ改善（12ファイル、aria属性追加）。Firestore並列化（ホーム画面Promise.all、投稿ページPromise.all）。Explore検索キャッシュ化。画像lazy loading全コンポーネント追加。投稿ページモードボタン重複解消。 |
| v3 改訂3 | 2026-03-17 | Cloud Functions全7つデプロイ（moderatePost, checkReportThreshold, onLikeCreated, checkStreaks, cleanupHiddenPosts, onGroupMessageCreated, syncGroupMembership）。通知システム強化（NotificationToast UI、設定画面にトグル3種、通知種別ごとのPrefs対応）。Firestoreセキュリティルール全面監査・強化（groupIds他人更新禁止、フィールドホワイトリスト厳格化）。Legal文書をFirestore管理に移行（legal_docsコレクション）。XPバランス調整（除数4→1.5、Lv.90=10ヶ月目標）。グループ解放レベル変更（参加Lv.13、作成Lv.20、初回ボーナス考慮）。PWA本番対応（OGP、iOS standalone、manifest強化、robots.txt、sitemap.xml）。Sentry導入。カスタムドメイン days-count.com 設定。オンボーディングUI改善（必須/任意マーカー、グリッドレイアウト、英語日付入力）。 |
