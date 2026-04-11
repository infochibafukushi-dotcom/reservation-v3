# Cloudflare Worker Proxy (GitHub token非公開化)

このフォルダの `../proxy.cloudflare-worker.js` は、フロントエンドから受けた `func/args` をサーバー側で実行し、GitHub Contents API への書き込みを代行します。

## 目的
- GitHub tokenをブラウザに保存しない
- 既存 `github.backend.js` の API 契約を維持

## Deploy例
1. Cloudflare Workerを作成
2. `proxy.cloudflare-worker.js` を貼り付け
3. Secrets/Vars を設定

### 必須Secrets/Vars
- `GITHUB_TOKEN` (Secret)
- `GITHUB_OWNER`
- `GITHUB_REPO`
- `GITHUB_BRANCH` (default: `main`)
- `GITHUB_DB_PATH` (default: `data/reservation-db.json`)
- `ALLOWED_ORIGIN` (推奨)
- `BACKEND_SHARED_KEY` (任意)

## フロント側設定
`localStorage` に `proxyUrl` を指定すると、`github.backend.js` は直接GitHub APIではなくWorkerにPOSTします。
