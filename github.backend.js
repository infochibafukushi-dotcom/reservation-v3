// GitHub backend shared key helper
// 既存ロジックは変更せず、キーのみ統一
(function () {
  const STORAGE_KEY = 'chiba_care_taxi_github_backend_v1';

  function getToken() {
    return localStorage.getItem(STORAGE_KEY) || '';
  }

  function setToken(token) {
    localStorage.setItem(STORAGE_KEY, token || '');
  }

  window.GitHubBackendKey = {
    STORAGE_KEY,
    getToken,
    setToken,
  };
})();
