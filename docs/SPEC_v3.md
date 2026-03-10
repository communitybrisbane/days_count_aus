# 🇦🇺 Days Count in AUS — 開発仕様書 (SPEC v3)

> **正式名称**: Days Count in AUS
> **通称（アイコン下表示）**: Count
> **コンセプト**: 「Make Days Count」ー ワーホリの365日を、一生の資産（遊びと成長）に変える。
> **ターゲット**: ワーホリ渡航前・滞在中・帰国後の全フェーズのユーザー

---

## 1. 技術スタック

| カテゴリ | 技術 |
|---|---|
| Frontend | Next.js 16 (App Router) + TypeScript |
| スタイリング | Tailwind CSS v4 |
| アニメーション | Framer Motion |
| 認証 | Firebase Authentication（**Googleログインのみ**） |
| DB | Cloud Firestore |
| ストレージ | Firebase Storage |
| 分析 | Firebase Analytics |
| 画像クロップ | react-easy-crop + Canvas API（1024×1024px リサイズ） |
| 通知 | アプリ内通知（FCM Web Pushは未実装・将来対応） |
| デプロイ | Vercel |
| PWA | next-pwa（ホーム追加、スプラッシュ、アプリアイコン） |
| ビルドツール | Turbopack（Next.js 16 デフォルト） |

---

## 2. デバイス・表示仕様

- **レスポンシブ・シェル設計**: PC閲覧時は画面中央に **最大幅450px** でコンテンツ表示。シェル内側は白背景 + `shadow-lg`。
- **背景色**: Sand Beige `#F5F5DC`（シェル外側）。
- **PWA要件**: ホーム画面追加、スプラッシュ画面、アプリアイコン。
- **PWAアイコン**: 仮アイコン（SVG、Aussie Gold「C」文字）。本番用PNGに差し替え予定。

---

## 3. ユーザーフェーズとカウントロジック

すべて **ユーザー端末のローカル時間（0:00〜23:59）** 基準。

| フェーズ | 表記 | 起点 | 内容 |
|---|---|---|---|
| 渡航前 (Pre-departure) | `D - 数値` | 渡航予定日 | カウントダウン |
| ワーホリ中 (In Australia) | `D + 数値` | 渡航日（当日は D+1） | 経過日数（D+365以降も継続） |
| 帰国後 (Post-return) | `R + 数値` | ステータス変更日 | 帰国後カウントアップ |

### フェーズ遷移ルール
- **手動切り替え**が基本。設定画面からいつでも変更可能（確認ダイアログ付き）。
- 帰国後に切り替えた場合、`returnStartDate` に当日日付を自動設定。
- D+365を超えてもカウント継続。帰国後フェーズへの切り替えはユーザー任意。

### 日付の保存形式
- `departureDate`, `returnStartDate` は **`YYYY-MM-DD`（文字列）** で保存。
- Timestamp（UTC変換）は使用しない。タイムゾーン跨ぎのバグを防止。
- カウント計算はローカル日付同士の差分で行う。

---

## 4. 5つのフォーカスモード

| モード | ID | アイコン | 用途 |
|---|---|---|---|
| English（英語） | `english` | 💬 吹き出し | 英語学習 |
| Social Media（SNS発信） | `social-media` | 📷 カメラ | SNS活動 |
| Skills（スキル） | `skills` | 💻 パソコン | スキル習得 |
| Enjoying（楽しむ） | `enjoying` | ☕ コーヒー | 遊び・体験 |
| Challenging（ワーホリ挑戦） | `challenging` | 🌏 地球 | ワーホリならではの挑戦 |

### マイページでのカテゴリ分類
- **Fun（遊び）タブ**: `enjoying` + `social-media` の投稿
- **Growth（成長）タブ**: `skills` + `challenging` + `english` の投稿

---

## 5. XP・レベル設計

**設計目標**: 365日毎日継続 → 帰国時 **Lv.90前後** 到達。

### XP獲得ルール

| アクション | XP | 制限 |
|---|---|---|
| ログ投稿（1日1回） | +50 | 1日1回 |
| 初投稿ウェルカムボーナス | +100 | 初回のみ（投稿50XPと合算で計150XP） |
| いいねをもらう（受信） | +10 | 無制限 |
| いいねを送る（送信） | +5 | 1日最大5回（計25XP） |
| 7日継続ボーナス | +100 | ストリークが7の倍数に達するたび（7, 14, 21...） |

### レベル計算式

```
Level = floor( sqrt( TotalXP / 2.5 ) ) + 1
```

- UI: 名前の横に **`Lv.数値`** を常時表示。
- プログレスバー: 次のレベルまでの進捗（%）を表示。

### 48時間ストリークルール
- 最終投稿から **48時間経過した瞬間** にストリーク（🔥連続投稿日数）を **0にリセット**。
- リセット **6時間前** に警告プッシュ通知（**未実装** — FCM設定後に対応予定）。

---

## 6. 画面・機能詳細

### 6.1 認証・オンボーディング

**ルート**: `/login`, `/onboarding`

**ログイン**: Googleログインのみ（`signInWithPopup`）。

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
     - Returned: 本日を `departureDate` と `returnStartDate` に自動設定、R+1からカウント開始（入力不要）
   - **4行目**: フォーカスモード5つ横並び
   - **ニックネーム**: 半角英数字のみ、15文字以内、**重複不可**（500msデバウンスチェック）
   - **プロフィール写真**: 丸型クロップUI（512×512px出力）
3. 初回特典: 初投稿時に **ウェルカムボーナス 100XP**

**デフォルトアバター**: ニックネームの頭文字 + ユーザーIDからHSL色相ハッシュ生成した背景色の円。

---

### 6.2 HOME画面 (Dashboard)

**ルート**: `/home`

- **メインカウンター**: 画面上部にAussie Gold → amber-500グラデーション背景、白文字で `D + 124` 等を `text-6xl font-black` で表示。
- **フェーズラベル**: カウンター上部に「渡航まで」「ワーホリ中」「帰国後」テキスト表示。
- **プログレスカード**: 白背景のカード（`shadow-md rounded-2xl`）にLv表示、XP値、次レベルまでの進捗バー（Ocean Blue）、ストリーク（🔥）表示。カウンター下に `-mt-4` で重ねて配置。
- **週間レポートカード**: 今週のサマリー（投稿数、獲得XP、ストリーク）を3カラムグリッドで表示。青 → 黄のグラデーション背景。
- **運営エリア**: Firestoreの `admin_config/main` から取得した運営メッセージ + **JOIN ZOOMボタン**（Outback Clay色 `rounded-xl`）。`admin_config` が存在しない場合は非表示。
- **マイルストーン演出**: D+30, 100, 200, 365 到達時にFramer Motionフルスクリーンアニメーション。`localStorage` で表示済みフラグ管理（1回のみ表示）。

---

### 6.3 EXPLORE画面（タイムライン）

**ルート**: `/explore`

- **全ユーザーの投稿**を新着順に表示。
- **無限スクロール**: Firestoreの `limit(20)` + `startAfter(lastVisibleDoc)` で20件ずつ追加読み込み。スクロール位置がページ下端500pxに達したら次ページ取得。
- **フィルタ**: 上部に固定ヘッダーで「All」+ 5つのフォーカスモードアイコンを横スクロール可能なpill型ボタンで表示。選択中はAussie Gold背景。
- **いいね**: 投稿カード左下のハートボタンで送信。自分の投稿にはいいね不可（ボタン無効化）。いいね取り消し可能。
- **いいね制限**: 1日5回まで。超過時はalertで通知。
- **ユーザー遷移**: 投稿者アイコンタップ → `/user/[uid]` **公開版マイページ**（Lv、投稿履歴）を閲覧可能。
- **ブロックユーザー非表示**: `profile.blockedUsers` に含まれるユーザーの投稿はクライアント側でフィルタリング。
- **Empty State**: 投稿ゼロ時「🪃 最初の1枚を投稿して、カウントを始めよう！」表示。

---

### 6.4 POST画面（ログ投稿）

**ルート**: `/post`, `/post/edit/[postId]`

- **投稿制限**: 1日1回。当日すでに投稿済みの場合は「✅ 今日の投稿は完了！また明日、カウントを進めよう！」メッセージを表示。
- **画像**: **任意（Optional）**。
  - **画像あり**: react-easy-crop で1:1クロップ → Canvas APIで1024×1024pxにリサイズ（JPEG品質85%） → Firebase Storage アップロード（パス: `posts/{userId}/{postId}.jpg`）。
  - **画像なし**: フォーカスモードに対応したブランドカラーグラデーション背景（5色バリエーション）にテキスト中央寄せのカードデザインで表示。アスペクト比 4:3。
- **テキスト入力**:
  - **Fun（遊び）**: 今日一番楽しかった体験（**200文字以内**）— リアルタイム文字数カウント
  - **Growth（成長）**: 今日自分のために努力した内容（**200文字以内**）— リアルタイム文字数カウント
  - 少なくともどちらか1つは入力必須。
- **モード選択**: 5つのアイコンから1つ選択（必須）。
- **XP付与**: 投稿完了時に +50XP。初投稿時はさらに +100XP ウェルカムボーナス。
- **ストリーク更新**: 最終投稿から48時間以内なら `currentStreak + 1`、超過なら `1` にリセット。7の倍数到達時は追加 +100XP。
- **投稿の編集** (`/post/edit/[postId]`): 投稿後 **5分以内** のみ可能。テキストとモードのみ編集可（画像変更不可）。期限超過時は「編集可能時間（5分）を超えました」表示。
- **投稿の削除**: いつでも可能（本人のみ、confirm確認付き）。

---

### 6.5 GROUPS画面（フォーカスグループ）

**ルート**: `/groups`, `/groups/create`, `/groups/[groupId]`

- **グループ一覧** (`/groups`): クローズ済みグループは非表示。`lastMessageAt` 降順ソート。
- **作成条件**: **Lv.7以上** のユーザーのみ。未満の場合は「Lv.7以上で作成可能」テキスト表示。
- **グループ作成** (`/groups/create`): グループ名（30文字以内、**重複不可** — アクティブなグループ内でリアルタイムチェック） + フォーカスモード選択。
- **最大人数**: **10名**。満員時は **「FULL」バッジ** 表示（赤背景）。
- **識別**: 「フォーカスモードアイコン」+「グループ名」+「人数/10 members」。
- **リーダー**: 作成者に **Leaderマーク** 付与。メンバーリストで「Leader」テキスト表示。
- **参加**: 即参加（承認制なし）。ボタンクリックで `memberIds` に追加。
- **退出**: 自由に退出可能。
- **キック**: リーダーのみ可能。メンバーリストの各メンバーに「kick」ボタン表示。
- **リーダー退会時**: 確認ダイアログ「リーダーが退出するとグループは解散されます」→ `isClosed: true` に更新。
- **チャット** (`/groups/[groupId]`): リアルタイム (`onSnapshot`) テキストメッセージ。100文字以内。Enterキーで送信可能。
- **リアクション**: メッセージごとのハートリアクション（Map形式 `{ userId: true }`）。

---

### 6.6 MY PAGE画面

**ルート**: `/mypage`

- **プロフィール表示**: 正円プロフィール画像（80px）、ニックネーム、Lv、進捗バー、XP/ストリーク/投稿数の3カラム統計。
- **地域・目標**: 設定済みの場合のみ表示。
- **設定ボタン**: `/settings` へ遷移。
- **AI振り返りボタン**: 日曜日のみ表示。
- **アーカイブ切り替えタブ**:
  - **Timeline**: 全投稿を時系列表示
  - **Fun（遊び）🎉**: `enjoying` + `social-media` の投稿を抽出
  - **Growth（成長）🌱**: `skills` + `challenging` + `english` の投稿を抽出
- タブはAussie Goldの下線でアクティブ状態を表示。

---

### 6.7 設定画面 (Settings)

**ルート**: `/settings`

- **プロフィール編集**: ニックネーム（半角英数字15文字、**重複不可**）、滞在地域、目標（100文字、リアルタイム文字数カウント）、メインモード（pill型ボタン選択）、渡航予定日、プロフィール写真（**丸型クロップ**付き、512×512px → `avatars/{userId}.jpg` に保存）。
- **フェーズ切り替え**: ステータス（渡航前/ワーホリ中/帰国後）を手動変更。各選択肢にconfirm確認ダイアログ付き。現在のステータスに ✓ マーク表示。
- **通報機能**: 対象ユーザーID + 理由を入力して `reports` コレクションに送信。
- **法定項目**: プライバシーポリシー、利用規約（リンクのみ、ページ未作成）。
- **アカウント管理**: ログアウト（confirm付き）、アカウント削除（2段階confirm付き）。
- **拡張枠**: 将来的な Stripe サブスク導入の余白。

---

### 6.8 AI振り返りデータコピー機能（マイページ内）

毎週日曜にマイページで「AI振り返り用データをコピー」ボタンを表示。

**コピー内容の構成**:
1. **【現在の目標】**: ユーザーの `goal` フィールド
2. **【直近7日間の活動ログ】**: クライアント側で集計した日付・カテゴリ・Fun/Growth テキスト + 各カテゴリ投稿数 + 獲得XP + ストリーク日数 + 現在のD+/R+とLv
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

### 6.10 通報・ブロック機能

- **通報**: 設定画面から対象ユーザーIDと理由を入力。`reports` コレクションに記録。運営が Firebase Console で確認・対応。
- **ブロック**: `users.blockedUsers` 配列に相手UIDを追加。ブロックしたユーザーの投稿を EXPLORE で非表示（クライアント側フィルタリング）。

---

### 6.11 公開プロフィール画面

**ルート**: `/user/[uid]`

- ユーザーのアバター（80px）、ニックネーム、Lv、地域、目標を表示。
- そのユーザーの投稿一覧を新着順で全件表示。

---

## 7. UI/UXデザイン（Aussie Vibes）

### テーマカラー

| 名前 | コード | Tailwind名 | 意味 |
|---|---|---|---|
| Aussie Gold | `#FFB800` | `aussie-gold` | 太陽、喜び、Fun |
| Ocean Blue | `#0077BE` | `ocean-blue` | 海、成長、Growth |
| Outback Clay | `#B85C38` | `outback-clay` | 赤土、情熱、運営メッセージ |
| Sand Beige | `#F5F5DC` | `sand-beige` | 背景（シェル外側） |

### フッターナビゲーション（5タブ）

固定フッター（`fixed bottom-0`、シェル幅に合わせて `max-w-[450px]` で中央配置）。

| タブ | ルート | アイコン | 機能 |
|---|---|---|---|
| HOME | `/home` | 🦘 カンガルー | メインカウンター、Lv、Zoom、週間レポート |
| EXPLORE | `/explore` | 🐹 クオッカ風 | 全投稿タイムライン |
| POST | `/post` | 🪃 ブーメラン | **中央配置・フローティング（-mt-5）・14×14の円**。Aussie Gold背景。 |
| GROUPS | `/groups` | 🐨 コアラ | フォーカスグループチャット |
| MY PAGE | `/mypage` | ユーザーのプロフィール写真（正円24px） | アクティブ時はゴールドの `ring-2` 枠線 |

### 共通UIパターン
- ローディング: `animate-spin` の円 + `border-b-2 border-aussie-gold`
- カード: `rounded-2xl shadow-sm border border-gray-100`
- ボタン（プライマリ）: `bg-aussie-gold text-white font-bold rounded-full`
- フォーム入力: `border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-aussie-gold`
- ページ下部余白: `pb-20`（フッターナビ分）

### Empty State
- 投稿ゼロ時: **「🪃 最初の1枚を投稿して、カウントを始めよう！」** の誘導表示。

---

## 8. Firestore データベース構造

### `users` コレクション

| フィールド | 型 | 説明 |
|---|---|---|
| uid | string | ユーザーID |
| displayName | string | ニックネーム（15文字以内） |
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
| blockedUsers | array | ブロックしたユーザーUIDの配列 |
| createdAt | timestamp | アカウント作成日時 |

### `posts` コレクション

| フィールド | 型 | 説明 |
|---|---|---|
| id | string | 投稿ID（自動生成） |
| userId | string | 投稿者UID |
| mode | string | フォーカスモード |
| imageUrl | string | 画像URL（画像なし投稿は空文字） |
| contentFun | string | Fun記述（200文字以内） |
| contentGrowth | string | Growth記述（200文字以内） |
| phase | string | 投稿時のフェーズ |
| dayNumber | number | D+数値 or R+数値 |
| likeCount | number | いいね数 |
| createdAt | timestamp | 投稿日時 |
| editableUntil | timestamp | 編集可能期限（投稿から5分後） |

### `posts/{postId}/likes` サブコレクション

| フィールド | 型 | 説明 |
|---|---|---|
| userId | string | いいねしたユーザーUID（ドキュメントIDとしても使用） |
| createdAt | timestamp | いいね日時 |

### `groups` コレクション

| フィールド | 型 | 説明 |
|---|---|---|
| id | string | グループID |
| mode | string | フォーカスモード |
| groupName | string | グループ名 |
| creatorId | string | リーダーUID |
| memberIds | array | メンバーUIDの配列（最大10） |
| memberCount | number | 現在の参加人数 |
| lastMessageAt | timestamp | 最終メッセージ日時 |
| createdAt | timestamp | グループ作成日時 |
| isClosed | boolean | クローズ済みフラグ |

### `groups/{groupId}/messages` サブコレクション

| フィールド | 型 | 説明 |
|---|---|---|
| senderId | string | 送信者UID |
| text | string | メッセージ本文（100文字以内） |
| createdAt | timestamp | 送信日時 |
| reactions | map | `{ userId: true }` 形式 |

### `reports` コレクション

| フィールド | 型 | 説明 |
|---|---|---|
| reporterId | string | 通報者UID |
| targetUserId | string | 対象ユーザーUID |
| targetPostId | string | 対象投稿ID（任意） |
| reason | string | 通報理由 |
| createdAt | timestamp | 通報日時 |
| resolved | boolean | 対応済みフラグ |

### `admin_config` ドキュメント（単一ドキュメント `admin_config/main`）

| フィールド | 型 | 説明 |
|---|---|---|
| message | string | 運営メッセージ |
| zoomUrl | string | ZoomミーティングURL |
| ai_prompt_template | string | AI振り返り用プロンプトテンプレート |

---

## 9. Firestore セキュリティルール

ファイル: `firestore.rules`

- **ユーザー**: 認証済みユーザーは全ユーザーを読み取り可。作成・更新・削除は本人のみ。
- **投稿の作成**: 認証済みユーザーのみ。`userId` が自身のUIDと一致する必要あり。
- **投稿の編集**: 作成者本人のみ + `editableUntil` 未経過。ただし `likeCount` と `imageUrl` の更新は期限に関わらず許可。
- **投稿の削除**: 作成者本人のみ。
- **いいね**: 認証済みユーザーのみ作成可。ドキュメントIDが自身のUIDと一致する必要あり。削除は自分のいいねのみ。
- **グループ**: 認証済みユーザーは読み書き可。削除は不可。
- **グループメッセージ**: グループメンバーのみ読み書き可（`memberIds` チェック）。
- **reports**: 認証済みユーザーのみ作成可。読み取りは不可（管理者はConsoleで確認）。
- **admin_config**: 読み取りは認証済みユーザー全員。書き込みは不可（管理者はConsoleで編集）。

---

## 10. アカウント削除時の処理

設定画面から実行（2段階confirm付き）。以下を一括実行:

1. ユーザーの全 `posts` ドキュメントをバッチ削除
2. Firebase Storage 内の `posts/{userId}/` 配下の全画像ファイル削除
3. 全 `groups` をスキャンし:
   - リーダーのグループは `isClosed: true` に更新（自動クローズ）
   - メンバーとして参加中のグループから `memberIds` を除去 & `memberCount` を -1
4. `users` ドキュメント削除
5. Firebase Auth アカウント削除

---

## 11. 文字数制限まとめ

| フィールド | 上限 |
|---|---|
| ニックネーム | 15文字（半角英数字のみ） |
| Fun / Growth | 各200文字 |
| 目標 (Goal) | 100文字 |
| グループメッセージ | 100文字 |
| グループ名 | 30文字 |

---

## 12. 投稿編集ルール

- **編集**: 投稿後 **5分以内** のみ可能。テキスト（Fun/Growth）とモードのみ変更可。画像は変更不可。
- **削除**: いつでも可能（本人のみ、confirm確認付き）。

---

## 13. ファイル構成

```
src/
├── app/
│   ├── layout.tsx          # ルートレイアウト（AuthProvider、シェル）
│   ├── page.tsx            # ルートリダイレクト
│   ├── globals.css         # Tailwind + テーマカラー定義
│   ├── login/page.tsx      # ログイン画面
│   ├── onboarding/page.tsx # オンボーディング画面
│   ├── home/page.tsx       # HOME画面
│   ├── explore/page.tsx    # EXPLORE画面
│   ├── post/
│   │   ├── page.tsx        # 投稿画面
│   │   └── edit/[postId]/page.tsx  # 投稿編集画面
│   ├── groups/
│   │   ├── page.tsx        # グループ一覧
│   │   ├── create/page.tsx # グループ作成
│   │   └── [groupId]/page.tsx  # グループチャット
│   ├── mypage/page.tsx     # マイページ
│   ├── settings/page.tsx   # 設定画面
│   └── user/[uid]/page.tsx # 公開プロフィール
├── components/
│   ├── Avatar.tsx          # アバターコンポーネント
│   ├── PostCard.tsx        # 投稿カードコンポーネント
│   ├── ImageCropper.tsx    # 画像クロップUI
│   ├── MilestoneAnimation.tsx  # マイルストーン演出
│   └── layout/
│       └── BottomNav.tsx   # フッターナビゲーション
├── contexts/
│   └── AuthContext.tsx     # 認証コンテキスト
├── lib/
│   ├── firebase.ts         # Firebase初期化（Auth, Firestore, Storage, Analytics）
│   ├── auth.ts             # Google認証ヘルパー
│   ├── utils.ts            # ユーティリティ関数（レベル計算、日数カウント等）
│   └── constants.ts        # 定数（フォーカスモード、マイルストーン）
└── types/
    └── next-pwa.d.ts       # next-pwa 型定義

firestore.rules             # Firestoreセキュリティルール
public/
├── manifest.json           # PWAマニフェスト
└── icons/                  # PWAアイコン（仮SVG）
```

---

## 14. 未実装・将来対応項目

| 項目 | ステータス | 備考 |
|---|---|---|
| FCM Web Push通知 | 未実装 | Service Worker + Cloud Functions必要 |
| 48時間ストリーク警告通知 | 未実装 | FCM設定後に対応 |
| ~~オンボーディングでのプロフィール写真~~ | **実装済み** | 丸型クロップUI付き |
| プライバシーポリシー・利用規約ページ | リンクのみ | 本文ページ未作成 |
| Stripeサブスクリプション | 未実装 | `isPro` フィールドのみ用意済み |
| PWAアイコン本番画像 | 仮SVG | PNG差し替え必要 |
| 渡航予定日の自動フェーズ遷移確認ダイアログ | 未実装 | HOME画面での日付チェック必要 |
| ブロック機能UI | 未実装 | blockedUsersフィールドは存在。ブロックボタンUI未作成 |

---

## 変更履歴

| バージョン | 日付 | 内容 |
|---|---|---|
| v2 Final | — | 最終確定仕様書 |
| v3 | 2026-03-10 | Phase 1〜9 実装完了。実装詳細・ルート・ファイル構成・未実装項目を追記。Firebase Analytics追加。ニックネームを半角英数字のみに制限（国際化対応）。ニックネーム・グループ名の重複チェック追加。オンボーディングにフェーズ選択・プロフィール写真（丸型クロップ）追加。ワーホリ中は渡航日選択、帰国後は自動設定に変更。ログイン画面・オンボーディングUIをコンパクト化（スクロール不要）。 |
