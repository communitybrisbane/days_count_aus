# Days Count in AUS — 開発仕様書 (SPEC v4)

> **正式名称**: Days Count in AUS
> **通称（アイコン下表示）**: days count
> **コンセプト**: 「Make Days Count」ー ワーホリ365日で人生変える。
> **ターゲット**: ワーホリ渡航前・滞在中・帰国後の全フェーズのユーザー

---

## 1. 技術スタック

| カテゴリ | 技術 |
|---|---|
| Frontend | Next.js 16.2.2 (App Router) + TypeScript |
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
  "next": "16.2.2",
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
- **PWAインストールバナー**: モバイル端末（iOS/Android UA判定）の未インストールユーザーにのみ毎回表示（z-[200]で最前面）。PCでは非表示。iOS向けはビジュアルステップガイド（Step 1: Share → Step 2: Add to Home Screen → Step 3: Add）をSVGアイコン+アニメーション矢印で案内。Android向けは `beforeinstallprompt` ネイティブプロンプト使用。
- **オフラインフォールバック**: Service Worker が `offline.html` をキャッシュ。ナビゲーション失敗時にブランドデザインの「You're Offline」ページ（Retryボタン付き）を表示。
- **OG画像**: `opengraph-image.png`（静的画像、1200×630px）。
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

## 4. 3つのフォーカスモード

> 2026-07-02: Work / Chill モードを廃止して3モードに統合。既存の work / chill データはレガシーマッピングで challenge に読み替え。

| モード | ID | ラベル | 説明 | ハッシュタグ例 |
|---|---|---|---|---|
| English | `english` | English | IELTS, speaking, language exchange | #english, #ielts, #speaking, #slang |
| Skill | `skill` | Skill | Coding, AI, SNS, portfolio | #skill, #coding, #design, #freelance |
| Challenge | `challenge` | Challenge | Road trips, farm, beach, new cities | #challenge, #travel, #roadtrip, #farm |

### レガシーモードマッピング
旧モードIDからの自動変換（`LEGACY_MODE_MAP`）。正式IDは `english` / `skill` / `challenge`:
- `enjoying` / `challenging` / `adventure` → `challenge`
- `skills` → `skill`
- `social-media` / `daily` / `work` / `chill` → `challenge`

### マイページでのフィルタリング
- Fun/Growth分類はなし。ModeFilterBarで3モード + All のフィルタリングのみ。

### ハッシュタグシステム
- ハッシュタグはカスタムタグのみ（モード別候補機能は廃止）。
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
| いいねをもらう（受信） | +5 | **XP付与は1日10回まで**（Cloud Function `onLikeCreated` がサーバー側で付与・カウント。自己いいねではXP付与なし。いいね自体は無制限） |
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
- **他人の投稿にいいね**: 送信者 +3XP（1日5回まで、クライアント付与）、受信者 +5XP（1日10回まで、サーバー付与。`dailyLikeReceivedCount` / `lastLikeReceivedDate` で管理）。
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
| 4 | フォーカスモード選択（3つから1つ） | 必須 |
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
- **週間ゴールカード**: ヘッダーに重なるカード。WeeklyChallenge コンポーネント（週間投稿進捗バー7本、冠位十二階ランクカラー、日次ストリーク表示、weekStreakボーナス表示（+N/post）、週の期間 "Mar. 18 – Mar. 24" 表示）。7投稿達成時は「WEEKLY COMPLETE」バッジ + ゴールド演出。週間チャレンジ継続条件は **週5日以上**（ユニーク日数）。
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
- **フィードアルゴリズム** (`feedScore.ts`): クライアント側でスコア計算（Instagram型のシグナル設計）。
  - **アフィニティ**: フォロー中 +25pt、著者インタラクション履歴（対数スケール、最大+20pt）
  - **興味**: 同じメインモード +10pt、同じ地域 +8pt、タグアフィニティ（対数スケール、最大+15pt）
  - **エンゲージメント速度**: `likeCount / (経過時間+2)^1.2` ベースの時間減衰いいね速度（最大+20pt）
  - **新しさ**: `15 × exp(-経過時間/48h)` の指数減衰（新規約+15pt → 2日で約+5pt）
  - **既読ペナルティ**: -40pt
  - **発見ボーナス**: 未フォロー & 未インタラクション著者に+3pt
  - **日替わりジッター**: 投稿ID+日付の決定的ハッシュで0〜5pt（同日内は安定、日ごとに変化）
  - 検索モード・Popularタブではスコアリングをスキップ。
- **ポストパス処理**: ①著者分散（直前2枠と同じ著者を避ける）、②新規投稿の露出枠（6枠ごとに未読・24時間以内・いいね2以下の投稿を昇格 — コールドスタート対策）。
- **インタラクション履歴**: いいね（重み3）・詳細閲覧（重み1）を `localStorage` に記録（最大300件、30日TTL、半減期14日の指数減衰）。著者・タグ別のアフィニティ構築に使用。
- **既読追跡（インプレッションベース）**: IntersectionObserver でグリッドセルが50%表示された時点で記録（取得時ではない）。`localStorage` に投稿IDを保存（最大500件、3日間TTL、初回表示時刻を保持）。
- **無限スクロール**: `limit(20)` + `startAfter` で20件ずつ追加読み込み。ランキングフィードの初回ページのみ候補プール60件を取得して並べ替え。
- **フィルタ**: 上部に固定ヘッダーで3モードフィルタ + All。（旧Popularソートタブは2026-07-02に廃止。エンゲージメント速度シグナルがスコアに含まれるためNewに一本化）
- **検索**: ユーザー名・地域・#タグでのデバウンス検索（400ms）。500ユーザーまでスキャン。初回検索時にキャッシュ。スコアリングは非検索時のみ適用。
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

- **モード選択**: 3つのフォーカスモードからpill型ボタンで1つ選択（必須）。デフォルトはプロフィールのメインモード。
- **公開設定**: Public / Private のトグル。
- **画像（任意）**: タップで画像選択 → react-easy-crop で1:1クロップ → Canvas APIで1024×1024pxにリサイズ（JPEG品質85%、最大300KB） → EXIF自動除去。
- **地域選択（任意）**: 投稿に地域タグを付与。デフォルトはプロフィールの地域。
- **日数オーバーライド（任意）**: 日付ピッカーでカスタムD+数値を設定可能。
- **ハッシュタグ**: カスタムタグ作成のみ。最大5個。
- **テキスト入力**: 400文字以内（ASCII文字 + 絵文字のみ、リアルタイム文字数カウント）。
- **禁止語句チェック**: 投稿前にクライアント側で照合。該当時は投稿ブロック。

**投稿制限**: 1日複数回投稿可能。ただしXP付与は1日3回まで（`POST_XP_DAILY_MAX = 3`）。週間段階制XPは1日1回分のみ加算（`lastPostAt` で当日判定）。

**画像保存先**: `posts/{userId}/{postId}.jpg`

**画像なし投稿**: フォーカスモード対応グラデーション背景にテキスト中央寄せのカードデザイン。

**XP付与**: 投稿完了時に +10XP（週間段階制で追加XP）。レベルアップ時は LevelUpAnimation を表示。

**ストリーク更新**: 最終投稿日が昨日なら `currentStreak + 1`、今日なら維持、それ以前なら `1` にリセット。

**投稿の編集** (`/post/edit/[postId]`): 本人はいつでも編集可能（**時間制限なし**、2026-04-02に5分制限を撤廃）。テキスト・モード・タグ・地域・公開範囲・日数を編集可（画像変更のみ不可）。`editableUntil` フィールドは作成時に書き込まれるが編集制限には未使用（レガシー）。

**投稿の削除**: いつでも可能（本人のみ、confirm確認付き）。

---

### 6.5 GROUPS画面（フォーカスグループ）

**ルート**: `/groups`, `/groups/create`, `/groups/[groupId]`

#### ライブミーティング（Live Meetings）
- GROUPSタブ最上部の「Live Meetings」セクション。**運営パスワードを知っている人なら誰でもアプリ内から開催できる**（2026-07-04 に旧 24時間 Study Room / `admin_config.meeting*` フラットフィールドから置き換え）。
- **データ**: `meetings` コレクション（`title`・`hostName`・`hostUid`・`mode`・`url`・`joinType`・`active`・`createdAt`）。書き込みはルールで全面禁止、`manageMeeting` Cloud Function（callable）経由のみ。
- **開催**: 「+ Host」→ フォーム（パスワード / タイトル30字 / モード / httpsリンク / 公開範囲）→ `manageMeeting(action: "create")`。パスワードは Functions シークレット `MEETING_PASSWORD` でサーバー照合。開催者名はアカウントの displayName 固定（編集不可）。**同一アカウントの同時開催は1件まで**（未終了・未失効のミーティングがあると新規開催はエラー）。
- **公開範囲（joinType）**: `open`（誰でも参加可）or `friends`（鍵アイコン表示。タップ時に「知り合い向け」確認モーダルを挟んでからリンクを開く）。ホストが開催時に選択。
- **終了**: ホスト本人のカードに「End」ボタン（パスワード再入力）。パスワード保持者は誰のミーティングでも終了可能（モデレーション用途）。加えて開催時に**開始時刻（Now or 毎正時）と終了時刻（次の24時間以内の毎正時）**を設定。開始前のカードはアンバーの「UPCOMING」バッジで開催予定として表示され、開始時刻を過ぎると緑の「LIVE」に切り替わる。`expiresAt` を過ぎたカードは自動で非表示（クライアント側で毎分再判定）。カードには「HH:MM–HH:MM」の時間帯を表示（閲覧者の登録地域のタイムゾーン、Sydneyフォールバック）。実際の会議の終了は遷移先のオンライン会議サービス上でホストが行う。
- **表示**: モード色グラデーションのカードに タイトル / Hosted by {開催者名} / LIVEバッジ / 鍵アイコン（friendsのみ）。複数同時開催時は**4秒ごとに自動スクロールするカルーセル**+ドットインジケータ。0件時は「No live meeting / Offline」プレースホルダー。

#### 公式グループ（Official Groups）
- 各フォーカスモードごとに1つのモードグループが存在（`isOfficial: true`）。カードに「by mode」表示。
- **参加は完全に任意**: オンボーディング時に選択したメインモードのグループへ初期参加するのみで、以後の出入りは自由。未参加のモードグループは検索（Find）に表示され、いつでも参加できる（レベル・スロット制限の対象外）。参加中のモードグループはチャット画面右上の「Leave」からいつでも退出できる。
- メインモード変更時にグループ所属は変更しない（自動入れ替えなし）。
- 公式グループはメンバー上限なし。「+ Find or Create」ボタンはレベル・スロットに関係なく常時表示（コミュニティ側の制限は参加時に適用）。
- グループは「公式（モード）グループ + ユーザー作成コミュニティ」の2種類のみ（旧・趣味グループ Hobby Groups は 2026-07-02 に全削除）。

#### ユーザー作成グループ
- **参加条件**: **Lv.2以上**。
- **作成条件**: **Lv.2以上**。
- **所属グループスロット制**: レベルに応じて所属できるコミュニティ数（自作・参加を問わず、ユーザー作成グループの合計）が増加。モードグループはスロット対象外。

| レベル | 最大コミュニティ数 |
|---|---|
| Lv.2 | 1 |
| Lv.3 | 2 |
| Lv.5 | 3（最大） |

- **リーダー制限**: 1ユーザーにつきリーダーになれるグループは1つまで。
- **グループ作成**: グループ名（30文字以内、重複不可）+ フォーカスモード選択 + アイコン画像（任意）+ グループ目標（任意）。
- **最大人数**: **12名**（`MAX_GROUP_MEMBERS = 12`）。満員時は「FULL」バッジ表示。
- **joinType**: `open`（誰でも参加可）or `friends`（招待制）。リーダーが設定可能。
- **参加**: 即参加（openの場合）。
- **退出**: 自由に退出可能。メンバーが0になったグループは自動クローズ。
- **キック**: リーダーのみ可能。キックされたユーザーは再参加不可（`kickedUserIds` で管理）。キック時に `users/{uid}/private/config.kickedFrom` に記録。
- **リーダー退出時**: リーダーが抜けるとグループは**解散（`isClosed: true`）**。移譲は廃止（2026-07-03）。他メンバーがいる場合は退出前に最後のメッセージを1通だけ送れる（任意。入力形式は通常チャットと同一: 100文字以内・ASCII+絵文字のみ・URL不可）。解散後は読み取り専用でメンバーが閲覧可能。
- **CLOSEDグループ**: チャット履歴は読み取り専用で閲覧可能。入力欄に「This group has been closed.」バナー表示。ヘッダーに赤い「Closed」バッジ。
- **friends参加確認**: `joinType: "friends"` のグループ参加時に確認モーダル表示（「This group is for people who know each other.」）。

#### グループチャット (`/groups/[groupId]`)
- リアルタイム (`onSnapshot`) テキストメッセージ。100文字以内（ASCII + 絵文字）。
- Enterキーで送信可能。
- **リアクション**: メッセージごとのハートリアクション（Map形式）。
- **メッセージ編集/取消**: 送信者は `text`, `edited`, `unsent` フィールドを更新可能。取消時はテキスト長制約を免除。
- **システムメッセージ**: 参加・退出・キック・グループクローズ時に自動生成（`senderId: "system"`）。中央配置のミュートグレー表示。FCM通知はスキップ。
- **既読管理**: `lastRead/{userId}` サブコレクションで各ユーザーの最終読み取り時刻を記録。
- **履歴の可視範囲**: 新規参加者は**参加時点以降のメッセージのみ**閲覧可能（参加時に `lastRead/{userId}.clearedAt` を設定。全参加経路: チャット画面join・検索カードjoin・オンボーディング自動join）。退会→再参加でもリセットされる。
- **最終メッセージプレビュー**: グループ一覧にて `lastMessageText` / `lastMessageBy` を表示。
- **スワイプで既読クリア**: グループカードを左スワイプ → 「Clear」ボタン表示 → タップで既読時刻を更新（未読バッジクリア）。
- **スワイプでミュート切替**: グループカードを右スワイプ → ミュートトグル表示。ミュート中はグループアイコンにミュートバッジ。`lastRead/{userId}` の `muted` フィールドに保存。

---

### 6.6 MY PAGE画面

**ルート**: `/mypage`

- **横並びヘッダーレイアウト**（2026-04-03刷新）: アバター（96px）を左、名前+Lvバッジ+統計（Likes/Streak/Following）を右に横並び配置。その下にモード+地域タグ → ゴール → 所属グループ（ProfileGroupsコンポーネント、プリセット+ユーザー作成）。※公開プロフィール（`/user/[uid]`）は従来どおり中央寄せレイアウト（§6.11）。
- **設定ボタン**: 右上に歯車アイコン → `/settings` へ遷移。
- **フォロー中リスト**: FollowingModal でフルスクリーン表示（最大50件）。右スワイプで閉じる。
- **モードフィルター**: ModeFilterBar コンポーネント。3モード + All。
- **投稿グリッド**: PostGrid コンポーネント。4列グリッドでサムネイル表示。Private投稿には鍵アイコン。
- **投稿詳細モーダル**: PostDetailModal コンポーネント。右スワイプで閉じる。

---

### 6.7 設定画面 (Settings)

**ルート**: `/settings`

- **プロフィール編集**: ニックネーム（半角英数字+_、15文字、重複不可）、滞在地域、目標（100文字）、メインモード、渡航予定日、プロフィール写真（丸型クロップ、512×512px）。
- **地域表示設定**: `showRegion` でプロフィールの地域表示ON/OFF。
- **フェーズ切り替え**: ステータスを手動変更。confirm確認ダイアログ付き。
- **通知設定**: 3つのトグル（いいね通知、グループメッセージ通知、ストリーク警告通知）をアコーディオンで表示。`users/{uid}/private/config.notificationPrefs` に保存（未設定はON扱い）。Cloud Functions（`onLikeCreated` / `onGroupMessageCreated` / `checkStreaks`）が送信前に各設定を確認。
- **ブロックユーザー管理**: ブロック済みユーザーの一覧表示 + アンブロック（アコーディオン）。
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
- **通報者から非表示**: 通報した投稿IDを `users/{uid}/private/config.reportedPosts` に追加。EXPLORE・ユーザープロフィールでクライアント側フィルタ。通報成功後1.5秒でリストから消える。
- **自動非表示**: `reportCount` が **3以上** → `visibility: "private"` + `reportRestricted: true` に更新。

#### ユーザーレベルの通報
- **公開プロフィール画面**（`/user/[uid]`）のアクションシート（Block / Report / Cancel）から通報。
- 理由テキスト（必須）+ スクリーンショット画像（必須）。
- `reports` コレクションに記録。管理者メール通知（スクリーンショットURL含む）。
- **自動アカウント制限**: 未解決の通報が **10件** に達すると `restricted: true` を自動設定。

#### アカウント制限（Restricted Mode）
- `restricted: true` 時の制限: 投稿・いいね・フォロー・メッセージ・リアクション・グループ参加/作成が不可。
- 画面上部に赤いバナー表示（`RestrictedBanner`）: 「This account has been restricted」+ サポート連絡案内。
- **制限解除時**: Cloud Function（`onRestrictionLifted`）が未解決の全通報を自動 `resolved: true` に更新。

#### ブロック
- 投稿カードの「···」メニュー or 公開プロフィールのアクションシートから「Block」。
- `users/{uid}/private/config.blockedUsers` に追加。
- **自動アンフォロー**: ブロック時に相互のフォロー関係を自動解除（Cloud Function）。
- **blockedBy同期**: `users/{targetUid}/blockedBy/{blockerId}` にマーカードキュメントを作成（逆引き用）。
- ブロックされたユーザーがプロフィールを見ると「This user is not available」表示。
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
- **アクションシート**: Block / Report / Cancel。ボトムナビ上に表示。
- **ブロック/アンブロック**: トグル操作。ブロックされたユーザーには「This user is not available」表示。
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

### テキストなし投稿のグラデーション（3種）

| モード | グラデーション |
|---|---|
| english | `from-blue-500 to-cyan-400` |
| skill | `from-violet-500 to-purple-400` |
| challenge (Challenge) | `from-emerald-500 to-teal-400` |

### フッターナビゲーション（5タブ）

固定フッター（`fixed bottom-0`、`max-w-[450px]` で中央配置、`h-10`）。背景: `bg-forest/95 backdrop-blur-md`（ダークグリーン半透明）。

| タブ | ルート | アイコン | アクティブ色 | 非アクティブ色 |
|---|---|---|---|---|
| HOME | `/home` | IconHome（SVG） | `text-accent-orange` | `text-white/40` |
| EXPLORE | `/explore` | IconDiary（SVG） | `text-accent-orange` | `text-white/40` |
| POST | `/post` | IconCamera（SVG） | **中央配置・フローティング（-mt-4）** `w-11 h-11` 丸、`bg-gradient-to-br from-accent-orange-light to-accent-orange` | 同左 |
| GROUPS | `/groups` | IconGroup（SVG） | `text-accent-orange` + 未読バッジ（赤） | `text-white/40` |
| MY PAGE | `/mypage` | ユーザーのプロフィール写真（30px） | `ring-2 ring-accent-orange` | 枠線なし |

- POSTボタンはタップで投稿画面へ遷移（ファイルピッカーは投稿画面内の画像エリアから開く）。
- GROUPSには未読メッセージ数バッジ（赤、99+上限）。

### 共通UIパターン
- ローディング: カンガルーアイコン7匹が円軌道を自転+公転するアニメーション（LoadingSpinner）。
- カード: `rounded-2xl shadow-sm border border-gray-100`
- ボタン（プライマリ）: `bg-accent-orange text-white font-bold rounded-2xl`
- 確認ダイアログ: `ConfirmModal` コンポーネント
- XPトースト: `XPToast`（1.2秒表示後自動消去）
- レベルアップ演出: `LevelUpAnimation`（フルスクリーン）— 投稿時・いいね受信時のいずれでもレベルアップ判定
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
| streakWarningSent | number | ストリーク警告通知の送信済みフラグ（Cloud Function `checkStreaks` が書き込み） |
| lastPostAt | string | 最終投稿日時（ISO 8601） |
| departureDate | string | 渡航予定日 `YYYY-MM-DD` |
| returnStartDate | string | 帰国開始日 `YYYY-MM-DD` |
| mainMode | string | メインフォーカスモード |
| region | string | 滞在地域 |
| showRegion | boolean | 地域表示ON/OFF |
| goal | string | 目標（100文字以内） |
| isPro | boolean | サブスクリプション状態（将来用） |
| restricted | boolean | アカウント制限フラグ（通報10件で自動設定、クライアント不変） |
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
| reportedPosts | array | 通報した投稿ID配列（通報者から非表示用） |
| kickedFrom | array | キックされたグループ情報 `[{ groupId, groupName, at }]` |
| fcmToken | string | FCMプッシュ通知トークン |
| notificationPrefs | map | `{ likes, groupMessage, streakWarning }` |

### `users/{uid}/blockedBy` サブコレクション

| フィールド | 型 | 説明 |
|---|---|---|
| （ドキュメントID = ブロックしたユーザーUID） | — | — |
| createdAt | timestamp | ブロック日時 |

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
| editableUntil | timestamp | レガシー: 作成時に5分後で書き込まれるが編集制限には未使用 |

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
| kickedUserIds | array | キックされたユーザーUID配列（再参加防止） |
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
| ~~meetingLabel / meetingUrl / meetingDescription~~ | string | 廃止（2026-07-04、`meetings` コレクションに移行） |
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
- **更新（本人）**: ホワイトリスト制。`isPro`, `restricted`, `createdAt`, `uid` は不変。
- **更新（他人）**: `totalXP` のみ（いいねXP用、+5固定のインクリメントのみ許可）。

### Users > Private
- 読み取り・作成・更新すべて本人のみ。

### Users > Following
- 読み取り: **本人のみ**。作成・削除: 本人のみ。

### Users > BlockedBy
- 読み取り: 認証済みユーザー。作成・削除: Cloud Functionsのみ（Admin SDK）。

### Posts
- **読み取り**: 自分の投稿は常に閲覧可。他人の投稿は `status == "active"` かつ `visibility == "public"` のみ。
- **作成**: 認証済み + 各種バリデーション。
- **更新（作成者）**: 画像URL設定、またはテキスト・モード・タグ・地域・公開範囲・日数の編集（時間制限なし）。
- **更新（いいね）**: `likeCount` の +1/-1 のみ。
- **更新（通報）**: `reportCount` +1、3件以上で自動非表示。
- **削除**: 作成者本人のみ。

### Groups
- **参加**: 未メンバーが自身を追加。公式グループは上限なし、ユーザー作成は12名まで。キック済みユーザーは再参加不可。
- **リーダー操作**: 設定変更、キック、クローズ、joinType変更。
- **メッセージ**: メンバーのみ + システムメッセージ（`senderId: "system"`）。送信者は編集・取消・削除可能（削除はアカウント削除時のクリーンアップ用）。

---

## 10. アカウント削除時の処理

1. Google再認証（削除操作の最初に実施）
2. 全 `posts` をバッチ削除（500件ずつループ）
3. Storage: `posts/{userId}/` 全画像削除
4. Storage: `avatars/{userId}.jpg` 削除
5. 自分が他人の投稿に付けた `likes` を削除 + 各投稿の `likeCount` をデクリメント
6. 全 `groups` から: 自分のメッセージ削除（退出前に実行）→ メンバー除去（ユーザー作成グループのリーダーの場合はクローズ、公式グループは退出のみ）→ `lastRead` 削除
7. `following` サブコレクション全削除
8. `private/config` 削除
9. `users` ドキュメント削除
10. Firebase Auth ユーザー削除

---

## 11. 文字数制限まとめ

| フィールド | 上限 |
|---|---|
| ニックネーム | 15文字（半角英数字+_のみ） |
| 投稿テキスト | 400文字（ASCII文字 + 絵文字） |
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

## 13. Cloud Functions（全10個、デプロイ済み）

| 関数名 | トリガー | 機能 |
|---|---|---|
| `moderatePost` | `onDocumentCreated("posts/{postId}")` | 投稿自動モデレーション。禁止語句チェック + 毒性スコア。該当時は `status: "hidden"`。 |
| `checkReportThreshold` | `onDocumentCreated("posts/{postId}/reports/{reporterId}")` | 通報3件で自動非表示。管理者メール（1〜3件目すべて）。`ADMIN_EMAIL` シークレット。 |
| `onLikeCreated` | `onDocumentCreated("posts/{postId}/likes/{likerId}")` | いいねFCM通知。自己いいねスキップ。60秒クールダウン。 |
| `checkStreaks` | `onSchedule("every 1 hours")` | カレンダー日ベース: 最終投稿が一昨日以前ならリセット。警告通知はユーザーのローカル時刻20:00と23:00に送信（`streakWarningSent` で重複防止）。 |
| `cleanupHiddenPosts` | `onSchedule("every day 03:00")` | 非表示投稿の30日後自動削除（100件/回）。 |
| `onGroupMessageCreated` | `onDocumentCreated("groups/{groupId}/messages/{messageId}")` | グループメッセージFCM通知。システムメッセージはスキップ。10秒クールダウン。 |
| `syncGroupMembership` | `onDocumentUpdated("groups/{groupId}")` | キック/退出時の `groupIds` 同期 + `kickedFrom` 記録。 |
| `onUserReportCreated` | `onDocumentCreated("reports/{reportId}")` | ユーザー通報処理。管理者メール通知。未解決10件で自動アカウント制限。 |
| `onRestrictionLifted` | `onDocumentUpdated("users/{uid}")` | `restricted: true→false` 時に未解決通報を全件自動解決。 |
| `onBlockListChanged` | `onDocumentUpdated("users/{uid}/private/config")` | ブロック同期。相互フォロー解除 + `blockedBy` マーカー作成/削除。 |

---

## 14. ファイル構成

```
src/
├── app/
│   ├── layout.tsx              # ルートレイアウト（AuthProvider、450pxシェル）
│   ├── page.tsx                # ルートリダイレクト
│   ├── loading.tsx             # ルートローディング（カンガルースピナー）
│   ├── error.tsx               # ルートエラー画面
│   ├── global-error.tsx        # グローバルエラー画面
│   ├── not-found.tsx           # 404画面
│   ├── opengraph-image.png      # OG画像（静的）
│   ├── twitter-image.png        # Twitterカード画像（静的）
│   ├── favicon.ico
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
│   ├── RestrictedBanner.tsx
│   ├── GroupCard.tsx
│   ├── Skeleton.tsx
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
functions/src/index.ts          # Cloud Functions（全10個、§13参照）
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
| v4 改訂1 | 2026-04-02 | 通報した投稿を通報者から非表示（`reportedPosts`）。レポートメール通知を1〜3件目すべてに変更。 |
| **v4 改訂4** | **2026-07-02** | **主な差分**: フォーカスモードを5種→3種に削減（Work / Chill を廃止、レガシーマッピングで challenge に統合。ユーザー mainMode 正規化・Chill Vibes / Earn & Learn モードグループのクローズ・work/chill 趣味グループ4個の削除を本番移行済み）。旧・趣味グループ（Hobby Groups、トピック別公式グループ10個）は一時「Hobby」枠として整理後、同日中に全削除 — グループは公式モードグループ + ユーザー作成コミュニティの2種類のみに。EXPLOREのPopularソートタブを廃止しランキングフィード一本化。 |
| **v4 改訂3** | **2026-07-02** | **実装との突き合わせ監査を反映**: 投稿編集の5分制限撤廃（タグ・地域・公開範囲・日数も編集可、`editableUntil` はレガシー化）。PWAインストールバナーのモバイル限定化。マイページを横並びヘッダーレイアウトに（アバター左96px）。グループカード右スワイプミュートを追記。Study Room設定を `meeting*` フラットフィールドに訂正。`checkStreaks` をカレンダー日ベース+20時/23時警告に訂正。`streakWarningSent` フィールド追加。アカウント削除手順を実装準拠の10ステップに更新（メッセージ削除のフィールド名バグ修正+ルールに `allow delete` 追加）。Exploreのソートタブ・#タグ検索を追記。未実装項目（通知トグルUI・ハッシュタグ候補・ストリーク+100XP）を§15へ移動。 |
| **v4 改訂2** | **2026-04-03** | **主な差分**: Next.js 16.2.2 に更新。絵文字入力対応（投稿・チャット）。ブロック機能強化（自動アンフォロー + blockedBy同期 + プロフィール閲覧制限）。ユーザー通報をプロフィール画面に移動（スクリーンショット必須化）。アカウント自動制限（通報10件で restricted モード）+ 制限解除時の通報自動解決。グループ: システムメッセージ（参加/退出/キック/リーダー移譲/クローズ）、CLOSEDグループの読み取り専用チャット閲覧、friends参加確認モーダル、スワイプで既読クリア、キック済みユーザー再参加防止。いいね受信時のレベルアップ演出。OG画像を静的PNGに変更。Cloud Functions 7→10個（`onUserReportCreated`, `onRestrictionLifted`, `onBlockListChanged` 追加）。 |
