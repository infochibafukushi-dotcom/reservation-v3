export default {
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return json({ isOk: false, error: 'Method Not Allowed' }, 405);
    }

    const allowedOrigin = String(env.ALLOWED_ORIGIN || '*').trim();
    const origin = request.headers.get('Origin') || '';
    if (allowedOrigin !== '*' && origin && origin !== allowedOrigin) {
      return json({ isOk: false, error: 'Origin not allowed' }, 403);
    }

    const backendKey = String(env.BACKEND_SHARED_KEY || '').trim();
    if (backendKey) {
      const reqKey = String(request.headers.get('x-backend-key') || '').trim();
      if (!reqKey || reqKey !== backendKey) {
        return json({ isOk: false, error: 'Unauthorized' }, 401);
      }
    }

    let body = {};
    try {
      body = await request.json();
    } catch (_) {
      return json({ isOk: false, error: 'Invalid JSON body' }, 400);
    }

    const func = String(body.func || '').trim();
    const args = Array.isArray(body.args) ? body.args : [];
    const settings = body.settings || {};
    const owner = String(settings.owner || env.GITHUB_OWNER || '').trim();
    const repo = String(settings.repo || env.GITHUB_REPO || '').trim();
    const branch = String(settings.branch || env.GITHUB_BRANCH || 'main').trim();
    const dbPath = String(settings.dbPath || env.GITHUB_DB_PATH || 'data/reservation-db.json').trim();

    if (!owner || !repo) return json({ isOk: false, error: 'owner/repo missing' }, 400);

    try {
      const result = await runAction(env, { func, args, owner, repo, branch, dbPath });
      const response = json(result, 200);
      if (origin) response.headers.set('Access-Control-Allow-Origin', allowedOrigin === '*' ? origin : allowedOrigin);
      response.headers.set('Vary', 'Origin');
      return response;
    } catch (e) {
      return json({ isOk: false, error: String(e && e.message ? e.message : e) }, 500);
    }
  }
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}

function nowIso(){ return new Date().toISOString(); }
function ymdLocal(date){
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
function toYmd(v){
  if (!v && v !== 0) return '';
  const s = String(v).trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const dt = new Date(s);
  if (!Number.isNaN(dt.getTime())) return ymdLocal(dt);
  return s;
}

const DEFAULT_MENU_GROUP_CATALOG = [
  { key: 'price', label: '料金概算（基本料金）' },
  { key: 'assistance', label: '介助内容' },
  { key: 'stair', label: '階段介助' },
  { key: 'equipment', label: '機材レンタル' },
  { key: 'round_trip', label: '往復送迎' },
  { key: 'move_type', label: '移動方法' },
  { key: 'custom', label: 'その他（表示先なし）' },
  { key: 'auto_set', label: '自動セット' }
];

const DEFAULT_MENU_MASTER = [
  { key: 'BASE_FARE', label: '運賃(初乗り)', price: 730, note: '「から」表記', is_visible: true, sort_order: 10, menu_group: 'price' },
  { key: 'DISPATCH', label: '配車予約', price: 800, note: '', is_visible: true, sort_order: 20, menu_group: 'price' },
  { key: 'SPECIAL_VEHICLE', label: '特殊車両使用料', price: 1000, note: '', is_visible: true, sort_order: 30, menu_group: 'price' },
  { key: 'BOARDING_ASSIST', label: '乗降介助', price: 1400, note: '玄関から車両への車いす等固定まで', is_visible: true, sort_order: 100, menu_group: 'assistance' },
  { key: 'BODY_ASSIST', label: '身体介助', price: 3000, note: 'お部屋から車両への車いす等固定まで', is_visible: true, sort_order: 110, menu_group: 'assistance' },
  { key: 'STAIR_NONE', label: '不要', price: 0, note: '', is_visible: true, sort_order: 200, menu_group: 'stair' },
  { key: 'STAIR_WATCH', label: '見守り介助', price: 0, note: '自力歩行可能で手を握る介助', is_visible: true, sort_order: 210, menu_group: 'stair' },
  { key: 'STAIR_2F', label: '2階移動', price: 6000, note: '', is_visible: true, sort_order: 220, menu_group: 'stair', auto_apply_group: 'assistance', auto_apply_key: 'BODY_ASSIST' },
  { key: 'STAIR_3F', label: '3階移動', price: 9000, note: '', is_visible: true, sort_order: 230, menu_group: 'stair', auto_apply_group: 'assistance', auto_apply_key: 'BODY_ASSIST' },
  { key: 'EQUIP_WHEELCHAIR', label: '車いすレンタル', price: 0, note: '', is_visible: true, sort_order: 300, menu_group: 'equipment' },
  { key: 'EQUIP_RECLINING', label: 'リクライニング車いすレンタル', price: 2500, note: '', is_visible: true, sort_order: 310, menu_group: 'equipment' },
  { key: 'EQUIP_STRETCHER', label: 'ストレッチャーレンタル', price: 5000, note: '', is_visible: true, sort_order: 320, menu_group: 'equipment', auto_apply_group: 'assistance', auto_apply_key: 'BODY_ASSIST', auto_apply_group_2: 'equipment', auto_apply_key_2: 'EQUIP_STRETCHER_STAFF2' },
  { key: 'EQUIP_OWN_WHEELCHAIR', label: 'ご自身車いす', price: 0, note: '', is_visible: true, sort_order: 330, menu_group: 'equipment' },
  { key: 'EQUIP_STRETCHER_STAFF2', label: 'ストレッチャー2名体制介助料', price: 5000, note: '', is_visible: true, sort_order: 340, menu_group: 'auto_set' },
  { key: 'ROUND_NONE', label: '不要', price: 0, note: '', is_visible: true, sort_order: 400, menu_group: 'round_trip' },
  { key: 'ROUND_STANDBY', label: '待機', price: 800, note: '「から/30分毎」', is_visible: true, sort_order: 410, menu_group: 'round_trip' },
  { key: 'ROUND_HOSPITAL', label: '病院付き添い', price: 1600, note: '「から/30分毎」', is_visible: true, sort_order: 420, menu_group: 'round_trip' },
  { key: 'MOVE_WHEELCHAIR', label: '無料車いす', price: 0, note: '', is_visible: true, sort_order: 500, menu_group: 'move_type' },
  { key: 'MOVE_RECLINING', label: 'リクライニング車いす', price: 0, note: '', is_visible: true, sort_order: 510, menu_group: 'move_type' },
  { key: 'MOVE_STRETCHER', label: 'ストレッチャー', price: 0, note: '', is_visible: true, sort_order: 520, menu_group: 'move_type' },
  { key: 'MOVE_OWN', label: 'ご自身の車いす', price: 0, note: '', is_visible: true, sort_order: 530, menu_group: 'move_type' }
];

function normalizeDb(db){
  const src = db && typeof db === 'object' ? db : {};
  const menuMaster = Array.isArray(src.menu_master) && src.menu_master.length ? src.menu_master : DEFAULT_MENU_MASTER;
  const menuGroupCatalog = Array.isArray(src.menu_group_catalog) && src.menu_group_catalog.length ? src.menu_group_catalog : DEFAULT_MENU_GROUP_CATALOG;
  const menuKeyCatalog = Array.isArray(src.menu_key_catalog) && src.menu_key_catalog.length
    ? src.menu_key_catalog
    : menuMaster.map(item => ({ key: item.key, key_jp: item.label, menu_group: item.menu_group, default_label: item.label, default_price: Number(item.price || 0), required_flag: false, auto_apply_group: item.auto_apply_group || '', auto_apply_key: item.auto_apply_key || '', auto_apply_group_2: item.auto_apply_group_2 || '', auto_apply_key_2: item.auto_apply_key_2 || '' }));
  return {
    version: 1,
    updated_at: nowIso(),
    config: src.config && typeof src.config === 'object' ? src.config : { admin_password: '95123', same_day_enabled: '0', same_day_min_hours: '3', logo_use_github_image: '1' },
    reservations: Array.isArray(src.reservations) ? src.reservations : [],
    blocks: Array.isArray(src.blocks) ? src.blocks : [],
    menu_master: menuMaster,
    menu_key_catalog: menuKeyCatalog,
    menu_group_catalog: menuGroupCatalog,
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
    for (let i = 0; i < reservationBlocks(r); i++) {
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

async function githubRead(env, owner, repo, branch, dbPath){
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${dbPath}?ref=${encodeURIComponent(branch)}`;
  const res = await fetch(url, {
    headers: {
      'Accept': 'application/vnd.github+json',
      'Authorization': `Bearer ${env.GITHUB_TOKEN}`
    }
  });
  if (res.status === 404) return { sha: '', db: normalizeDb({}) };
  if (!res.ok) throw new Error(`GitHub read failed: ${res.status}`);
  const json = await res.json();
  const content = atob(String(json.content || '').replace(/\n/g, ''));
  return { sha: String(json.sha || ''), db: normalizeDb(JSON.parse(content || '{}')) };
}

async function githubWrite(env, owner, repo, branch, dbPath, db, sha, message){
  const content = btoa(unescape(encodeURIComponent(JSON.stringify(normalizeDb(db), null, 2))));
  const body = { message, content, branch };
  if (sha) body.sha = sha;
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${dbPath}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Accept': 'application/vnd.github+json',
      'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`GitHub write failed: ${res.status} ${txt.slice(0, 140)}`);
  }
}

async function runAction(env, ctx){
  const { func, args, owner, repo, branch, dbPath } = ctx;
  const { db, sha } = await githubRead(env, owner, repo, branch, dbPath);
  const resp = data => ({ isOk: true, data });

  if (func === 'api_getConfig' || func === 'api_getConfigPublic') return resp({ ...db.config });
  if (func === 'api_getMenuMaster') return resp(db.menu_master);
  if (func === 'api_getMenuKeyCatalog') return resp(db.menu_key_catalog);
  if (func === 'api_getMenuGroupCatalog') return resp(db.menu_group_catalog);
  if (func === 'api_getAutoRuleCatalog') return resp(db.auto_rule_catalog);

  if (func === 'api_getInitData' || func === 'api_getAdminBootstrap' || func === 'api_getPublicBootstrap' || func === 'api_getPublicBootstrapLite') {
    return resp({ config: { ...db.config }, reservations: db.reservations, blocks: db.blocks, menu_master: db.menu_master, menu_key_catalog: db.menu_key_catalog, menu_group_catalog: db.menu_group_catalog, auto_rule_catalog: db.auto_rule_catalog });
  }

  if (func === 'api_getPublicInitLite' || func === 'api_getBlockedSlotKeys') {
    const range = args[0] || {};
    const start = String(range.start || '');
    const end = String(range.end || '');
    const slotKeys = calcBlockedSlotKeys(db, start, end);
    return resp({ start, end, slot_keys: slotKeys, keys: slotKeys, config: { ...db.config } });
  }

  if (func === 'api_getReservationsRange') {
    const range = args[0] || {};
    return resp({ reservations: (db.reservations || []).filter(r => withinRange(r, String(range.start || ''), String(range.end || ''), ['slot_date', 'reservation_date', 'date'])) });
  }
  if (func === 'api_getBlocksRange') {
    const range = args[0] || {};
    return resp({ blocks: (db.blocks || []).filter(b => withinRange(b, String(range.start || ''), String(range.end || ''), ['block_date', 'date', 'slot_date'])) });
  }

  if (func === 'api_verifyAdminPassword') {
    const payload = args[0] || {};
    const ok = String(payload.password || '') === String(db.config.admin_password || '95123');
    if (!ok) throw new Error('パスワードが違います');
    return resp({ verified: true });
  }

  if (func === 'api_createReservation') {
    const item = { ...(args[0] || {}) };
    if (!item.reservation_id) throw new Error('reservation_id required');
    if ((db.reservations || []).some(r => String(r.reservation_id || '') === String(item.reservation_id))) throw new Error('reservation already exists');
    db.reservations.push(item);
    await githubWrite(env, owner, repo, branch, dbPath, db, sha, `reservation: ${item.reservation_id}`);
    return resp({ reservation_id: item.reservation_id });
  }

  if (func === 'api_updateReservation') {
    const payload = args[0] || {};
    const rid = String(payload.reservation_id || payload.id || '').trim();
    if (!rid) throw new Error('reservation_id required');
    let updated = false;
    db.reservations = (db.reservations || []).map(r => {
      if (String(r.reservation_id || r.id || '').trim() !== rid) return r;
      updated = true;
      return { ...r, ...payload };
    });
    if (!updated) db.reservations.push({ ...payload, reservation_id: rid, id: rid });
    await githubWrite(env, owner, repo, branch, dbPath, db, sha, `reservation update: ${rid}`);
    return resp({ updated: true });
  }

  if (func === 'api_saveConfig') {
    db.config = { ...(db.config || {}), ...(args[0] || {}) };
    await githubWrite(env, owner, repo, branch, dbPath, db, sha, 'config update');
    return resp({ saved: true, config: db.config });
  }

  if (func === 'api_changeAdminPassword') {
    const payload = args[0] || {};
    const current = String(payload.current_password || '');
    const nextPw = String(payload.new_password || payload.next_password || '');
    const saved = String((db.config && db.config.admin_password) || '95123');
    if (current !== saved) throw new Error('現在のパスワードが一致しません');
    if (!nextPw) throw new Error('new_password required');
    db.config = { ...(db.config || {}), admin_password: nextPw };
    await githubWrite(env, owner, repo, branch, dbPath, db, sha, 'admin password update');
    return resp({ saved: true });
  }

  function upsertBlock(ymd, h, m, isBlocked, reason) {
    const key = `${ymd}-${h}-${m}`;
    let hit = false;
    db.blocks = (db.blocks || []).map(b => {
      const d = toYmd(b.block_date || b.date || b.slot_date);
      const bh = Number(b.block_hour ?? b.hour ?? b.slot_hour);
      const bm = Number(b.block_minute ?? b.minute ?? b.slot_minute ?? 0);
      if (`${d}-${bh}-${bm}` !== key) return b;
      hit = true;
      return { ...b, slot_key: key, block_key: key, block_date: ymd, block_hour: h, block_minute: m, is_blocked: isBlocked, reason: reason || b.reason || '' };
    });
    if (!hit) db.blocks.push({ slot_key: key, block_key: key, block_date: ymd, block_hour: h, block_minute: m, is_blocked: isBlocked, reason: reason || '' });
  }

  if (func === 'api_toggleBlock') {
    const p = args[0] || {};
    const ymd = String(p.dateStr || p.date || '');
    const hour = Number(p.hour);
    const minute = Number(p.minute || 0);
    const key = `${ymd}-${hour}-${minute}`;
    const before = (db.blocks || []).find(b => {
      const d = toYmd(b.block_date || b.date || b.slot_date);
      const h = Number(b.block_hour ?? b.hour ?? b.slot_hour);
      const m = Number(b.block_minute ?? b.minute ?? b.slot_minute ?? 0);
      return `${d}-${h}-${m}` === key;
    });
    const nextBlocked = p.isBlocked === undefined ? !(before && (before.is_blocked === true || String(before.is_blocked || '').toUpperCase() !== 'FALSE')) : !!p.isBlocked;
    upsertBlock(ymd, hour, minute, nextBlocked, p.reason);
    await githubWrite(env, owner, repo, branch, dbPath, db, sha, 'toggle block');
    return resp({ saved: true, is_blocked: nextBlocked });
  }

  if (func === 'api_setRegularDayBlocked' || func === 'api_setOtherTimeDayBlocked') {
    const p = args[0] || {};
    const ymd = String(p.dateStr || p.date || '');
    const isBlocked = !!p.isBlocked;
    const slots = [];
    if (func === 'api_setRegularDayBlocked') {
      for (let h = 6; h <= 21; h++) { slots.push([h, 0]); if (h < 21) slots.push([h, 30]); }
    } else {
      slots.push([21, 30]);
      for (let h = 22; h < 24; h++) slots.push([h, 0], [h, 30]);
      for (let h = 0; h <= 5; h++) slots.push([h, 0], [h, 30]);
    }
    slots.forEach(([h, m]) => upsertBlock(ymd, h, m, isBlocked, p.reason));
    await githubWrite(env, owner, repo, branch, dbPath, db, sha, 'set day block');
    return resp({ saved: true });
  }

  throw new Error(`unsupported func: ${func}`);
}
