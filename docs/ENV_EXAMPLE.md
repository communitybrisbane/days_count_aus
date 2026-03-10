# .env.local の設定方法

プロジェクトルートに `.env.local` ファイルを作成し、以下を記述:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyCRZqyROJXSAYct8qDPTw2tyO9D7bfP2lQ
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=days-count-aus.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=days-count-aus
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=days-count-aus.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=457409155401
NEXT_PUBLIC_FIREBASE_APP_ID=1:457409155401:web:b1281bb1e98e9944130a98
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-EMQW7XCQY0
```

## 重要
- `NEXT_PUBLIC_` プレフィックスが必須（Next.jsでクライアント側から参照するため）
- `.env.local` は `.gitignore` に含めること（GitHubに公開しない）
- Vercelデプロイ時は Vercel の Environment Variables 設定画面から同じ値を入力する
