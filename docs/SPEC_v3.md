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
| 通知 | アプリ内通知（FCM Web Push はトークン登録のみ実装、通知発火は未実装） |
| デプロイ | Vercel |
| PWA | manifest.json + アイコン（next-pwa未使用、手動設定） |
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
- **PWA要件**: manifest.json設定済み。`standalone` モード。テーマカラー `#FFB800`。
- **PWAアイコン**: 192×192px / 512×512px の PNG アイコン。
- **COOP ヘッダー**: Google OAuth popup 対応のため `next.config.ts` で `Cross-Origin-Opener-Policy: same-origin-allow-popups` を設定。

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
| ログ投稿（1日1回） | +50 | 1日1回 |
| 初投稿ウェルカムボーナス | +100 | 初回のみ（投稿50XPと合算で計150XP） |
| いいねをもらう（受信） | +10 | 無制限（自分の投稿への自己いいねではXP付与なし） |
| いいねを送る（送信） | +5 | 1日最大5回（計25XP）（自分の投稿へのいいねではXP付与なし） |
| 7日継続ボーナス | +100 | ストリークが7の倍数に達するたび（7, 14, 21...） |

### レベル計算式

```
Level = floor( sqrt( TotalXP / 4 ) ) + 1
```

- `xpForLevel(level) = round((level - 1)² × 4)`
- UI: 名前の横に **`Lv.数値`** を常時表示。
- プログレスバー: 次のレベルまでの進捗（%）を表示。

### ストリークルール（連続投稿日数）
- 最終投稿日が **昨日** であればストリーク +1。
- 最終投稿日が **今日** であればストリーク維持（変更なし）。
- 最終投稿日が **それ以前** であればストリーク 1 にリセット。
- 判定は `lastPostAt`（ISO 8601文字列）の日付部分で比較。

### いいねのXPルール
- **他人の投稿にいいね**: 送信者 +5XP、受信者 +10XP。
- **自分の投稿にいいね**: いいねカウント増減のみ。XP付与なし。
- **いいね取り消し**: XPも逆算して戻す。

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

- **メインカウンター**: 画面上部にAussie Gold → amber-500グラデーション背景、白文字で `D + 124` 等を `text-6xl font-black` で表示。
- **フェーズラベル**: カウンター上部に「渡航まで」「ワーホリ中」「帰国後」テキスト表示。
- **プログレスカード**: 白背景のカード（`shadow-md rounded-2xl`）にLv表示、XP値、次レベルまでの進捗バー（Ocean Blue）、ストリーク（🔥）表示。カウンター下に重ねて配置。
- **週間レポートカード**: 今週のサマリー（投稿数、獲得XP、ストリーク）を3カラムグリッドで表示。
- **運営エリア**: Firestoreの `admin_config/main` から取得した運営メッセージ + バナー画像（BannerCarousel）+ **JOIN ZOOMボタン**（スケジュール情報付き）。`admin_config` が存在しない場合は非表示。
- **マイルストーン演出**: D+30, 100, 200, 365 到達時にFramer Motionフルスクリーンアニメーション。`localStorage` で表示済みフラグ管理（1回のみ表示）。

---

### 6.3 EXPLORE画面（タイムライン）

**ルート**: `/explore`

- **全ユーザーの公開（public）かつアクティブ（active）な投稿** を新着順に表示。
- **フォロー優先表示**: フォロー中ユーザーの投稿を優先的に表示。
- **無限スクロール**: Firestoreの `limit(20)` + `startAfter(lastVisibleDoc)` で20件ずつ追加読み込み。スクロール位置がページ下端500pxに達したら次ページ取得。
- **フィルタ**: 上部に固定ヘッダーで「All」+ 5つのフォーカスモードアイコンを横スクロール可能なpill型ボタンで表示。選択中はAussie Gold背景。
- **検索**: ユーザー名・地域での検索機能。
- **いいね**: 投稿カードのハートボタンで送信。ダブルタップでもいいね可能（ハートアニメーション付き）。
- **自分の投稿にもいいね可能**（ただしXP付与なし）。
- **いいね取り消し可能**（XPも逆算して戻す）。
- **いいね制限**: 1日5回まで。超過時はalertで通知。
- **フォロー/アンフォロー**: 投稿カード内のFollowボタンからトグル。
- **ユーザー遷移**: 投稿者アイコンタップ → `/user/[uid]` 公開版マイページを閲覧可能。
- **ブロックユーザー非表示**: `privateData.blockedUsers` に含まれるユーザーの投稿はクライアント側でフィルタリング。
- **投稿メニュー（···）**: 自分の投稿→編集/削除、他人の投稿→ブロック/通報。
- **Empty State**: 投稿ゼロ時「🪃 最初の1枚を投稿して、カウントを始めよう！」表示。

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

#### 公式グループ（Official Groups）
- 各フォーカスモードごとに1つの公式グループが存在（`isOfficial: true`）。
- ユーザーのメインモード変更時に自動参加/退出。
- 公式グループはメンバー上限なし。
- グループ一覧でモード別に表示。

#### ユーザー作成グループ
- **グループ一覧** (`/groups`): クローズ済みグループは非表示。モードフィルタ・検索機能あり。
- **作成条件**: **Lv.5以上** のユーザーのみ。未満の場合は作成不可のメッセージ表示。
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

- **プロフィール表示**: 正円プロフィール画像（80px）、ニックネーム、Lv、進捗バー、XP/ストリーク/投稿数の3カラム統計。
- **地域・目標**: 設定済みの場合のみ表示。
- **設定ボタン**: `/settings` へ遷移。
- **AI振り返りボタン**: 日曜日のみ表示。
- **フォロー中リスト**: フォロー中のユーザー一覧。
- **アーカイブ切り替えタブ**:
  - **Timeline**: 全投稿を時系列表示（自分の投稿は visibility に関わらず全件表示）
  - **Fun（遊び）🎉**: `enjoying` + `social-media` の投稿を抽出
  - **Growth（成長）🌱**: `skills` + `challenging` + `english` の投稿を抽出
- タブはAussie Goldの下線でアクティブ状態を表示。

---

### 6.7 設定画面 (Settings)

**ルート**: `/settings`

- **プロフィール編集**: ニックネーム（半角英数字15文字、**重複不可**）、滞在地域（スクロール選択式）、目標（100文字、リアルタイム文字数カウント）、メインモード（pill型ボタン選択）、渡航予定日、プロフィール写真（**丸型クロップ**付き、512×512px → `avatars/{userId}.jpg` に保存）。
- **フェーズ切り替え**: ステータス（渡航前/ワーホリ中/帰国後）を手動変更。各選択肢にconfirm確認ダイアログ付き。現在のステータスに ✓ マーク表示。
- **通報機能**: 対象ユーザーID + 理由 + スクリーンショット画像を入力して `reports` コレクションに送信（画像は `reports/` に保存）。
- **法定項目**: プライバシーポリシー、利用規約、法的通知（LegalModals コンポーネントでモーダル表示）。
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
- **データ構造**: `users/{uid}/following/{targetUid}` サブコレクション。
- **キャッシュ**: 最大200件のフォローIDをAuthContextでキャッシュ。
- **フォロー優先表示**: EXPLOREでフォロー中ユーザーの投稿を優先表示。
- **アカウント削除時**: following サブコレクションも一括削除。

---

### 6.12 公開プロフィール画面

**ルート**: `/user/[uid]`

- ユーザーのアバター（80px）、ニックネーム、Lv、地域、目標を表示。
- そのユーザーの **公開 (public) かつアクティブ (active)** な投稿一覧を新着順で表示。
- フォロー/アンフォローボタン。
- ブロックボタン。

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

### 共通UIパターン
- ローディング: `animate-spin` の円 + `border-b-2 border-aussie-gold`（LoadingSpinnerコンポーネント、fullScreen対応）
- カード: `rounded-2xl shadow-sm border border-gray-100`
- ボタン（プライマリ）: `bg-aussie-gold text-white font-bold rounded-full`
- フォーム入力: `border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-aussie-gold`
- ページ下部余白: `pb-20`（フッターナビ分）
- 確認ダイアログ: `ConfirmModal` コンポーネント（汎用）
- XPトースト: `XPToast` コンポーネント（1.2秒表示後自動消去）
- レベルアップ演出: `LevelUpAnimation` コンポーネント（フルスクリーンオーバーレイ）

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
| groupIds | array | 所属グループIDの配列 |
| createdAt | timestamp | アカウント作成日時 |

### `users/{uid}/private/config` サブコレクション（プライベートデータ）

| フィールド | 型 | 説明 |
|---|---|---|
| blockedUsers | array | ブロックしたユーザーUIDの配列 |
| fcmToken | string | FCMプッシュ通知トークン |

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
| zoomNextInfo | string | 次回セッション情報テキスト |
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
- **更新（本人）**: ホワイトリスト制。変更可能フィールド: `displayName`, `photoURL`, `region`, `goal`, `mainMode`, `departureDate`, `returnStartDate`, `status`, `weeklyGoal`, `groupIds`, `currentStreak`, `lastPostAt`, `totalXP`, `dailyLikeCount`, `lastLikeDate`, `streakWarningSent`。`isPro`, `createdAt`, `uid` は不変。
- **更新（他人）**: `totalXP`, `dailyLikeCount`, `lastLikeDate`, `groupIds` のみ（いいねシステム・グループ参加/退出用）。

### Users > Private
- 読み取り・作成・更新すべて本人のみ。更新は `blockedUsers`, `fcmToken` のみ。

### Users > Following
- 読み取り: 認証済み全員。作成・削除: 本人のみ。

### Posts
- **読み取り**: 自分の投稿は常に閲覧可。他人の投稿は `status == "active"` かつ `visibility == "public"` のみ。
- **作成**: 認証済み + `userId` が自身 + `content` 1〜500文字 + `status == "active"` + `reportCount == 0` + `likeCount == 0`。
- **更新（作成者）**: (1) `imageUrl` のみ（投稿後の画像アップロード用）、または (2) `editableUntil` 内で `content` + `mode` のみ（1〜500文字）。
- **更新（いいね）**: 認証済み + `visibility == "public"` + `likeCount` の +1/-1 のみ。
- **更新（通報）**: 他人の投稿 + `visibility == "public"` + `reportCount` +1、または `reportCount` +1 + `status: "hidden"`（3件以上）。
- **削除**: 作成者本人のみ。

### Posts > Likes
- 読み取り: 認証済み全員。作成: 自分のUID = ドキュメントID。削除: 自分のいいねのみ。

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
- 更新（リアクション）: グループメンバーのみ。

### Reports
- 読み取り: 不可。作成: 認証済み + `reporterId` = 自身 + `resolved` = false。

### Admin Config / Banners / Moderation Config
- 読み取り: 認証済み全員。書き込み: 不可（管理者はConsoleで編集）。

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
│   ├── PostCard.tsx            # 投稿カード（いいね・フォロー・通報・ブロック）
│   ├── ImageCropper.tsx        # 画像クロップUI
│   ├── MilestoneAnimation.tsx  # マイルストーン演出
│   ├── LevelUpAnimation.tsx    # レベルアップ演出
│   ├── XPToast.tsx             # XP獲得トースト
│   ├── LoadingSpinner.tsx      # ローディングスピナー
│   ├── ConfirmModal.tsx        # 汎用確認ダイアログ
│   ├── LegalModals.tsx         # 利用規約・プライバシーポリシーモーダル
│   ├── BannerCarousel.tsx      # 運営バナーカルーセル
│   ├── GroupCard.tsx           # グループカード
│   ├── icons/index.tsx         # SVGアイコンコンポーネント群
│   └── layout/
│       └── BottomNav.tsx       # フッターナビゲーション
├── contexts/
│   └── AuthContext.tsx         # 認証コンテキスト（user, profile, privateData, following）
├── hooks/
│   └── useAuthGuard.ts         # 認証ガードフック
├── lib/
│   ├── firebase.ts             # Firebase初期化（Auth, Firestore, Storage, Analytics, App Check）
│   ├── auth.ts                 # Google認証ヘルパー（popup → redirect fallback）
│   ├── utils.ts                # ユーティリティ（レベル計算、日数カウント、色生成）
│   ├── constants.ts            # 定数（フォーカスモード、マイルストーン、グラデーション、地域、制限値）
│   ├── validators.ts           # バリデーション（ニックネーム・グループ名重複チェック）
│   ├── follow.ts               # フォロー/アンフォロー操作
│   ├── groups.ts               # 公式グループ参加/退出
│   ├── fcm.ts                  # FCMトークン登録・メッセージリスナー
│   ├── imageUtils.ts           # 画像圧縮・EXIF除去
│   └── services/
│       ├── posts.ts            # 投稿CRUD、XP更新、モデレーション、禁止語句
│       └── users.ts            # プロフィールCRUD、アバター、アカウント削除、通報、ブロック
└── types/
    ├── index.ts                # Post, Group, UserProfile, UserPrivate インターフェース
    └── next-pwa.d.ts           # PWA型定義

firestore.rules                 # Firestoreセキュリティルール
next.config.ts                  # Next.js設定（COOPヘッダー）
public/
├── manifest.json               # PWAマニフェスト
└── icons/                      # PWAアイコン（192×192, 512×512）
```

---

## 15. 未実装・将来対応項目

| 項目 | ステータス | 備考 |
|---|---|---|
| FCM Web Push通知（発火） | 未実装 | トークン登録のみ実装済み。Cloud Functions + Service Worker 必要 |
| ストリーク警告通知 | 未実装 | FCM発火実装後に対応 |
| プライバシーポリシー・利用規約の内容精査 | 未完了 | LegalModals は実装済み、本文は仮 |
| Stripeサブスクリプション | 未実装 | `isPro` フィールドのみ用意済み |
| App Check の Cloud Firestore 強制適用 | 未有効化 | reCAPTCHA Enterprise 設定を整えてから |
| 渡航予定日の自動フェーズ遷移確認ダイアログ | 未実装 | HOME画面での日付チェック必要 |
| 全体的なUIデザイン改善 | 継続 | — |
| 通知機能の強化（いいね通知、グループ通知等） | 未実装 | — |

---

## 変更履歴

| バージョン | 日付 | 内容 |
|---|---|---|
| v2 Final | — | 最終確定仕様書 |
| v3 | 2025-03-10 | Phase 1〜9 実装完了。実装詳細・ルート・ファイル構成・未実装項目を追記。 |
| v3 改訂 | 2026-03-12 | 現在の実装に完全準拠して全面書き直し。主な差分: レベル計算式を `sqrt(TotalXP/4)+1` に修正、投稿テキストを統合 `content` フィールド（400文字）に変更、投稿に `visibility`（public/private）と `status`（active/hidden/pending）を追加、フォロー機能・公式グループ・投稿モデレーション（自動非表示）・禁止語句フィルター・ブロックUI を追記、グループ作成条件を Lv.5 に修正、自己いいね（XP付与なし）を明記、ダブルタップいいね・2ステップ投稿フロー・画像圧縮仕様を追記、Firestore構造に `users/private`・`users/following`・`posts/reports`・`groups/lastRead`・`banners`・`moderation_config` を追加、セキュリティルールを実装準拠で全面更新、アカウント削除手順を拡充。 |
