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
