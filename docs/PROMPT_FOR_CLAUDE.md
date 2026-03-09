# 開発指示プロンプト — Days Count in AUS

以下の仕様書に基づいて、アプリをゼロから構築してください。

## 仕様書
`docs/SPEC_v2_final.md` を読み込んで、その内容に **100%準拠** して実装すること。

## 開発手順

### Phase 1: プロジェクト初期セットアップ
1. `npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"` でNext.jsプロジェクトを作成
2. 必要なパッケージをインストール:
   - `firebase` (Auth, Firestore, Storage, Messaging)
   - `framer-motion` (アニメーション)
   - `react-easy-crop` (画像クロップ)
   - `next-pwa` (PWA対応)
3. Firebase設定ファイル (`src/lib/firebase.ts`) を作成（環境変数は `.env.local` に配置）
4. Tailwind にテーマカラーを追加: Aussie Gold `#FFB800`, Ocean Blue `#0077BE`, Outback Clay `#B85C38`, Sand Beige `#F5F5DC`
5. レスポンシブ・シェルレイアウト（max-w-[450px] 中央配置、外側 Sand Beige）を実装
6. PWA manifest + アイコン設定

### Phase 2: 認証・オンボーディング
1. Googleログイン（Firebase Auth）
2. オンボーディングフォーム（ニックネーム15文字、渡航予定日、メインモード、プロフィール写真任意）
3. デフォルトアバター（イニシャル + UID由来の背景色）
4. `users` ドキュメントの作成

### Phase 3: HOME画面
1. メインカウンター（D-/D+/R+ の巨大フォント表示）
2. レベル・進捗バー・ストリーク（🔥）表示
3. 運営メッセージ + JOIN ZOOMボタン（admin_config から取得）
4. 週間レポートカード（クライアント側集計）

### Phase 4: POST機能
1. 1日1投稿の制限ロジック
2. 画像クロップUI（react-easy-crop、1:1、1024px リサイズ）— 画像は任意
3. 画像なし投稿のグラデーションカードデザイン
4. Fun/Growth テキスト入力（各200文字）
5. フォーカスモード選択（5つ）
6. XP付与ロジック（投稿50XP、初投稿ボーナス100XP）
7. ストリーク更新（48時間ルール）
8. 投稿の5分以内編集・いつでも削除

### Phase 5: EXPLORE画面
1. 全ユーザー投稿の新着順タイムライン
2. 無限スクロール（20件ずつ、startAfter）
3. 5モードフィルタ
4. いいねボタン（likes サブコレクション、二重防止、1日5回制限）
5. XP付与（送信5XP、受信10XP）
6. ユーザーアイコンタップ → 公開版マイページ遷移
7. ブロックユーザーの投稿非表示

### Phase 6: GROUPS画面
1. グループ一覧（モードアイコン + グループ名 + 人数 + FULL表示）
2. Lv.7以上のみ作成可能
3. 即参加・自由退出・リーダーキック
4. テキストメッセージ（100文字）+ リアクション（Map形式）
5. リーダー退会時のグループ自動クローズ

### Phase 7: MY PAGE画面
1. プロフィール表示（正円写真 or イニシャルアバター）
2. タブ切り替え（Timeline / Fun / Growth）
3. AI振り返りデータコピー機能（目標 + 7日分ログ + プロンプトテンプレート → クリップボード）

### Phase 8: 設定画面
1. プロフィール編集
2. フェーズ手動切り替え（確認ダイアログ付き）
3. プライバシーポリシー・利用規約ページ
4. ログアウト
5. アカウント削除（Auth + Firestore + Storage + Groups の6段階クリーンアップ）
6. 通報機能（reports コレクション）

### Phase 9: 通知・仕上げ
1. FCM Web Push 設定（Service Worker）
2. 48時間ストリーク警告通知（残り6時間）
3. マイルストーン演出（D+30, 100, 200, 365 — Framer Motion 全画面アニメーション）
4. フッターナビゲーション（5タブ、POST中央フローティング）
5. Empty State デザイン

## 重要なルール
- 日付フィールド（departureDate, returnStartDate）は `YYYY-MM-DD` 文字列で保存。Timestamp禁止。
- カウント計算はすべてローカル日付の差分。
- Firebase の環境変数は `.env.local` に配置し、`.gitignore` に含める。
- Firestoreセキュリティルールは `firestore.rules` ファイルに記述。
- 画像保存パス: `posts/{userId}/{postId}.jpg`
- レベル計算式: `Level = floor(sqrt(TotalXP / 2.5)) + 1`
