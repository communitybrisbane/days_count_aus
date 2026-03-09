# 🇦🇺 アプリ完全設計図：Days Count in AUS

## 1. プロジェクト概要
- **アプリ名**: Days Count in AUS (デイズ・カウント・イン・オーストラリア)
- **コンセプト**: 「Make Days Count」ー ワーホリの365日を、単なる休暇ではなく、一生の資産（遊びと成長）に変える。
- **ターゲット**: ワーホリ渡航前、滞在中、帰国後の全フェーズのユーザー。
- **核心価値**:
  - 1日を「遊び（Experience）」と「成長（Growth）」の両面で記録。
  - 48時間継続ルールとレベルシステムによるモチベーション維持。
  - 5つの「フォーカスモード」を通じたコミュニティ形成。

## 2. デバイス・表示仕様
- **プラットフォーム**: Webアプリ（Vercelデプロイ）およびPWA（Progressive Web App）対応。
- **レスポンシブ・シェル設計**: PCブラウザ閲覧時も、画面中央に最大幅 450px のスマホサイズでコンテンツを表示。背景色は Sand Beige（サントベージュ：#F5F5DC）などの落ち着いた色で固定。
- **PWA要件**: ホーム画面への追加、スプラッシュ画面、アプリアイコン設定の実装。

## 3. ユーザーフェーズとカウントロジック
判定はすべて「ユーザーの端末時間（Local Time）」を基準とする。

### 渡航前 (Pre-departure)
- カウンター表記：`[D - 数値]`
- 起点：ユーザーが設定した「渡航予定日」
- 内容：渡航日までのカウントダウン。

### ワーホリ中 (In Australia)
- カウンター表記：`[D + 数値]`
- 起点：渡航日
- 内容：1日目から365日目までの経過日数。

### 帰国後 (Post-return)
- カウンター表記：`[R + 数値]`
- 起点：帰国後にアプリを再開（ステータス変更）した日
- 内容：帰国後の自己研鑽やキャリア構築のカウントアップ。

## 4. 5つのフォーカスモード（各分野のアイコン指定）
- 🗨️ **英語 (English)**：吹き出しのアイコン
- 📷 **SNS発信 (Social Media)**：カメラのアイコン
- 💻 **スキル (Skills)**：パソコンのアイコン
- ☕ **楽しむ (Enjoying)**：コーヒーのアイコン
- 🌏 **ワーホリ挑戦 (Challenging)**：オーストラリア大陸のアイコン

## 5. 報酬・レベル設計 (XP System)
「1年（365日）毎日継続したユーザーが、帰国時にレベル90に到達する」設計。

### XP獲得ルール
| アクション | XP | 備考 |
|---|---|---|
| ログ投稿（1日1回） | +50 XP | |
| いいねをもらう（受信） | +5 XP/回 | |
| いいねを送る（送信） | +2 XP/回 | 1日最大5回（計10XP）、期間限定ボーナス |

### レベル計算式
```
Level = floor( sqrt( TotalXP / 3.2 ) ) + 1
```
- UI表示: 名前の横に `[Lv.数値]` を常時表示。

## 6. 主要画面・機能詳細

### 6.1 HOME画面 (Dashboard)
- **メインカウンター**: 画面上部に巨大なフォントで「D+124」等の現在地を表示。
- **プログレスエリア**: 現在のLv、次のレベルまでの進捗バー（%表示）、ストリーク表示。
- **ストリーク判定（48時間ルール）**: 最後の投稿から48時間以内に次の投稿がない場合、継続日数（🔥マーク）を「0」にリセット。
- **運営エリア**: Firestoreから取得する「運営メッセージ」と「JOIN ZOOM（コミュニティMTGリンク）」ボタンを表示。色はOutback Clay（赤土色）を使用。

### 6.2 ログ投稿機能 (Daily Log)
- **投稿制限**: 1日1枚限定。
- **画像処理**: アプリ内での「1:1（正方形）クロップ機能」を必須実装。
- **二軸入力**:
  - **Fun（遊び）**：今日一番楽しかった体験のテキスト記述。
  - **Growth（成長）**：今日自分のために努力した内容のテキスト記述。
- **モード選択**: 5つのアイコンからその日の主要モードを1つ選択。

### 6.3 グループチャット (Focus Groups)
- **作成制限**: レベル7以上のユーザーのみがグループ作成（リーダー）可能。
- **リーダー表示**: 作成者には「Leaderマーク」を付与。
- **詳細表示**: グループ内の合計参加人数、および参加者名の一覧を確認できる機能。
- **識別**: 「分野のアイコン」＋「グループ名」で構成。

### 6.4 マイページ (My Page)
- **プロフィール画像**: ユーザーが設定した写真を正円で表示。
- **アーカイブ切り替え機能**:
  - **Timeline（全表示）**：写真＋Fun＋Growthを時系列で表示。
  - **Only Fun**：コーヒー等の「遊び」系投稿のみを抽出。
  - **Only Growth**：パソコン等の「成長」系投稿のみを抽出。

### 6.5 設定画面 (Settings)
- **プロフィール編集**: 名前、滞在地域、目標、メインモード、渡航予定日、プロフィールの写真（1:1クロップ付）を変更可能。
- **法定項目**: プライバシーポリシー、利用規約。
- **アカウント管理**: ログアウト、アカウント削除（FirebaseのAuthおよびデータ削除）。
- **拡張性**: 将来的なStripeによるサブスクリプション決済導入の余白を残す。

## 7. UI/UX デザイン（Aussie Vibes）

### テーマカラー
| 名前 | カラーコード | 意味 |
|---|---|---|
| Aussie Gold | #FFB800 | 太陽、喜び、Fun |
| Ocean Blue | #0077BE | 海、成長、Growth |
| Outback Clay | #B85C38 | 赤土、情熱、運営メッセージ |

### フッターナビゲーション (5タブ構成)
| タブ | アイコン | 機能 |
|---|---|---|
| HOME | 🦘 カンガルー | メインカウンター、Lv、Zoom |
| EXPLORE | 🐨 クオッカ | タイムライン |
| POST | 🪃 ブーメラン | 中央配置・フローティング・1日1回投稿 |
| GROUPS | 🐨 コアラ | 分野別チャット |
| MY PAGE | ユーザーのプロフィール写真（正円） | アクティブ時はゴールドの枠線 |

## 8. 技術スタック
- **Frontend**: Next.js (App Router), Tailwind CSS, Framer Motion (アニメーション)
- **Backend**: Firebase (Authentication: Googleログイン, Firestore, Storage)
- **画像処理ライブラリ**: react-easy-crop 等
- **Deployment**: Vercel

## 9. データベース構造（Firestore案）

### `users` コレクション
| フィールド | 型 | 説明 |
|---|---|---|
| uid | string | ユーザーID |
| displayName | string | 表示名 |
| photoURL | string | プロフィール画像URL |
| status | string | pre-departure / in-australia / post-return |
| totalXP | number | 累計XP |
| currentStreak | number | 現在の継続日数 |
| lastPostAt | timestamp | 最終投稿日時 |
| departureDate | timestamp | 渡航予定日 |
| returnStartDate | timestamp | 帰国開始日 |
| mainMode | string | メインフォーカスモード |
| region | string | 滞在地域 |
| goal | string | 目標 |
| isPro | boolean | サブスクリプション状態 |

### `posts` コレクション
| フィールド | 型 | 説明 |
|---|---|---|
| id | string | 投稿ID |
| userId | string | 投稿者ID |
| mode | string | フォーカスモード |
| imageUrl | string | 画像URL |
| contentFun | string | Fun記述 |
| contentGrowth | string | Growth記述 |
| phase | string | 投稿時のフェーズ |
| dayNumber | number | D+数値 or R+数値 |
| likeCount | number | いいね数 |
| createdAt | timestamp | 投稿日時 |

### `groups` コレクション
| フィールド | 型 | 説明 |
|---|---|---|
| id | string | グループID |
| mode | string | フォーカスモード |
| groupName | string | グループ名 |
| creatorId | string | 作成者ID |
| memberIds | array | メンバーIDリスト |
| lastMessageAt | timestamp | 最終メッセージ日時 |

### `admin` コレクション
| フィールド | 型 | 説明 |
|---|---|---|
| message | string | 運営メッセージ |
| zoomUrl | string | ZoomミーティングURL |
