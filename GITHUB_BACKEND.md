# GitHubバックエンド移行メモ（GAS非依存）

このリポジトリは `github.backend.js` により、Google Apps Script を使わず GitHub Contents API 上のJSONをデータベースとして動作できます。

## 保存先
- 既定: `data/reservation-db.json`
- 管理項目:
  - `config`
  - `reservations`
  - `blocks`
  - `menu_master`
  - `menu_key_catalog`
  - `menu_group_catalog`
  - `auto_rule_catalog`

## 必須設定
GitHub API書き込みにはトークンが必要です。ブラウザコンソールで以下を実行してください。

```js
localStorage.setItem('chiba_care_taxi_github_backend_v1', JSON.stringify({
  mode: 'github',
  owner: 'YOUR_GITHUB_OWNER',
  repo: 'YOUR_REPO',
  branch: 'main',
  dbPath: 'data/reservation-db.json',
  token: 'ghp_xxx'
}));
```

## 注意点
- 公開ページからの予約送信も同じGitHub tokenを使って書き込みます。
- トークン露出リスクがあるため、本番運用では GitHub App + 中継API（Cloudflare Workers等）推奨です。
- 現段階は「GASを使わず、既存UI/機能をGitHubストレージで再現する」ための実装です。

---

## 本番推奨: Proxyモード（ブラウザにGitHub tokenを置かない）

`proxy.cloudflare-worker.js` を Cloudflare Workers にデプロイし、Worker側の Secret に `GITHUB_TOKEN` を保存してください。  
フロント側は token ではなく `proxyUrl`（必要なら `proxyKey`）のみを持ちます。

### フロント設定（例）

```js
localStorage.setItem('chiba_care_taxi_github_backend_v1', JSON.stringify({
  mode: 'github',
  owner: 'YOUR_GITHUB_OWNER',
  repo: 'YOUR_REPO',
  branch: 'main',
  dbPath: 'data/reservation-db.json',
  proxyUrl: 'https://YOUR_WORKER_DOMAIN.example.workers.dev',
  proxyKey: 'optional-shared-key'
}));
```

### Worker環境変数/Secret（例）
- `GITHUB_TOKEN` (Secret)
- `GITHUB_OWNER`
- `GITHUB_REPO`
- `GITHUB_BRANCH` (`main`)
- `GITHUB_DB_PATH` (`data/reservation-db.json`)
- `ALLOWED_ORIGIN` (例: `https://YOUR_USER.github.io`)
- `BACKEND_SHARED_KEY` (任意)

### 期待効果
- GitHub tokenがブラウザ/DevTools/LocalStorageに露出しない
- 既存フロントAPI契約を維持したまま、GAS非依存運用を継続できる
