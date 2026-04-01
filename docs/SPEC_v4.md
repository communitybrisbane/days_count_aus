# Days Count in AUS — 開発仕様書 (SPEC v4)

> **正式名称**: Days Count in AUS
> **通称（アイコン下表示）**: days count
> **コンセプト**: 「Make Days Count」ー ワーホリ365日で人生変える。
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
| PWA | manifest.json + Service Worker（オフラインフォールバック + FCM） + OGP + iOS standalone（手動設定） |
| ビルドツール | Turbopack（Next.js 16 デフォルト） |
| フォント | Geist / Geist Mono（Google Fonts） |
| HTMLサニタイズ | DOMPurify |

### 主要依存パッケージ

```json
{
  "@sentry/nextjs": "^10.43.0",
  "dompurify": "^3.3.3",
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
- **オフラインフォールバック**: Service Worker が `offline.html` をキャッシュ。ナビゲーション失敗時にブランドデザインの「You're Offline」ページ（Retryボタン付き）を表示。
- **OG画像**: `opengraph-image.tsx` で動的生成（1200×630px）。アプリアイコン + "days-count" テキスト + タグライン + Working Holiday / Journal / Community ピル。カンガルー透かし。
- **セキュリティヘッダー** (`next.config.ts`):
  - `Cross-Origin-Opener-Policy: same-origin-allow-popups`（Google OAuth popup 対応）
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- **HTMLサニタイゼーション**: Legal文書の `dangerouslySetInnerHTML` 表示時に DOMPurify でサニタイズ（XSS防止）。
- **URL検証**: バナー・お知らせのリンクURLは `isSafeUrl()` で `https?://` プロトコルのみ許可。
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

### カウント計算詳細（`getDayCount` 関数）
- **pre-departure**: `departureDate` との差分。正の場合 `D - N`、ゼロ以下は `D + N`（自動切替表示）。
- **in-australia**: `departureDate` からの経過日数 + 1。
- **post-return**: `createdAt`（アカウント作成日）からの経過日数 + 1。

---

## 4. 5つのフォーカスモード

| モード | ID | ラベル | 説明 | ハッシュタグ例 |
|---|---|---|---|---|
| English | `english` | English | IELTS, speaking, language exchange | #english, #ielts, #speaking, #slang |
| Skill | `skill` | Skill | Coding, AI, SNS, portfolio | #skill, #coding, #design, #freelance |
| Challenge | `challenge` | Challenge | Road trips, English interviews, new cities | #challenge, #travel, #roadtrip, #surfing |
| Work | `work` | Work | Farm, cafe job, 88 days | #work, #farm, #barista, #88days |
| Chill | `chill` | Chill | Beach, surfing, cafes, daily vibes | #chill, #daily, #cafe, #sunset |

### レガシーモードマッピング
旧モードIDからの自動変換（`LEGACY_MODE_MAP`）:
- `enjoying` → `challenge`（内部ID: `adventure`）
- `challenging` → `challenge`（内部ID: `adventure`）
- `skills` → `skill`
- `social-media` → `chill`
- `daily` → `chill`

> **注**: ChallengeモードのFirestore上の内部IDは `adventure`。UIラベルは `Challenge`。`resolveMode()` で変換。

### マイページでのフィルタリング
- Fun/Growth分類はなし。ModeFilterBarで5モード + All のフィルタリングのみ。

### ハッシュタグシステム
- 投稿時にモード別ハッシュタグ候補を表示。
- **最大5個**（`HASHTAG_MAX = 5`）。
- カスタムタグも作成可能。
- 投稿データの `tags` フィールド（`string[]`）に保存。

---

## 5. XP・レベル設計

**設計目標**: ゆるやかな成長曲線で、長期継続を促進。

### XP獲得ルール

| アクション | XP | 制限 |
|---|---|---|
| 投稿 | +10 | 1日最大3回まで（`POST_XP_DAILY_MAX = 3`） |
| 週間投稿（段階制） | +10/12/15/20/30/40/60 | 週7回まで（火曜リセット、合計187XP） |
| 初投稿ウェルカムボーナス | 0 | なし |
| いいねをもらう（受信） | +5 | 無制限（自己いいねではXP付与なし） |
| いいねを送る（送信） | +3 | **XP付与は1日5回まで**（計15XP）。いいね自体は**無制限** |
| 連続週ボーナス | +5/投稿/週 | 週間チャレンジ（週5日以上投稿）連続達成で加算、最大10週（+50/投稿） |

### レベル計算式

```
Level = floor( sqrt( TotalXP / 6 ) ) + 1
```

- `xpForLevel(level) = round((level - 1)² × 6)`
- UI: 名前の横に **`Lv.数値`** を常時表示。
- プログレスバー: 次のレベルまでの進捗（%）を表示。

### ストリークルール（連続投稿日数）
- 最終投稿日が **昨日** であればストリーク +1。
- 最終投稿日が **今日** であればストリーク維持（変更なし）。
- 最終投稿日が **それ以前** であればストリーク 1 にリセット。
- 判定は `lastPostAt`（ISO 8601文字列）の日付部分で比較。

### いいねのXPルール
- **他人の投稿にいいね**: 送信者 +3XP（1日5回まで）、受信者 +5XP。
- **自分の投稿にいいね**: いいねカウント増減のみ。XP付与なし。
- **いいね取り消し**: XPは戻さない（ファーミング防止）。
- **XP上限超過時**: トースト通知。いいね自体はブロックしない。
- **いいねアニメーション**: タップ位置にカンガルーが跳ねるアニメーション。
- **いいねしたユーザー一覧**: いいね数タップでボトムシート表示（最大50件）。

---

## 6. 画面・機能詳細

### 6.1 認証・オンボーディング

**ルート**: `/login`, `/onboarding`

**ログイン**: Googleログインのみ（`signInWithPopup` → `signInWithRedirect` フォールバック）。ログイン画面に利用規約・プライバシーポリシーのリンク（LegalModals）を表示。

**ルートリダイレクトロジック** (`/`):
- 未認証 → `/login`
- 認証済み & プロフィール未作成 → `/onboarding`
- 認証済み & プロフィール作成済み → `/home`

**初回登録フロー（6ステップ制）**:

| Step | 内容 | 必須/任意 |
|---|---|---|
| 1 | プロフィール写真（丸型）+ ニックネーム | ニックネーム必須 |
| 2 | ステータス選択（Before / In AUS / Returned） | 必須 |
| 3 | 日付入力（渡航予定日 or 到着日） | 必須（post-returnはスキップ） |
| 4 | フォーカスモード選択（5つから1つ） | 必須 |
| 5 | 地域選択（12地域） | 任意（Skip可） |
| 6 | ゴール設定（100文字） | 任意（Skip可） |

- post-return選択時はStep 3をスキップ（全5ステップ）。
- プログレスバーで進捗表示。戻るボタンで前のステップに戻れる。
- **ニックネーム**: 半角英数字+アンダースコアのみ、15文字以内、**重複不可**（500msデバウンスチェック）。
- **プロフィール写真**: 丸型クロップUI（512×512px出力）。
- プロフィール作成後、選択したメインモードの公式グループに自動参加。

**デフォルトアバター**: ニックネームの頭文字 + ユーザーIDからHSL色相ハッシュ生成した背景色の円。

---

### 6.2 HOME画面 (Dashboard)

**ルート**: `/home`

- **ヒーローヘッダー**: 画面上部にグラデーション背景、白文字で `D + 124` 等を大型表示。フェーズラベル + 挨拶テキスト。
- **週間ゴールカード**: ヘッダーに重なるカード。WeeklyChallenge コンポーネント（週間投稿進捗バー7本、冠位十二階ランクカラー、weekStreak表示、5日ストリーク破線、週の期間 "Mar. 18 – Mar. 24" 表示）。7投稿達成時は「Complete!」バッジ + ゴールド演出。ストリーク継続条件は **週5日以上**（ユニーク日数）。
- **WeeklyHistoryModal**: 鉛筆ボタンから開く。ゴール編集 + 過去12週のモード別スタック棒グラフ + 現在/最高ストリーク表示。
- **XP/Lvバー**: コンパクトな1行表示（Lv + プログレスバー + 次Lvまでの残XP）。
- **バナーカルーセル**: BannerCarousel + adminConfig のバナー画像。
- **お知らせ**: `admin_config/main.announcements` 配列から `active: true` のものを表示（info/warning/event 3タイプ、リンク付き対応）。お知らせカラー: info=green系、warning=red系、event=orange系。
- **通知バナー**: 初回訪問時にプッシュ通知許可バナー表示（dismissで `localStorage` に記録）。
- **フェーズ自動遷移**: 渡航予定日超過 or D+365超過時に ConfirmModal で切り替え提案。
- **マイルストーン演出**: D+30, 100, 200, 365 到達時にフルスクリーンアニメーション。`localStorage` で表示済みフラグ管理（1回のみ表示）。

---

### 6.3 EXPLORE画面（タイムライン）

**ルート**: `/explore`

- **全ユーザーの公開（public）かつアクティブ（active）な投稿** をスコアベースランキングで表示。
- **フィードアルゴリズム** (`feedScore.ts`): クライアント側でスコア計算。
  - フォロー中: +50pt
  - 同じメインモード: +20pt
  - いいね数（0〜10pt、`likeCount / 2` で算出）
  - 新しさ（24時間以内: +10pt、72時間以内: +5pt）
  - 新規ユーザー発見ボーナス: +5pt
  - 既読ペナルティ: -30pt
  - 検索モード時はスコアリングをスキップ。
- **既読追跡**: `localStorage` に投稿IDを保存（最大500件、3日間TTL）。
- **無限スクロール**: `limit(20)` + `startAfter` で20件ずつ追加読み込み。
- **フィルタ**: 上部に固定ヘッダーで5モードフィルタ + All。
- **検索**: ユーザー名・地域でのデバウンス検索（400ms）。500ユーザーまでスキャン。初回検索時にキャッシュ。
- **いいね**: ハートボタン or ダブルタップ。タップ位置にハートバースト。楽観的UI更新。
- **自分の投稿にもいいね可能**（XP付与なし）。
- **いいね取り消し可能**（XPは戻さない）。
- **フォロー/アンフォロー**: 投稿カード内のFollowボタンからトグル。楽観的UI更新。
- **ユーザー遷移**: 投稿者アイコンタップ → `/user/[uid]`。
- **ブロックユーザー非表示**: クライアント側フィルタリング。
- **投稿メニュー（···）**: 自分の投稿→編集/削除、他人の投稿→ブロック/通報。
- **投稿詳細モーダル**: Shorts風スナップスクロール。**右スワイプで閉じる**。

---

### 6.4 POST画面（ログ投稿）

**ルート**: `/post`, `/post/edit/[postId]`

**投稿画面の構成**:

- **モード選択**: 5つのフォーカスモードからpill型ボタンで1つ選択（必須）。デフォルトはプロフィールのメインモード。
- **公開設定**: Public / Private のトグル。
- **画像（任意）**: タップで画像選択 → react-easy-crop で1:1クロップ → Canvas APIで1024×1024pxにリサイズ（JPEG品質85%、最大300KB） → EXIF自動除去。
- **地域選択（任意）**: 投稿に地域タグを付与。デフォルトはプロフィールの地域。
- **日数オーバーライド（任意）**: 日付ピッカーでカスタムD+数値を設定可能。
- **ハッシュタグ**: モード別候補から選択 + カスタムタグ作成。最大5個。
- **テキスト入力**: 400文字以内（ASCII文字のみ、リアルタイム文字数カウント）。
- **禁止語句チェック**: 投稿前にクライアント側で照合。該当時は投稿ブロック。

**投稿制限**: 1日複数回投稿可能。ただしXP付与は1日3回まで（`POST_XP_DAILY_MAX = 3`）。週間段階制XPは1日1回分のみ加算（`lastPostAt` で当日判定）。

**画像保存先**: `posts/{userId}/{postId}.jpg`

**画像なし投稿**: フォーカスモード対応グラデーション背景にテキスト中央寄せのカードデザイン。

**XP付与**: 投稿完了時に +10XP（週間段階制で追加XP）。レベルアップ時は LevelUpAnimation を表示。

**ストリーク更新**: 最終投稿日が昨日なら `currentStreak + 1`、今日なら維持、それ以前なら `1` にリセット。7の倍数到達時は追加 +100XP。

**投稿の編集** (`/post/edit/[postId]`): 投稿後 **5分以内** のみ可能。テキストとモードのみ編集可（画像変更不可）。

**投稿の削除**: いつでも可能（本人のみ、confirm確認付き）。

---

### 6.5 GROUPS画面（フォーカスグループ）

**ルート**: `/groups`, `/groups/create`, `/groups/[groupId]`

#### 24時間 Study Room（常設Zoom自習室）
- GROUPSタブ最上部に常設の24時間Zoomリンクを表示。ユーザー同士がいつでも自習・交流できる場。
- `admin_config/main.liveSession` から取得。`label`, `url`, `description` フィールド。
- `url` が設定されている場合: 緑のパルスドット + 「LIVE」バッジ + 「Join」ボタン（外部Zoomリンク）。
- `url` が未設定の場合: グレーのドット + 「Next session TBD」。

#### 公式グループ（Official Groups）
- 各フォーカスモードごとに1つの公式グループが存在（`isOfficial: true`）。
- ユーザーのメインモード変更時に自動参加/退出。
- 公式グループはメンバー上限なし。

#### ユーザー作成グループ
- **参加条件**: **Lv.2以上**。
- **作成条件**: **Lv.2以上**。
- **グループスロット制**: レベルに応じて所属可能なコミュニティ数が増加。

| レベル | 最大コミュニティ数 |
|---|---|
| Lv.2 | 1 |
| Lv.3 | 2 |
| Lv.5 | 3 |
| Lv.8 | 4 |

- **リーダー制限**: 1ユーザーにつきリーダーになれるグループは1つまで。
- **グループ作成**: グループ名（30文字以内、重複不可）+ フォーカスモード選択 + アイコン画像（任意）+ グループ目標（任意）。
- **最大人数**: **12名**（`MAX_GROUP_MEMBERS = 12`）。満員時は「FULL」バッジ表示。
- **joinType**: `open`（誰でも参加可）or `friends`（招待制）。リーダーが設定可能。
- **参加**: 即参加（openの場合）。
- **退出**: 自由に退出可能。メンバーが0になったグループは自動クローズ。
- **キック**: リーダーのみ可能。
- **リーダー退出時**: 確認ダイアログ → `isClosed: true` に更新。

#### グループチャット (`/groups/[groupId]`)
- リアルタイム (`onSnapshot`) テキストメッセージ。100文字以内。
- Enterキーで送信可能。
- **リアクション**: メッセージごとのハートリアクション（Map形式）。
- **メッセージ編集/取消**: 送信者は `text`, `edited`, `unsent` フィールドを更新可能。取消時はテキスト長制約を免除。
- **既読管理**: `lastRead/{userId}` サブコレクションで各ユーザーの最終読み取り時刻を記録。
- **最終メッセージプレビュー**: グループ一覧にて `lastMessageText` / `lastMessageBy` を表示。

---

### 6.6 MY PAGE画面

**ルート**: `/mypage`

- **Instagram風中央レイアウト**: アバター（80px）→ 名前 → モード+地域タグ → ゴール → 統計（Likes/Streak/Following）→ 所属グループ（ProfileGroupsコンポーネント、プリセット+ユーザー作成）を縦に中央配置。
- **設定ボタン**: 右上に歯車アイコン → `/settings` へ遷移。
- **フォロー中リスト**: FollowingModal でフルスクリーン表示（最大50件）。右スワイプで閉じる。
- **モードフィルター**: ModeFilterBar コンポーネント。5モード + All。
- **投稿グリッド**: PostGrid コンポーネント。4列グリッドでサムネイル表示。Private投稿には鍵アイコン。
- **投稿詳細モーダル**: PostDetailModal コンポーネント。右スワイプで閉じる。

---

### 6.7 設定画面 (Settings)

**ルート**: `/settings`

- **プロフィール編集**: ニックネーム（半角英数字+_、15文字、重複不可）、滞在地域、目標（100文字）、メインモード、渡航予定日、プロフィール写真（丸型クロップ、512×512px）。
- **地域表示設定**: `showRegion` でプロフィールの地域表示ON/OFF。
- **フェーズ切り替え**: ステータスを手動変更。confirm確認ダイアログ付き。
- **通報機能**: 対象ユーザーID + 理由 + スクリーンショット画像。
- **通知設定**: 3つのトグル（いいね通知、グループメッセージ通知、ストリーク警告通知）。
- **法定項目**: プライバシーポリシー、利用規約、法的通知（Firestoreの `legal_docs` コレクションから取得、フォールバック付き）。
- **アカウント管理**: ログアウト（confirm付き）、アカウント削除（confirm付き + 再認証）。

### 地域選択肢（REGIONS）
Sydney, Melbourne, Brisbane, Perth, Adelaide, Gold Coast, Canberra, Cairns, Darwin, Hobart, Japan, Other

---

### 6.8 マイルストーン演出

D+30, D+100, D+200, D+365 に **Framer Motion を用いた全画面祝祭アニメーション** を表示。
- `localStorage` に `milestone_{N}_shown` フラグを保存し、1回のみ表示。
- Spring アニメーション + confetti風パーティクル。

---

### 6.9 通報・ブロック・モデレーション機能

#### 投稿レベルの通報
- 投稿カードの「···」メニューから「Report」。
- `posts/{postId}/reports/{reporterId}` に記録（1ユーザー1回のみ）。
- **自動非表示**: `reportCount` が **3以上** → `visibility: "private"` + `reportRestricted: true` に更新。

#### ユーザーレベルの通報
- 設定画面から対象ユーザーIDと理由 + スクリーンショット画像を送信。
- `reports` コレクションに記録。

#### ブロック
- 投稿カードの「···」メニューから「Block」。
- `users/{uid}/private/config.blockedUsers` に追加。
- EXPLORE で非表示（クライアント側フィルタ）。
- 解除（unblock）機能あり。

#### 禁止語句フィルター
- `moderation_config/main.bannedWords` をキャッシュ。
- 投稿前にクライアント側で照合。

---

### 6.10 フォロー機能

- **フォロー/アンフォロー**: EXPLORE の投稿カード、または公開プロフィールからトグル。
- **楽観的UI更新**: 即座にUI反映。失敗時はロールバック。
- **データ構造**: `users/{uid}/following/{targetUid}` サブコレクション。
- **キャッシュ**: 最大200件のフォローIDをAuthContextでキャッシュ。
- **フォロー優先表示**: EXPLOREでスコア +50pt。
- **フォロワー非表示**: 意図的にフォロワー数/一覧は表示しない（SNS依存防止）。
- **アカウント削除時**: following サブコレクション全削除。

---

### 6.11 公開プロフィール画面

**ルート**: `/user/[uid]`

- **Instagram風中央レイアウト**: アバター（96px）→ 名前 → モード+地域タグ → ゴール → 統計 → 所属グループ。
- 公開（public）かつアクティブ（active）な投稿を4列グリッドで表示。モードフィルター付き。
- **フォロー/アンフォロー**: 楽観的UI更新。
- **ブロック/アンブロック**: トグル操作。
- **投稿詳細モーダル**: 右スワイプで閉じる。

---

## 7. UI/UXデザイン

### テーマカラー

| 名前 | コード | 意味 |
|---|---|---|
| Aussie Gold | `#FFB800` | 太陽、喜び、Fun |
| Ocean Blue | `#0077BE` | 海、成長、Growth |
| Outback Clay | `#B85C38` | 赤土、情熱 |
| Sand Beige | `#F5F5DC` | 背景（シェル外側） |
| Accent Orange | — | 主要アクセントカラー（ボタン、オンボーディング） |

### テキストなし投稿のグラデーション（5種）

| モード | グラデーション |
|---|---|
| english | `from-blue-500 to-cyan-400` |
| skill | `from-violet-500 to-purple-400` |
| challenge (Challenge) | `from-emerald-500 to-teal-400` |
| work | `from-orange-500 to-amber-400` |
| chill | `from-stone-400 to-warm-gray-400` |

### フッターナビゲーション（5タブ）

固定フッター（`fixed bottom-0`、`max-w-[450px]` で中央配置、`h-10`）。背景: `bg-forest/95 backdrop-blur-md`（ダークグリーン半透明）。

| タブ | ルート | アイコン | アクティブ色 | 非アクティブ色 |
|---|---|---|---|---|
| HOME | `/home` | IconHome（SVG） | `text-accent-orange` | `text-white/40` |
| EXPLORE | `/explore` | IconDiary（SVG） | `text-accent-orange` | `text-white/40` |
| POST | `/post` | IconCamera（SVG） | **中央配置・フローティング（-mt-4）** `w-10 h-10` 丸、`bg-gradient-to-br from-accent-orange-light to-accent-orange` | 同左 |
| GROUPS | `/groups` | IconGroup（SVG） | `text-accent-orange` + 未読バッジ（赤） | `text-white/40` |
| MY PAGE | `/mypage` | ユーザーのプロフィール写真（26px） | `ring-2 ring-accent-orange` | 枠線なし |

- POSTボタンはタップでファイルピッカーを開き、画像選択後に投稿画面へ遷移。キャンセル時も投稿画面へ遷移（画像なし投稿）。
- GROUPSには未読メッセージ数バッジ（赤、99+上限）。

### 共通UIパターン
- ローディング: カンガルーアイコン7匹が円軌道を自転+公転するアニメーション（LoadingSpinner）。
- カード: `rounded-2xl shadow-sm border border-gray-100`
- ボタン（プライマリ）: `bg-accent-orange text-white font-bold rounded-2xl`
- 確認ダイアログ: `ConfirmModal` コンポーネント
- XPトースト: `XPToast`（1.2秒表示後自動消去）
- レベルアップ演出: `LevelUpAnimation`（フルスクリーン）
- **右スワイプで閉じる**: `useSwipeDismiss` フック。GPU加速。しきい値80px。
- **いいねアニメーション**: タップ位置にカンガルーが跳ねるアニメーション。

---

## 8. Firestore データベース構造

### `users` コレクション

| フィールド | 型 | 説明 |
|---|---|---|
| uid | string | ユーザーID |
| displayName | string | ニックネーム（15文字以内） |
| displayNameLower | string | 検索用小文字版 |
| photoURL | string | プロフィール画像URL |
| status | string | `pre-departure` / `in-australia` / `post-return` |
| totalXP | number | 累計XP |
| currentStreak | number | 連続投稿日数 |
| lastPostAt | string | 最終投稿日時（ISO 8601） |
| departureDate | string | 渡航予定日 `YYYY-MM-DD` |
| returnStartDate | string | 帰国開始日 `YYYY-MM-DD` |
| mainMode | string | メインフォーカスモード |
| region | string | 滞在地域 |
| showRegion | boolean | 地域表示ON/OFF |
| goal | string | 目標（100文字以内） |
| isPro | boolean | サブスクリプション状態（将来用） |
| dailyLikeCount | number | 当日のいいね送信数 |
| lastLikeDate | string | 最終いいね送信日 `YYYY-MM-DD` |
| weeklyGoal | number | 週間投稿目標 |
| weekStreak | number | 週間チャレンジ連続達成数 |
| lastCompletedWeekStart | string | 最終完了週の開始日 |
| groupIds | array | 所属グループIDの配列 |
| createdAt | timestamp | アカウント作成日時 |

### `users/{uid}/private/config`

| フィールド | 型 | 説明 |
|---|---|---|
| blockedUsers | array | ブロックしたユーザーUID配列 |
| fcmToken | string | FCMプッシュ通知トークン |
| notificationPrefs | map | `{ likes, groupMessage, streakWarning }` |

### `users/{uid}/following` サブコレクション

| フィールド | 型 | 説明 |
|---|---|---|
| （ドキュメントID = フォロー先UID） | — | — |
| createdAt | timestamp | フォロー日時 |

### `posts` コレクション

| フィールド | 型 | 説明 |
|---|---|---|
| id | string | 投稿ID |
| userId | string | 投稿者UID |
| mode | string | フォーカスモード |
| imageUrl | string | 画像URL（空文字 = テキストのみ） |
| content | string | 投稿テキスト（400文字以内） |
| phase | string | 投稿時のフェーズ |
| dayNumber | number | D+/D-数値（オーバーライド可） |
| likeCount | number | いいね数 |
| visibility | string | `public` / `private` |
| status | string | `active` / `hidden` / `pending` |
| reportCount | number | 通報数 |
| reportRestricted | boolean | 通報による制限フラグ |
| tags | string[] | ハッシュタグ（最大5個） |
| region | string | 投稿時の地域（任意） |
| createdAt | timestamp | 投稿日時 |
| editableUntil | timestamp | 編集可能期限（5分後） |

### `posts/{postId}/likes` サブコレクション

| フィールド | 型 | 説明 |
|---|---|---|
| userId | string | いいねしたユーザーUID |
| createdAt | timestamp | いいね日時 |

### `posts/{postId}/reports` サブコレクション

| フィールド | 型 | 説明 |
|---|---|---|
| reason | string | 通報理由 |
| createdAt | timestamp | 通報日時 |

### `groups` コレクション

| フィールド | 型 | 説明 |
|---|---|---|
| id | string | グループID |
| mode | string | フォーカスモード |
| groupName | string | グループ名（30文字以内） |
| creatorId | string | リーダーUID |
| memberIds | array | メンバーUID配列 |
| memberCount | number | 参加人数 |
| isOfficial | boolean | 公式グループフラグ |
| iconUrl | string | アイコンURL（任意） |
| goal | string | グループ目標（任意） |
| isClosed | boolean | クローズ済みフラグ |
| joinType | string | `open` / `friends` |
| lastMessageAt | timestamp | 最終メッセージ日時 |
| lastMessageText | string | 最終メッセージテキスト |
| lastMessageBy | string | 最終メッセージ送信者UID |
| createdAt | timestamp | 作成日時 |

### `groups/{groupId}/messages` サブコレクション

| フィールド | 型 | 説明 |
|---|---|---|
| senderId | string | 送信者UID |
| text | string | メッセージ本文（100文字以内） |
| createdAt | timestamp | 送信日時 |
| reactions | map | `{ userId: true }` 形式 |
| edited | boolean | 編集済みフラグ |
| unsent | boolean | 取消フラグ |

### `groups/{groupId}/lastRead` サブコレクション

| フィールド | 型 | 説明 |
|---|---|---|
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
| bannerImageUrl | string | バナー画像URL |
| liveSession | map | `{ label, url, description }` |
| announcements | array | `{ title, body?, type, linkUrl?, linkLabel?, active }` |

### その他コレクション
- `banners`: 運営バナー情報（読み取り専用）
- `moderation_config/main`: `bannedWords` 配列
- `legal_docs/{docId}`: Terms, Privacy, Legal Notice（`content` フィールドにHTML）

---

## 9. Firestore セキュリティルール

### Users
- **読み取り**: 認証済みユーザーは全ユーザーを読み取り可。
- **作成・削除**: 本人のみ。
- **更新（本人）**: ホワイトリスト制。`isPro`, `createdAt`, `uid` は不変。
- **更新（他人）**: `totalXP` のみ（いいねXP用、+5固定のインクリメントのみ許可）。

### Users > Private
- 読み取り・作成・更新すべて本人のみ。

### Users > Following
- 読み取り: **本人のみ**。作成・削除: 本人のみ。

### Posts
- **読み取り**: 自分の投稿は常に閲覧可。他人の投稿は `status == "active"` かつ `visibility == "public"` のみ。
- **作成**: 認証済み + 各種バリデーション。
- **更新（作成者）**: 画像URL設定、または5分以内のテキスト・モード編集。
- **更新（いいね）**: `likeCount` の +1/-1 のみ。
- **更新（通報）**: `reportCount` +1、3件以上で自動非表示。
- **削除**: 作成者本人のみ。

### Groups
- **参加**: 未メンバーが自身を追加。公式グループは上限なし、ユーザー作成は12名まで。
- **リーダー操作**: 設定変更、キック、クローズ、joinType変更。
- **メッセージ**: メンバーのみ。送信者は編集・取消可能。

---

## 10. アカウント削除時の処理

1. 全 `posts` をバッチ削除（最大500件）
2. Storage: `posts/{userId}/` 全画像削除
3. Storage: `avatars/{userId}.jpg` 削除
4. 全 `groups` からメンバー除去（リーダーの場合はクローズ）
5. `following` サブコレクション全削除
6. `private/config` 削除
7. `users` ドキュメント削除
8. Google再認証 → Firebase Auth 削除

---

## 11. 文字数制限まとめ

| フィールド | 上限 |
|---|---|
| ニックネーム | 15文字（半角英数字+_のみ） |
| 投稿テキスト | 400文字（ASCII文字のみ） |
| 目標 (Goal) | 100文字 |
| グループメッセージ | 100文字 |
| グループ名 | 30文字 |
| ハッシュタグ | 最大5個/投稿 |

---

## 12. 画像処理仕様

| パラメータ | 値 |
|---|---|
| 最大サイズ | 1024px |
| 最大ファイルサイズ | 300KB |
| 初期JPEG品質 | 0.85 |
| 最低JPEG品質 | 0.6 |

Canvas を通すことで EXIF メタデータを自動除去。

| 用途 | 出力サイズ | 保存先 |
|---|---|---|
| 投稿画像 | 1024×1024px（1:1クロップ） | `posts/{userId}/{postId}.jpg` |
| アバター | 512×512px（丸型クロップ） | `avatars/{userId}.jpg` |
| グループアイコン | — | `groups/{groupId}.jpg` |
| 通報スクリーンショット | 最大1024px | `reports/{reporterId}_{timestamp}.jpg` |

---

## 13. Cloud Functions（全7つ、デプロイ済み）

| 関数名 | トリガー | 機能 |
|---|---|---|
| `moderatePost` | `onDocumentCreated("posts/{postId}")` | 投稿自動モデレーション。禁止語句チェック + 毒性スコア。該当時は `status: "hidden"`。 |
| `checkReportThreshold` | `onDocumentCreated("posts/{postId}/reports/{reporterId}")` | 通報3件で自動非表示。管理者メール（1件目+3件目のみ）。`ADMIN_EMAIL` シークレット。 |
| `onLikeCreated` | `onDocumentCreated("posts/{postId}/likes/{likerId}")` | いいねFCM通知。自己いいねスキップ。60秒クールダウン。 |
| `checkStreaks` | `onSchedule("every 1 hours")` | 48時間超過でリセット。42時間で警告通知。 |
| `cleanupHiddenPosts` | `onSchedule("every day 03:00")` | 非表示投稿の30日後自動削除（100件/回）。 |
| `onGroupMessageCreated` | `onDocumentCreated("groups/{groupId}/messages/{messageId}")` | グループメッセージFCM通知。10秒クールダウン。 |
| `syncGroupMembership` | `onDocumentUpdated("groups/{groupId}")` | キック/退出時の `groupIds` 同期。 |

---

## 14. ファイル構成

```
src/
├── app/
│   ├── layout.tsx              # ルートレイアウト（AuthProvider、450pxシェル）
│   ├── page.tsx                # ルートリダイレクト
│   ├── loading.tsx             # ルートローディング（カンガルースピナー）
│   ├── error.tsx               # ルートエラー画面
│   ├── opengraph-image.tsx     # OG画像動的生成
│   ├── globals.css             # Tailwind v4 + テーマカラー定義
│   ├── login/page.tsx          # ログイン画面
│   ├── onboarding/page.tsx     # オンボーディング画面（6ステップ）
│   ├── home/page.tsx           # HOME画面
│   ├── explore/page.tsx        # EXPLORE画面
│   ├── post/
│   │   ├── page.tsx            # 投稿画面
│   │   └── edit/[postId]/page.tsx  # 投稿編集画面
│   ├── groups/
│   │   ├── page.tsx            # グループ一覧
│   │   ├── create/page.tsx     # グループ作成
│   │   └── [groupId]/page.tsx  # グループチャット
│   ├── mypage/page.tsx         # マイページ
│   ├── settings/page.tsx       # 設定画面
│   └── user/[uid]/page.tsx     # 公開プロフィール
├── components/
│   ├── Avatar.tsx
│   ├── PostCard.tsx
│   ├── WeeklyChallenge.tsx
│   ├── WeeklyHistoryModal.tsx
│   ├── ImageCropper.tsx
│   ├── MilestoneAnimation.tsx
│   ├── LevelUpAnimation.tsx
│   ├── XPToast.tsx
│   ├── LoadingSpinner.tsx
│   ├── ConfirmModal.tsx
│   ├── LegalModals.tsx
│   ├── ForegroundNotification.tsx
│   ├── NotificationToast.tsx
│   ├── BannerCarousel.tsx
│   ├── PWAInstallBanner.tsx
│   ├── PostDetailModal.tsx
│   ├── PostGrid.tsx
│   ├── ModeFilterBar.tsx
│   ├── FollowingModal.tsx
│   ├── ProfileGroups.tsx
│   ├── AsciiWarn.tsx
│   ├── GroupCard.tsx
│   ├── icons/index.tsx
│   └── layout/
│       └── BottomNav.tsx
├── contexts/
│   └── AuthContext.tsx
├── hooks/
│   ├── useAuthGuard.ts
│   ├── useSwipeDismiss.ts
│   ├── useAsciiInput.ts
│   ├── useDayCount.ts
│   └── useUnreadGroups.ts
├── lib/
│   ├── firebase.ts
│   ├── auth.ts
│   ├── utils.ts
│   ├── constants.ts
│   ├── validators.ts
│   ├── feedScore.ts
│   ├── follow.ts
│   ├── groups.ts
│   ├── postUtils.ts
│   ├── fcm.ts
│   ├── imageUtils.ts
│   └── services/
│       ├── posts.ts
│       └── users.ts
└── types/
    ├── index.ts
    └── next-pwa.d.ts

firestore.rules
next.config.ts
sentry.client.config.ts
sentry.server.config.ts
sentry.edge.config.ts
functions/src/index.ts          # Cloud Functions（全7つ）
public/
├── manifest.json
├── robots.txt
├── sitemap.xml
├── firebase-messaging-sw.js
├── offline.html
└── icons/
```

---

## 15. 未実装・将来対応項目

| 項目 | ステータス | 備考 |
|---|---|---|
| フォロー通知 | 未実装 | — |
| Stripeサブスクリプション | 未実装 | `isPro` フィールドのみ用意済み |
| App Check の Firestore 強制適用 | 未有効化 | reCAPTCHA Enterprise トークン取得問題 |
| CSP（Content-Security-Policy） | 未適用 | report-onlyモードでの検証が必要 |

---

## 変更履歴

| バージョン | 日付 | 内容 |
|---|---|---|
| v2 Final | — | 最終確定仕様書 |
| v3 | 2025-03-10 | Phase 1〜9 実装完了。 |
| v3 改訂5 | 2026-03-27 | セキュリティ監査・強化、パフォーマンス改善。 |
| **v4** | **2026-03-28** | **実装準拠で全面書き直し。主な差分**: フォーカスモード5種リネーム（English/Skill/Challenge/Work/Chill）+ レガシーマッピング。XP計算式変更（除数6、POST_XP=10、LIKE_SEND_XP=3、LIKE_RECEIVE_XP=5、初投稿ボーナス廃止）。グループ参加/作成条件をLv.2に緩和 + スロット段階制（Lv.2→1枠〜Lv.8→4枠）。グループ最大人数10→12名。ハッシュタグシステム新設（最大5個/投稿、モード別候補）。投稿に地域タグ・日数オーバーライド機能追加。オンボーディングを1画面→6ステップ制に刷新。グループjoinType（open/friends）追加。メッセージ編集/取消機能追加。`reportRestricted` フラグ追加。`showRegion` / `displayNameLower` フィールド追加。グラデーション全5色刷新。ルート構成更新（`(auth)` route group廃止）。コンポーネント一覧・hooks一覧を最新化。 |
