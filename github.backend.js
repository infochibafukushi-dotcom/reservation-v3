(function(global){
  const DB_VERSION = 1;
  const SETTINGS_KEY = 'chiba_care_taxi_github_backend_v1';

  function nowIso(){ return new Date().toISOString(); }
  function ymdLocal(date){
    const y = date.getFullYear();
    const m = String(date.getMonth()+1).padStart(2,'0');
    const d = String(date.getDate()).padStart(2,'0');
    return `${y}-${m}-${d}`;
  }
  function toYmd(v){
    if (!v && v !== 0) return '';
    if (v instanceof Date) return ymdLocal(v);
    const s = String(v).trim();
    if (!s) return '';
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const dt = new Date(s);
    if (!Number.isNaN(dt.getTime())) return ymdLocal(dt);
    return s;
  }
  function b64DecodeUtf8(str){
    const binary = atob(String(str || '').replace(/\n/g, ''));
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }
  function b64EncodeUtf8(str){
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    bytes.forEach(b => { bin += String.fromCharCode(b); });
    return btoa(bin);
  }

  function loadSettings(){
    let saved = {};
    try{ saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') || {}; }catch(_){ saved = {}; }
    const runtime = global.__GITHUB_BACKEND_SETTINGS__ || {};
    return {
      mode: String(runtime.mode || saved.mode || 'github').toLowerCase(),
      owner: String(runtime.owner || saved.owner || ''),
      repo: String(runtime.repo || saved.repo || ''),
      branch: String(runtime.branch || saved.branch || 'main'),
      token: String(runtime.token || saved.token || ''),
      dbPath: String(runtime.dbPath || saved.dbPath || 'data/reservation-db.json')
    };
  }

  function saveSettings(patch){
    const cur = loadSettings();
    const next = { ...cur, ...(patch || {}) };
    try{ localStorage.setItem(SETTINGS_KEY, JSON.stringify(next)); }catch(_){ }
    return next;
  }

  function inferFromLocation(){
    try{
      const host = String(location.hostname || '');
      if (!host.endsWith('github.io')) return {};
      const owner = host.replace(/\.github\.io$/, '');
      const p = String(location.pathname || '/').replace(/^\/+/, '');
      const repo = p.split('/')[0] || '';
      return { owner, repo };
    }catch(_){ return {}; }
  }

  async function fetchDb(settings){
    const owner = settings.owner;
    const repo = settings.repo;
    const branch = settings.branch;
    const path = settings.dbPath;
    if (!owner || !repo) throw new Error('GitHub owner/repo が未設定です');

    const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path}?ref=${encodeURIComponent(branch)}`;
    const headers = { 'Accept': 'application/vnd.github+json' };
    if (settings.token) headers['Authorization'] = `Bearer ${settings.token}`;

    const res = await fetch(url, { headers, cache: 'no-store' });
    if (res.status === 404) {
      return { sha: '', db: makeDefaultDb() };
    }
    if (!res.ok) {
      throw new Error(`GitHub読込失敗: ${res.status}`);
    }
    const json = await res.json();
    const content = b64DecodeUtf8(json.content || '');
    const db = JSON.parse(content || '{}');
    return { sha: String(json.sha || ''), db: normalizeDb(db) };
  }

  async function saveDb(settings, db, sha, message){
    if (!settings.token) throw new Error('GitHub token が未設定のため保存できません');
    const owner = settings.owner;
    const repo = settings.repo;
    const branch = settings.branch;
    const path = settings.dbPath;
    const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path}`;
    const body = {
      message: message || `data update ${nowIso()}`,
      content: b64EncodeUtf8(JSON.stringify(normalizeDb(db), null, 2)),
      branch
    };
    if (sha) body.sha = sha;

    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${settings.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`GitHub保存失敗: ${res.status} ${txt.slice(0,120)}`);
    }
    return res.json();
  }

  function makeDefaultDb(){
    return normalizeDb({});
  }

  function normalizeDb(db){
    const src = db && typeof db === 'object' ? db : {};
    return {
      version: DB_VERSION,
      updated_at: nowIso(),
      config: src.config && typeof src.config === 'object' ? src.config : {},
      reservations: Array.isArray(src.reservations) ? src.reservations : [],
      blocks: Array.isArray(src.blocks) ? src.blocks : [],
      menu_master: Array.isArray(src.menu_master) ? src.menu_master : [],
      menu_key_catalog: Array.isArray(src.menu_key_catalog) ? src.menu_key_catalog : [],
      menu_group_catalog: Array.isArray(src.menu_group_catalog) ? src.menu_group_catalog : [],
      auto_rule_catalog: Array.isArray(src.auto_rule_catalog) ? src.auto_rule_catalog : []
    };
  }

  function reservationBlocks(r){
    const rt = String(r && r.round_trip || '').trim();
    return (rt === '待機' || rt === '病院付き添い') ? 4 : 2;
  }

  function calcBlockedSlotKeys(db, start, end){
    const out = new Set();
    (db.blocks || []).forEach(b => {
      if (b.is_blocked === false || String(b.is_blocked || '').toUpperCase() === 'FALSE') return;
      const d = toYmd(b.block_date || b.date || b.slot_date);
      const h = Number(b.block_hour ?? b.hour ?? b.slot_hour);
      const m = Number(b.block_minute ?? b.minute ?? b.slot_minute ?? 0);
      if (!d || Number.isNaN(h) || Number.isNaN(m)) return;
      if (start && d < start) return;
      if (end && d > end) return;
      out.add(`${d}-${h}-${m}`);
    });
    (db.reservations || []).forEach(r => {
      if (String(r.status || '') === 'キャンセル') return;
      if (r.is_visible === false || String(r.is_visible || '').toUpperCase() === 'FALSE') return;
      const d = toYmd(r.slot_date);
      const h = Number(r.slot_hour);
      const m = Number(r.slot_minute || 0);
      if (!d || Number.isNaN(h) || Number.isNaN(m)) return;
      const dt = new Date(`${d}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00`);
      const count = reservationBlocks(r);
      for(let i=0;i<count;i++){
        const t = new Date(dt.getTime() + i * 30 * 60 * 1000);
        const ymd = ymdLocal(t);
        if (start && ymd < start) continue;
        if (end && ymd > end) continue;
        out.add(`${ymd}-${t.getHours()}-${t.getMinutes()}`);
      }
    });
    return Array.from(out);
  }

  function withinRange(row, start, end, keys){
    const d = toYmd(keys.map(k => row && row[k]).find(Boolean));
    if (!d) return false;
    if (start && d < start) return false;
    if (end && d > end) return false;
    return true;
  }

  async function run(func, args){
    const settings = { ...inferFromLocation(), ...loadSettings() };
    if (settings.mode !== 'github') throw new Error('GitHub backend mode ではありません');

    if (func === 'api_setGithubBackendSettings') {
      return { isOk: true, data: saveSettings(args && args[0] || {}) };
    }

    const { db, sha } = await fetchDb(settings);

    const resp = data => ({ isOk: true, data });
    if (func === 'api_getConfig' || func === 'api_getConfigPublic') return resp({ ...db.config });
    if (func === 'api_getMenuMaster') return resp(db.menu_master);
    if (func === 'api_getMenuKeyCatalog') return resp(db.menu_key_catalog);
    if (func === 'api_getMenuGroupCatalog') return resp(db.menu_group_catalog);
    if (func === 'api_getAutoRuleCatalog') return resp(db.auto_rule_catalog);

    if (func === 'api_getInitData' || func === 'api_getAdminBootstrap' || func === 'api_getPublicBootstrap' || func === 'api_getPublicBootstrapLite') {
      return resp({
        config: { ...db.config },
        reservations: db.reservations,
        blocks: db.blocks,
        menu_master: db.menu_master,
        menu_key_catalog: db.menu_key_catalog,
        menu_group_catalog: db.menu_group_catalog,
        auto_rule_catalog: db.auto_rule_catalog
      });
    }

    if (func === 'api_getPublicInitLite') {
      const range = args[0] || {};
      const start = String(range.start || '');
      const end = String(range.end || '');
      return resp({ blockedSlotKeys: calcBlockedSlotKeys(db, start, end) });
    }

    if (func === 'api_getBlockedSlotKeys') {
      const range = args[0] || {};
      const start = String(range.start || '');
      const end = String(range.end || '');
      return resp({ blockedSlotKeys: calcBlockedSlotKeys(db, start, end) });
    }

    if (func === 'api_getReservationsRange') {
      const range = args[0] || {};
      const start = String(range.start || '');
      const end = String(range.end || '');
      return resp({ reservations: (db.reservations || []).filter(r => withinRange(r, start, end, ['slot_date','reservation_date','date'])) });
    }

    if (func === 'api_getBlocksRange') {
      const range = args[0] || {};
      const start = String(range.start || '');
      const end = String(range.end || '');
      return resp({ blocks: (db.blocks || []).filter(b => withinRange(b, start, end, ['block_date','date','slot_date'])) });
    }

    if (func === 'api_verifyAdminPassword') {
      const payload = args[0] || {};
      const ok = String(payload.password || '') === String(db.config.admin_password || '95123');
      if (!ok) throw new Error('パスワードが違います');
      return resp({ verified: true });
    }

    if (func === 'api_createReservation') {
      const item = { ...(args[0] || {}) };
      if (!item.reservation_id) throw new Error('reservation_id が必要です');
      const exists = (db.reservations || []).some(r => String(r.reservation_id || '') === String(item.reservation_id));
      if (exists) throw new Error('同じ予約IDが存在します');
      db.reservations.push(item);
      await saveDb(settings, db, sha, `reservation: ${item.reservation_id}`);
      return resp({ reservation_id: item.reservation_id });
    }

    if (func === 'api_updateReservation') {
      const payload = args[0] || {};
      const rid = String(payload.reservation_id || payload.id || '').trim();
      if (!rid) throw new Error('reservation_id が必要です');
      let updated = false;
      db.reservations = (db.reservations || []).map(r => {
        if (String(r.reservation_id || r.id || '').trim() !== rid) return r;
        updated = true;
        return { ...r, ...payload };
      });
      if (!updated) db.reservations.push({ ...payload, reservation_id: rid, id: rid });
      await saveDb(settings, db, sha, `reservation update: ${rid}`);
      return resp({ updated: true });
    }

    if (func === 'api_saveConfig') {
      db.config = { ...(db.config || {}), ...(args[0] || {}) };
      await saveDb(settings, db, sha, 'config update');
      return resp({ saved: true, config: db.config });
    }

    if (func === 'api_changeAdminPassword') {
      const payload = args[0] || {};
      if (!payload.next_password) throw new Error('next_password が必要です');
      db.config = { ...(db.config || {}), admin_password: String(payload.next_password) };
      await saveDb(settings, db, sha, 'admin password update');
      return resp({ saved: true });
    }

    if (func === 'api_saveMenuMaster') {
      const payload = args[0] || {};
      db.menu_master = Array.isArray(payload.items) ? payload.items : (Array.isArray(payload) ? payload : []);
      await saveDb(settings, db, sha, 'menu master update');
      return resp({ saved: true });
    }

    function upsertBlock(ymd,h,m,isBlocked,reason){
      const key = `${ymd}-${h}-${m}`;
      let hit = false;
      db.blocks = (db.blocks || []).map(b => {
        const d = toYmd(b.block_date || b.date || b.slot_date);
        const bh = Number(b.block_hour ?? b.hour ?? b.slot_hour);
        const bm = Number(b.block_minute ?? b.minute ?? b.slot_minute ?? 0);
        if (`${d}-${bh}-${bm}` !== key) return b;
        hit = true;
        return { ...b, slot_key:key, block_key:key, block_date:ymd, block_hour:h, block_minute:m, is_blocked:isBlocked, reason:reason || b.reason || '' };
      });
      if (!hit){
        db.blocks.push({ slot_key:key, block_key:key, block_date:ymd, block_hour:h, block_minute:m, is_blocked:isBlocked, reason:reason || '' });
      }
    }

    if (func === 'api_toggleBlock') {
      const p = args[0] || {};
      upsertBlock(String(p.date || ''), Number(p.hour), Number(p.minute || 0), !!p.isBlocked, p.reason);
      await saveDb(settings, db, sha, 'toggle block');
      return resp({ saved: true });
    }

    if (func === 'api_setRegularDayBlocked' || func === 'api_setOtherTimeDayBlocked') {
      const p = args[0] || {};
      const ymd = String(p.date || '');
      const isBlocked = !!p.isBlocked;
      const slots = [];
      if (func === 'api_setRegularDayBlocked') {
        for(let h=6;h<=21;h++){ slots.push([h,0]); if (h<21) slots.push([h,30]); }
      } else {
        slots.push([21,30]);
        for(let h=22;h<24;h++){ slots.push([h,0],[h,30]); }
        for(let h=0;h<=5;h++){ slots.push([h,0],[h,30]); }
      }
      slots.forEach(([h,m]) => upsertBlock(ymd,h,m,isBlocked,p.reason));
      await saveDb(settings, db, sha, 'set day block');
      return resp({ saved: true });
    }

    throw new Error(`未対応API: ${func}`);
  }

  global.GitHubBackend = {
    run,
    loadSettings,
    saveSettings,
    isEnabled(){
      const s = { ...inferFromLocation(), ...loadSettings() };
      return s.mode === 'github';
    }
  };
})(window);
