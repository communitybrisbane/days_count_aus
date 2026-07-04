# Days Count in AUS

**Make Days Count** — ワーホリ365日で人生変える。

ワーホリの毎日を英語で記録して、仲間と成長を共有できるジャーナルアプリ（PWA）。
日数カウント・投稿・いいね/フォロー・XPとレベル・グループチャット・ライブミーティング・プッシュ通知を備える。

- 本番: https://days-count.com （Vercel: `days-count-aus`）
- 仕様書: [`docs/SPEC_v4.md`](docs/SPEC_v4.md)
- 進捗メモ: [`docs/PROGRESS.md`](docs/PROGRESS.md)
- 広告素材: [`docs/ad-data-sheet.md`](docs/ad-data-sheet.md)

## 技術スタック

- Next.js (App Router) + TypeScript + Tailwind CSS v4 + Framer Motion
- Firebase（Auth: Googleログインのみ / Firestore / Storage / Cloud Functions / FCM）
- Sentry（エラー監視）/ Vercel（ホスティング）

## 開発

```bash
npm install
npm run dev      # http://localhost:3000（Turbopack）
npm run build    # 本番ビルド
npm run lint
```

環境変数は `.env.local` に配置（テンプレート: [`docs/ENV_EXAMPLE.md`](docs/ENV_EXAMPLE.md)）。

## フォルダ構成

| パス | 内容 |
|---|---|
| `src/app/` | 各ページ（home / explore / groups / post / mypage / settings ほか） |
| `src/components/` | UIコンポーネント |
| `src/lib/` | ロジック・Firebase・バリデーション |
| `src/hooks/` / `src/contexts/` / `src/types/` | カスタムフック・認証コンテキスト・型定義 |
| `functions/` | Cloud Functions（全11個、XP付与・モデレーション・通知・ミーティング等） |
| `docs/` | 仕様書・進捗メモ・広告素材（旧版仕様書は `docs/archive/`） |
| `image/` | 広告/LP用スクリーンショット・デザイン素材（Git管理外・ローカルのみ） |
| `firestore.rules` / `storage.rules` | Firebaseセキュリティルール |

## ブランチ運用

開発は `dev`、PRは `master` へ。
