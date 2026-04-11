/***** ちばケアタクシー予約：Code_Core.gs
  改善版・分割2/2
  役割:
  - Core
  - Slot Definitions
  - Helpers
  - Config / PriceMaster 保守
  - GitHub helper
  - ログ
  - バリデーション
*****/

// ===== Core =====
function _setDayBlockedBySlots_(ymd, isBlocked, slots, reasonOn, reasonOff) {
  const sheet = _sh(SHEETS.BLOCK);
  if (!sheet) throw new Error('ブロックシートが見つかりません');

  const hm = _headerMap(sheet);
  const headers = hm.headers;
  const map = hm.map;

  const colSlotKey   = map['slot_key'] ?? map['key'] ?? map['block_key'] ?? null;
  const colDate      = map['date'] ?? map['block_date'] ?? map['slot_date'] ?? null;
  const colHour      = map['slot_hour'] ?? map['hour'] ?? map['block_hour'] ?? null;
  const colMinute    = map['slot_minute'] ?? map['minute'] ?? map['block_minute'] ?? null;
  const colIsBlocked = map['is_blocked'] ?? map['blocked'] ?? map['isBlocked'] ?? null;
  const colReason    = map['reason'] ?? null;
  const colCreatedAt = map['created_at'] ?? null;
  const colUpdatedAt = map['updated_at'] ?? null;

  if (!colIsBlocked) throw new Error('ブロックシートに is_blocked 列がありません');

  const makeKey = function(d, h, m) {
    return d + '-' + h + '-' + m;
  };

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  const values = (lastRow >= 1)
    ? sheet.getRange(1, 1, lastRow, lastCol).getValues()
    : [headers];

  const keyToRow = new Map();
  if (lastRow >= 2) {
    for (let r = 2; r <= lastRow; r++) {
      const row = values[r - 1];

      let k = colSlotKey ? String(row[colSlotKey - 1] || '').trim() : '';

      if (!k) {
        const d = colDate ? _normalizeYMD(row[colDate - 1]) : '';
        const h = colHour ? Number(row[colHour - 1]) : NaN;
        const m = colMinute ? Number(row[colMinute - 1]) : 0;
        if (d && !Number.isNaN(h)) k = makeKey(d, h, m);
      }
      if (k) keyToRow.set(k, r);
    }
  }

  const now = new Date();
  const toWrite = [];
  const appendRows = [];

  for (let i = 0; i < slots.length; i++) {
    const h = slots[i].h;
    const m = slots[i].m;
    const key = makeKey(ymd, h, m);
    const existRow = keyToRow.get(key);

    if (isBlocked) {
      if (existRow) {
        if (colSlotKey)   toWrite.push({ row: existRow, col: colSlotKey,   val: key });
        if (colDate)      toWrite.push({ row: existRow, col: colDate,      val: ymd });
        if (colHour)      toWrite.push({ row: existRow, col: colHour,      val: h });
        if (colMinute)    toWrite.push({ row: existRow, col: colMinute,    val: m });
        toWrite.push({ row: existRow, col: colIsBlocked, val: true });

        if (colReason)    toWrite.push({ row: existRow, col: colReason,    val: reasonOn });
        if (colUpdatedAt) toWrite.push({ row: existRow, col: colUpdatedAt, val: now });

        if (colCreatedAt) {
          const cur = values[existRow - 1][colCreatedAt - 1];
          if (!cur) toWrite.push({ row: existRow, col: colCreatedAt, val: now });
        }
      } else {
        const obj = {};
        for (let j = 0; j < headers.length; j++) obj[headers[j]] = '';

        obj['slot_key'] = key; obj['key'] = key; obj['block_key'] = key;
        obj['date'] = ymd; obj['block_date'] = ymd; obj['slot_date'] = ymd;
        obj['slot_hour'] = h; obj['hour'] = h; obj['block_hour'] = h;
        obj['slot_minute'] = m; obj['minute'] = m; obj['block_minute'] = m;

        obj['is_blocked'] = true; obj['blocked'] = true;
        obj['reason'] = reasonOn;
        obj['created_at'] = now;
        obj['updated_at'] = now;

        appendRows.push(headers.map(function(hd) {
          return obj[hd] !== undefined ? obj[hd] : (obj[String(hd).toLowerCase().replace(/\s+/g, '')] ?? '');
        }));
      }
    } else {
      if (existRow) {
        toWrite.push({ row: existRow, col: colIsBlocked, val: false });
        if (colReason)    toWrite.push({ row: existRow, col: colReason, val: reasonOff });
        if (colUpdatedAt) toWrite.push({ row: existRow, col: colUpdatedAt, val: now });
      }
    }
  }

  if (toWrite.length) {
    const byRow = new Map();
    for (let i = 0; i < toWrite.length; i++) {
      const u = toWrite[i];
      if (!byRow.has(u.row)) byRow.set(u.row, {});
      byRow.get(u.row)[u.col] = u.val;
    }

    const rows = Array.from(byRow.keys()).sort(function(a, b) { return a - b; });
    for (let i = 0; i < rows.length; i++) {
      const rowNum = rows[i];
      const updates = byRow.get(rowNum) || {};
      const rowValues = values[rowNum - 1] ? values[rowNum - 1].slice() : new Array(lastCol).fill('');

      Object.keys(updates).forEach(function(colKey) {
        const col = Number(colKey);
        if (!Number.isFinite(col) || col < 1 || col > lastCol) return;
        rowValues[col - 1] = updates[colKey];
      });

      sheet.getRange(rowNum, 1, 1, lastCol).setValues([rowValues]);
    }
  }

  if (appendRows.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, appendRows.length, appendRows[0].length).setValues(appendRows);
  }

  return _ok({
    date: ymd,
    isBlocked: isBlocked,
    updated: toWrite.length,
    appended: appendRows.length
  });
}

// ===== Slot Definitions =====
function _slots_entireDay() {
  const out = [];
  for (let h = 0; h < 24; h++) {
    out.push({ h: h, m: 0 });
    out.push({ h: h, m: 30 });
  }
  return out;
}

function _slots_regular() {
  const out = [];
  for (let h = 6; h <= 21; h++) {
    out.push({ h: h, m: 0 });
    if (h < 21) out.push({ h: h, m: 30 });
  }
  return out;
}

function _slots_otherTime() {
  const out = [];
  out.push({ h: 21, m: 30 });
  for (let h = 22; h < 24; h++) {
    out.push({ h: h, m: 0 });
    out.push({ h: h, m: 30 });
  }
  for (let h = 0; h <= 5; h++) {
    out.push({ h: h, m: 0 });
    out.push({ h: h, m: 30 });
  }
  return out;
}

// ===== Helpers =====
function _ss() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function _sh(name) {
  return _ss().getSheetByName(name);
}

function _ok(data) {
  return { isOk: true, data: data };
}

function _ng(e) {
  return { isOk: false, error: String(e && e.message ? e.message : e) };
}

function _fmtYMD(d) {
  return Utilities.formatDate(d, TZ, 'yyyy-MM-dd');
}

function _toDate(dateStr, hour, minute) {
  const parts = String(dateStr).split('-').map(Number);
  return new Date(parts[0], (parts[1] - 1), parts[2], Number(hour), Number(minute || 0), 0, 0);
}

function _toBool(v) {
  if (v === true) return true;
  if (v === false) return false;
  const s = String(v || '').trim().toLowerCase();
  return (s === 'true' || s === '1' || s === 'yes' || s === 'y' || s === 'on');
}

function _cellToPlain(v) {
  if (v instanceof Date) return _fmtYMD(v);
  return v;
}

function _normalizeYMD(v) {
  if (v instanceof Date) return _fmtYMD(v);
  const s = String(v || '').trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);

  const m = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (m) {
    const yy = m[1];
    const mm = String(Number(m[2])).padStart(2, '0');
    const dd = String(Number(m[3])).padStart(2, '0');
    return yy + '-' + mm + '-' + dd;
  }

  const dt = new Date(s);
  if (!isNaN(dt.getTime())) return _fmtYMD(dt);
  return s;
}

function _headerMap(sheet) {
  const lastCol = sheet.getLastColumn();
  const headersRaw = lastCol > 0 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0] : [];

  const headers = headersRaw.map(function(h) {
    return String(h || '').trim();
  });

  const map = {};
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    const norm = h.toLowerCase().replace(/\s+/g, '');
    if (norm) map[norm] = i + 1;
    if (h) map[h] = i + 1;
  }

  return { headers: headers, map: map };
}

function _normalizedKey_(s) {
  return String(s || '').trim().toLowerCase().replace(/\s+/g, '').replace(/[\-_]/g, '');
}

function _reservationHeaderAliases_() {
  return {
    reservation_id: ['reservation_id', 'reservationid', 'id', '予約id', '予約ID'],
    reservation_datetime: ['reservation_datetime', 'reservationdatetime', '予約日時', 'datetime', 'date_time'],
    usage_type: ['usage_type', 'usagetype', '区分', 'ご利用区分'],
    customer_name: ['customer_name', 'customername', 'name', 'お名前', '名前'],
    phone_number: ['phone_number', 'phonenumber', 'phone', 'tel', 'telephone', '連絡先', '電話番号'],
    pickup_location: ['pickup_location', 'pickuplocation', 'pickup', 'お伺い先', 'お伺い場所', '迎車地', '出発地'],
    destination: ['destination', '送迎先', '目的地'],
    assistance_type: ['assistance_type', 'assistancetype', '介助内容'],
    stair_assistance: ['stair_assistance', 'stairassistance', '階段介助'],
    equipment_rental: ['equipment_rental', 'equipmentrental', 'equipment', '機材', '移動方法', 'move_type', 'movetype'],
    stretcher_two_staff: ['stretcher_two_staff', 'stretchertwostaff', 'two_staff', 'twostaff', '2名体制', '二名体制'],
    round_trip: ['round_trip', 'roundtrip', '往復', '往復送迎'],
    notes: ['notes', 'note', '備考', 'お問い合わせ', 'お問い先'],
    total_price: ['total_price', 'totalprice', 'price', '料金', '金額'],
    status: ['status', 'ステータス'],
    slot_date: ['slot_date', 'slotdate', 'date', '予約日', '日付'],
    slot_hour: ['slot_hour', 'slothour', 'hour', '時', '予約時'],
    slot_minute: ['slot_minute', 'slotminute', 'minute', '分'],
    is_visible: ['is_visible', 'isvisible', 'visible', '表示'],
    created_at: ['created_at', 'createdat', '作成日時'],
    updated_at: ['updated_at', 'updatedat', '更新日時']
  };
}

function _getCanonicalReservationKey_(key) {
  const norm = _normalizedKey_(key);
  if (!norm) return '';
  const aliasMap = _reservationHeaderAliases_();
  for (const canonical in aliasMap) {
    const aliases = aliasMap[canonical] || [];
    for (let i = 0; i < aliases.length; i++) {
      if (_normalizedKey_(aliases[i]) === norm) return canonical;
    }
  }
  return '';
}

function _buildReservationCanonicalObject_(obj) {
  const src = obj || {};
  const out = {};
  for (const k in src) out[k] = src[k];

  for (const k in src) {
    const canonical = _getCanonicalReservationKey_(k);
    if (!canonical) continue;
    if (out[canonical] === undefined || out[canonical] === '') out[canonical] = src[k];
  }

  if ((out.slot_date === undefined || out.slot_date === '') && src.date !== undefined) out.slot_date = src.date;
  if ((out.slot_hour === undefined || out.slot_hour === '') && src.hour !== undefined) out.slot_hour = src.hour;
  if ((out.slot_minute === undefined || out.slot_minute === '') && src.minute !== undefined) out.slot_minute = src.minute;
  if ((out.reservation_id === undefined || out.reservation_id === '') && src.id !== undefined) out.reservation_id = src.id;
  if ((out.customer_name === undefined || out.customer_name === '') && src.name !== undefined) out.customer_name = src.name;
  if ((out.phone_number === undefined || out.phone_number === '') && src.phone !== undefined) out.phone_number = src.phone;
  if ((out.pickup_location === undefined || out.pickup_location === '') && src.pickup !== undefined) out.pickup_location = src.pickup;

  if ((out.slot_date !== undefined && out.slot_date !== '') && (out.slot_hour !== undefined && out.slot_hour !== '')) {
    const hh = String(Number(out.slot_hour || 0)).padStart(2, '0');
    const mm = String(Number(out.slot_minute || 0)).padStart(2, '0');
    if (out.reservation_datetime === undefined || out.reservation_datetime === '') {
      out.reservation_datetime = String(out.slot_date) + ' ' + hh + ':' + mm;
    }
    if (out.date === undefined || out.date === '') out.date = out.slot_date;
    if (out.hour === undefined || out.hour === '') out.hour = Number(out.slot_hour || 0);
    if (out.minute === undefined || out.minute === '') out.minute = Number(out.slot_minute || 0);
  }

  if (out.reservation_id !== undefined && (out.id === undefined || out.id === '')) out.id = out.reservation_id;
  if (out.customer_name !== undefined && (out.name === undefined || out.name === '')) out.name = out.customer_name;
  if (out.phone_number !== undefined && (out.phone === undefined || out.phone === '')) out.phone = out.phone_number;
  if (out.pickup_location !== undefined && (out.pickup === undefined || out.pickup === '')) out.pickup = out.pickup_location;

  return out;
}

function _isReservationSheet_(sheet) {
  try {
    return !!sheet && String(sheet.getName() || '').trim() === String(SHEETS.RESERVATIONS || '').trim();
  } catch (e) {
    return false;
  }
}

function _ensureReservationSheetSchema_(sheet) {
  if (!_isReservationSheet_(sheet)) return;

  const required = [
    'reservation_id', 'reservation_datetime', 'usage_type', 'customer_name', 'phone_number',
    'pickup_location', 'destination', 'assistance_type', 'stair_assistance', 'equipment_rental',
    'stretcher_two_staff', 'round_trip', 'notes', 'total_price', 'status',
    'slot_date', 'slot_hour', 'slot_minute', 'is_visible', 'created_at', 'updated_at'
  ];

  const hm = _headerMap(sheet);
  const headers = hm.headers.slice();
  const existingNorms = new Set(headers.map(function(h) { return _normalizedKey_(h); }).filter(Boolean));
  const toAdd = [];

  required.forEach(function(h) {
    const aliases = _reservationHeaderAliases_()[h] || [h];
    const exists = aliases.some(function(a) { return existingNorms.has(_normalizedKey_(a)); });
    if (!exists) toAdd.push(h);
  });

  if (!toAdd.length) return;

  const startCol = Math.max(sheet.getLastColumn(), 0) + 1;
  sheet.getRange(1, startCol, 1, toAdd.length).setValues([toAdd]);
}


function _getSchemaReadyFlag_(name) {
  const props = PropertiesService.getScriptProperties();
  const key = 'schema_ready_' + String(name || '').trim();
  return String(props.getProperty(key) || '') === '1';
}

function _setSchemaReadyFlag_(name, value) {
  const props = PropertiesService.getScriptProperties();
  const key = 'schema_ready_' + String(name || '').trim();
  props.setProperty(key, value ? '1' : '0');
}

function _isConfigSheetHeaderValid_(sheet) {
  if (!sheet) return false;
  if (sheet.getLastRow() < 1 || sheet.getLastColumn() < 2) return false;
  const a1 = String(sheet.getRange(1, 1).getValue() || '').trim();
  const b1 = String(sheet.getRange(1, 2).getValue() || '').trim();
  return a1 === 'key' && b1 === 'value';
}

function _isPriceMasterHeaderValid_(sheet) {
  if (!sheet) return false;
  const required = ['key', 'key_jp', 'label', 'price', 'note', 'is_visible', 'sort_order', 'menu_group', 'required_flag', 'auto_apply_group', 'auto_apply_key', 'auto_apply_group_2', 'auto_apply_key_2'];
  if (sheet.getLastRow() < 1 || sheet.getLastColumn() < required.length) return false;
  const headers = sheet.getRange(1, 1, 1, required.length).getValues()[0].map(function(v) {
    return String(v || '').trim();
  });
  for (var i = 0; i < required.length; i++) {
    if (headers[i] !== required[i]) return false;
  }
  return true;
}

function _readConfigSheetFast_() {
  const sheet = _sh(SHEETS.CONFIG);
  if (!sheet) return _clone_(DEFAULT_CONFIG);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return _clone_(DEFAULT_CONFIG);

  const keys = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  const vals = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
  const out = _clone_(DEFAULT_CONFIG);

  for (var i = 0; i < keys.length; i++) {
    const key = String(keys[i][0] || '').trim();
    if (!key || key === 'key' || key === '項目') continue;
    out[key] = _cellToPlain(vals[i][0]);
  }

  out.slot_minutes = String(out.slot_minutes || '30');
  out.same_day_enabled = _toBool(out.same_day_enabled) ? '1' : '0';
  out.same_day_min_hours = String(Number(out.same_day_min_hours || 3));
  out.logo_use_drive_image = _toBool(out.logo_use_drive_image) ? '1' : '0';
  out.logo_use_github_image = _toBool(out.logo_use_github_image) ? '1' : '0';
  out.admin_tap_count = String(out.admin_tap_count || '5');
  out.days_per_page = String(Math.max(1, Number(out.days_per_page || 7)));
  out.max_forward_days = String(Math.max(1, Number(out.max_forward_days || '30')));
  out.rule_force_body_assist_on_stair = _toBool(out.rule_force_body_assist_on_stair) ? '1' : '0';
  out.rule_force_body_assist_on_stretcher = _toBool(out.rule_force_body_assist_on_stretcher) ? '1' : '0';
  out.rule_force_stretcher_staff2_on_stretcher = _toBool(out.rule_force_stretcher_staff2_on_stretcher) ? '1' : '0';
  out.admin_panels_collapsed_default = _toBool(out.admin_panels_collapsed_default) ? '1' : '0';

  for (var j = 1; j <= 6; j++) {
    out['auto_rule_enabled_' + j] = _toBool(out['auto_rule_enabled_' + j]) ? '1' : '0';
  }

  return out;
}

function _readMenuMasterFast_() {
  const sheet = _sh(SHEETS.PRICE_MASTER);
  if (!sheet) return [];

  const hm = _headerMap(sheet);
  const map = hm.map;
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return [];

  const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  const out = values.map(function(row) {
    const keyIdx = map['key'] ? (map['key'] - 1) : -1;
    const keyJpIdx = (map['key_jp'] ?? map['keyjp']) ? ((map['key_jp'] ?? map['keyjp']) - 1) : -1;
    const labelIdx = map['label'] ? (map['label'] - 1) : -1;
    const priceIdx = map['price'] ? (map['price'] - 1) : -1;
    const noteIdx = map['note'] ? (map['note'] - 1) : -1;
    const visIdx = map['is_visible'] ? (map['is_visible'] - 1) : -1;
    const sortIdx = map['sort_order'] ? (map['sort_order'] - 1) : -1;
    const groupIdx = map['menu_group'] ? (map['menu_group'] - 1) : -1;
    const reqIdx = map['required_flag'] ? (map['required_flag'] - 1) : -1;
    const autoGroupIdx = map['auto_apply_group'] ? (map['auto_apply_group'] - 1) : -1;
    const autoKeyIdx = map['auto_apply_key'] ? (map['auto_apply_key'] - 1) : -1;
    const autoGroup2Idx = map['auto_apply_group_2'] ? (map['auto_apply_group_2'] - 1) : -1;
    const autoKey2Idx = map['auto_apply_key_2'] ? (map['auto_apply_key_2'] - 1) : -1;

    return {
      key: keyIdx >= 0 ? String(row[keyIdx] || '').trim() : '',
      key_jp: keyJpIdx >= 0 ? String(row[keyJpIdx] || '').trim() : '',
      label: labelIdx >= 0 ? String(row[labelIdx] || '').trim() : '',
      price: priceIdx >= 0 ? Number(row[priceIdx] || 0) : 0,
      note: noteIdx >= 0 ? String(row[noteIdx] || '').trim() : '',
      is_visible: visIdx < 0 || row[visIdx] === '' || row[visIdx] === undefined ? true : _toBool(row[visIdx]),
      sort_order: sortIdx < 0 || row[sortIdx] === '' || row[sortIdx] === undefined ? 9999 : Number(row[sortIdx]),
      menu_group: _inferMenuGroupFromLegacyRow_(groupIdx >= 0 ? row[groupIdx] : '', keyIdx >= 0 ? row[keyIdx] : '', keyJpIdx >= 0 ? row[keyJpIdx] : '', labelIdx >= 0 ? row[labelIdx] : ''),
      required_flag: reqIdx < 0 || row[reqIdx] === '' || row[reqIdx] === undefined ? false : _toBool(row[reqIdx]),
      auto_apply_group: _normalizeAutoApplyGroup_(autoGroupIdx >= 0 ? row[autoGroupIdx] : ''),
      auto_apply_key: autoKeyIdx >= 0 ? String(row[autoKeyIdx] || '').trim() : '',
      auto_apply_group_2: _normalizeAutoApplyGroup_(autoGroup2Idx >= 0 ? row[autoGroup2Idx] : ''),
      auto_apply_key_2: autoKey2Idx >= 0 ? String(row[autoKey2Idx] || '').trim() : ''
    };
  }).filter(function(r) {
    return !!r.key;
  }).sort(function(a, b) {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return String(a.key).localeCompare(String(b.key));
  });

  return out;
}


function _inferMenuGroupFromLegacyRow_(group, key, keyJp, label) {
  const rawGroup = String(group || '').trim();
  const rawKey = String(key || '').trim().toUpperCase();
  const rawKeyJp = String(keyJp || '').trim();
  const rawLabel = String(label || '').trim();

  if (rawGroup === 'move' || rawGroup === 'moveType' || rawGroup === 'move_type') return 'move_type';
  if (rawGroup === 'roundtrip' || rawGroup === 'roundTrip' || rawGroup === 'round_trip') return 'round_trip';
  if (rawGroup === 'stairs' || rawGroup === 'stair') return 'stair';
  if (rawGroup === 'equip' || rawGroup === 'equipment') return 'equipment';
  if (rawGroup === 'assist' || rawGroup === 'assistance') return 'assistance';
  if (rawGroup === 'price') return 'price';
  if (rawGroup && rawGroup !== 'custom') return _normalizeMenuGroup_(rawGroup);

  if (rawKey.startsWith('MOVE_')) return 'move_type';
  if (rawKey.startsWith('ROUND_') || rawKey.startsWith('ROUNDTRIP_') || rawKey.startsWith('ROUND_TRIP_')) return 'round_trip';
  if (rawKey.startsWith('STAIR_')) return 'stair';
  if (rawKey.startsWith('EQUIP_') || rawKey.startsWith('EQUIPMENT_')) return 'equipment';
  if (rawKey.startsWith('ASSIST_') || rawKey.startsWith('ASSISTANCE_') || rawKey.startsWith('BOARDING_') || rawKey.startsWith('BODY_')) return 'assistance';
  if (rawKey.startsWith('PRICE_') || rawKey === 'BASE_FARE' || rawKey === 'DISPATCH' || rawKey === 'SPECIAL_VEHICLE') return 'price';

  if (/移動方法/.test(rawKeyJp) || /移動方法/.test(rawLabel)) return 'move_type';
  if (/往復/.test(rawKeyJp) || /往復/.test(rawLabel)) return 'round_trip';
  if (/階段/.test(rawKeyJp) || /階段/.test(rawLabel)) return 'stair';
  if (/機材|レンタル|車いす|ストレッチャー/.test(rawKeyJp) || /機材|レンタル|車いす|ストレッチャー/.test(rawLabel)) return 'equipment';
  if (/介助/.test(rawKeyJp) || /介助/.test(rawLabel)) return 'assistance';
  if (/料金|基本/.test(rawKeyJp) || /料金|基本/.test(rawLabel)) return 'price';

  return rawGroup || 'custom';
}

function _sheetToObjects(sheet) {
  if (_isReservationSheet_(sheet)) _ensureReservationSheetSchema_(sheet);
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 1) return [];

  const hm = _headerMap(sheet);
  const headers = hm.headers;
  const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  return values.map(function(row) {
    const obj = {};
    for (let c = 0; c < headers.length; c++) {
      const k = headers[c];
      if (!k) continue;

      obj[k] = _cellToPlain(row[c]);

      const key2 = String(k).toLowerCase().replace(/\s+/g, '');
      if (key2 && obj[key2] === undefined) obj[key2] = obj[k];

      if (_isReservationSheet_(sheet)) {
        const canonical = _getCanonicalReservationKey_(k);
        if (canonical && (obj[canonical] === undefined || obj[canonical] === '')) obj[canonical] = obj[k];
      }
    }
    return _isReservationSheet_(sheet) ? _buildReservationCanonicalObject_(obj) : obj;
  });
}

function _appendByHeader(sheet, obj) {
  if (_isReservationSheet_(sheet)) _ensureReservationSheetSchema_(sheet);
  const writeObj = _isReservationSheet_(sheet) ? _buildReservationCanonicalObject_(obj) : (obj || {});
  const hm = _headerMap(sheet);
  const headers = hm.headers;
  const row = headers.map(function(h) {
    return (writeObj[h] !== undefined ? writeObj[h] : (writeObj[String(h).toLowerCase().replace(/\s+/g, '')] ?? ''));
  });
  sheet.appendRow(row);
}

function _updateRowByHeader(sheet, rowNumber, obj) {
  if (_isReservationSheet_(sheet)) _ensureReservationSheetSchema_(sheet);
  const writeObj = _isReservationSheet_(sheet) ? _buildReservationCanonicalObject_(obj) : (obj || {});
  const hm = _headerMap(sheet);
  const headers = hm.headers;
  const map = hm.map;

  headers.forEach(function(h) {
    if (!h) return;
    const col = map[h] || null;
    if (!col) return;

    const k2 = String(h).toLowerCase().replace(/\s+/g, '');
    if (writeObj[h] !== undefined) sheet.getRange(rowNumber, col).setValue(writeObj[h]);
    else if (writeObj[k2] !== undefined) sheet.getRange(rowNumber, col).setValue(writeObj[k2]);
  });
}

function _upsertBlock(dateStr, hour, minute, isBlocked, reservationId, options) {
  const sheet = _sh(SHEETS.BLOCK);
  if (!sheet) throw new Error('ブロックシートが見つかりません');

  options = options || {};

  const hm = _headerMap(sheet);
  const map = hm.map;
  const headers = hm.headers;

  const keyCol = map['slot_key'] ?? map['key'] ?? map['block_key'] ?? 1;
  const isBlockedCol = map['is_blocked'] ?? map['blocked'] ?? map['isBlocked'] ?? null;
  const dateCol = map['block_date'] ?? map['date'] ?? map['slot_date'] ?? null;
  const hourCol = map['block_hour'] ?? map['hour'] ?? map['slot_hour'] ?? null;
  const minuteCol = map['block_minute'] ?? map['minute'] ?? map['slot_minute'] ?? null;
  const ridCol = map['reservation_id'] ?? map['reservationid'] ?? map['予約id'] ?? map['予約ID'] ?? map['rid'] ?? null;
  const reasonCol = map['reason'] ?? null;
  const createdAtCol = map['created_at'] ?? null;
  const updatedAtCol = map['updated_at'] ?? null;

  const ymd = _normalizeYMD(dateStr);
  const key = ymd + '-' + hour + '-' + minute;

  let row = null;
  if (options.keyToRowMap && options.keyToRowMap.has(key)) {
    row = Number(options.keyToRowMap.get(key));
  } else {
    const last = sheet.getLastRow();
    if (last >= 2) {
      const keys = sheet.getRange(2, keyCol, last - 1, 1).getValues().map(function(r) {
        return String(r[0] || '').trim();
      });
      const idx = keys.findIndex(function(v) {
        return v === key;
      });
      if (idx >= 0) row = 2 + idx;
    }
  }

  if (row) {
    if (keyCol) sheet.getRange(row, keyCol).setValue(key);
    if (isBlockedCol) sheet.getRange(row, isBlockedCol).setValue(Boolean(isBlocked));
    if (dateCol) sheet.getRange(row, dateCol).setValue(ymd);
    if (hourCol) sheet.getRange(row, hourCol).setValue(Number(hour));
    if (minuteCol) sheet.getRange(row, minuteCol).setValue(Number(minute));
    if (ridCol && reservationId !== undefined) sheet.getRange(row, ridCol).setValue(reservationId || '');

    if (reasonCol) {
      if (reservationId !== undefined && reservationId) {
        sheet.getRange(row, reasonCol).setValue('RESERVATION');
      } else if (reservationId === '') {
        sheet.getRange(row, reasonCol).setValue(Boolean(isBlocked) ? 'MANUAL' : 'UNBLOCK');
      }
    }

    if (updatedAtCol) sheet.getRange(row, updatedAtCol).setValue(new Date());
    if (createdAtCol) {
      const cur = sheet.getRange(row, createdAtCol).getValue();
      if (!cur) sheet.getRange(row, createdAtCol).setValue(new Date());
    }
    return row;
  }

  const obj = {};
  obj['slot_key'] = key; obj['key'] = key; obj['block_key'] = key;
  obj['block_date'] = ymd; obj['date'] = ymd; obj['slot_date'] = ymd;
  obj['block_hour'] = Number(hour); obj['hour'] = Number(hour); obj['slot_hour'] = Number(hour);
  obj['block_minute'] = Number(minute); obj['minute'] = Number(minute); obj['slot_minute'] = Number(minute);
  obj['is_blocked'] = Boolean(isBlocked); obj['blocked'] = Boolean(isBlocked);
  obj['reservation_id'] = reservationId || '';
  obj['reservationId'] = reservationId || '';
  obj['rid'] = reservationId || '';

  if (reasonCol) {
    if (reservationId) obj['reason'] = 'RESERVATION';
    else obj['reason'] = Boolean(isBlocked) ? 'MANUAL' : 'UNBLOCK';
  }
  if (createdAtCol) obj['created_at'] = new Date();
  if (updatedAtCol) obj['updated_at'] = new Date();

  const rowValues = headers.map(function(h) {
    return (obj[h] !== undefined ? obj[h] : (obj[String(h).toLowerCase().replace(/\s+/g, '')] ?? ''));
  });
  sheet.appendRow(rowValues);
  const newRow = sheet.getLastRow();
  if (options.keyToRowMap) options.keyToRowMap.set(key, newRow);
  return newRow;
}

function _buildBlockKeyRowMap_(sheet) {
  const out = new Map();
  if (!sheet) return out;
  const hm = _headerMap(sheet);
  const map = hm.map;
  const keyCol = map['slot_key'] ?? map['key'] ?? map['block_key'] ?? 1;
  const dateCol = map['block_date'] ?? map['date'] ?? map['slot_date'] ?? null;
  const hourCol = map['block_hour'] ?? map['hour'] ?? map['slot_hour'] ?? null;
  const minuteCol = map['block_minute'] ?? map['minute'] ?? map['slot_minute'] ?? null;
  const last = sheet.getLastRow();
  if (last < 2) return out;
  const values = sheet.getRange(2, 1, last - 1, sheet.getLastColumn()).getValues();
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var key = String(row[keyCol - 1] || '').trim();
    if (!key) {
      var d = dateCol ? _normalizeYMD(row[dateCol - 1]) : '';
      var h = hourCol ? Number(row[hourCol - 1]) : NaN;
      var m = minuteCol ? Number(row[minuteCol - 1] || 0) : 0;
      if (d && !Number.isNaN(h) && !Number.isNaN(m)) key = d + '-' + h + '-' + m;
    }
    if (key) out.set(key, i + 2);
  }
  return out;
}

function _upsertReservationBlocksBulk_(dateStr, hour, minute, slotsCount, reservationId) {
  const sheet = _sh(SHEETS.BLOCK);
  if (!sheet) throw new Error('ブロックシートが見つかりません');
  const keyToRowMap = _buildBlockKeyRowMap_(sheet);
  const start = _toDate(dateStr, hour, minute);
  for (var i = 0; i < Number(slotsCount || 0); i++) {
    var dt = new Date(start.getTime() + i * 30 * 60 * 1000);
    _upsertBlock(_fmtYMD(dt), dt.getHours(), dt.getMinutes(), true, reservationId, { keyToRowMap: keyToRowMap });
  }
}

function _getBlockedSlotKeysInRange_(startDate, endDate) {
  const start = _normalizeYMD(startDate);
  const end = _normalizeYMD(endDate || startDate);
  if (!start) throw new Error('startDate が不正です');
  if (!end) throw new Error('endDate が不正です');
  if (start > end) throw new Error('startDate は endDate 以下にしてください');

  const cacheKey = 'blocked_slot_keys_v' + _getPublicApiCacheVersion_('blocked_slot_keys') + '_' + start + '_' + end;
  const cached = _cacheGetJson_(cacheKey);
  if (cached && Array.isArray(cached.slot_keys)) {
    return {
      start: start,
      end: end,
      slot_keys: cached.slot_keys
    };
  }

  const sheet = _sh(SHEETS.BLOCK);
  if (!sheet || sheet.getLastRow() < 2) {
    const emptyResult = { start: start, end: end, slot_keys: [] };
    _cachePutJson_(cacheKey, emptyResult, 120);
    return emptyResult;
  }

  const hm = _headerMap(sheet);
  const map = hm.map;
  const keyCol = map['slot_key'] ?? map['key'] ?? map['block_key'] ?? null;
  const isBlockedCol = map['is_blocked'] ?? map['blocked'] ?? map['isBlocked'] ?? null;
  const dateCol = map['block_date'] ?? map['date'] ?? map['slot_date'] ?? null;
  const hourCol = map['block_hour'] ?? map['hour'] ?? map['slot_hour'] ?? null;
  const minuteCol = map['block_minute'] ?? map['minute'] ?? map['slot_minute'] ?? null;

  const rowCount = sheet.getLastRow() - 1;
  const values = sheet.getRange(2, 1, rowCount, sheet.getLastColumn()).getValues();

  const keySet = new Set();

  for (var i = 0; i < rowCount; i++) {
    var row = values[i];
    var isBlocked = isBlockedCol ? _toBool(row[isBlockedCol - 1]) : false;
    if (!isBlocked) continue;

    var d = dateCol ? _normalizeYMD(row[dateCol - 1]) : '';
    var key = keyCol ? String(row[keyCol - 1] || '').trim() : '';
    if (!d && key) {
      var km = key.match(/^(\d{4}-\d{2}-\d{2})-(\d{1,2})-(\d{1,2})$/);
      if (km) d = km[1];
    }
    if (!d || d < start || d > end) continue;

    if (!key) {
      var h = hourCol ? Number(row[hourCol - 1]) : NaN;
      var m = minuteCol ? Number(row[minuteCol - 1] || 0) : 0;
      if (Number.isNaN(h) || Number.isNaN(m)) continue;
      key = d + '-' + h + '-' + m;
    }
    if (key) keySet.add(key);
  }

  const result = { start: start, end: end, slot_keys: Array.from(keySet) };
  _cachePutJson_(cacheKey, result, 120);
  return result;
}

function _getReservationsInRange_(startDate, endDate) {
  const start = _normalizeYMD(startDate);
  const end = _normalizeYMD(endDate || startDate);
  if (!start) throw new Error('startDate が不正です');
  if (!end) throw new Error('endDate が不正です');
  if (start > end) throw new Error('startDate は endDate 以下にしてください');

  const cacheKey = 'reservations_range_v' + _getPublicApiCacheVersion_('public_bootstrap') + '_' + start + '_' + end;
  const cached = _cacheGetJson_(cacheKey);
  if (cached && Array.isArray(cached.reservations)) return cached;

  const sheet = _sh(SHEETS.RESERVATIONS);
  if (!sheet || sheet.getLastRow() < 2) {
    const empty = { start: start, end: end, reservations: [] };
    _cachePutJson_(cacheKey, empty, 60);
    return empty;
  }

  if (_isReservationSheet_(sheet)) _ensureReservationSheetSchema_(sheet);
  const hm = _headerMap(sheet);
  const headers = hm.headers;
  const map = hm.map;
  const rowCount = sheet.getLastRow() - 1;
  const values = sheet.getRange(2, 1, rowCount, sheet.getLastColumn()).getValues();

  const dateColCandidates = [
    map['slot_date'],
    map['date'],
    map['reservation_date'],
    map['pickup_date'],
    map['day']
  ].filter(function(v, i, arr) {
    return Number.isFinite(v) && v > 0 && arr.indexOf(v) === i;
  });

  const rows = [];
  for (let r = 0; r < values.length; r++) {
    const row = values[r];
    let d = '';
    for (let i = 0; i < dateColCandidates.length; i++) {
      const col = dateColCandidates[i];
      d = _normalizeYMD(_cellToPlain(row[col - 1]));
      if (d) break;
    }
    if (!d || d < start || d > end) continue;

    const obj = {};
    for (let c = 0; c < headers.length; c++) {
      const k = headers[c];
      if (!k) continue;

      obj[k] = _cellToPlain(row[c]);
      const key2 = String(k).toLowerCase().replace(/\s+/g, '');
      if (key2 && obj[key2] === undefined) obj[key2] = obj[k];

      const canonical = _getCanonicalReservationKey_(k);
      if (canonical && (obj[canonical] === undefined || obj[canonical] === '')) obj[canonical] = obj[k];
    }
    rows.push(_buildReservationCanonicalObject_(obj));
  }

  const result = { start: start, end: end, reservations: rows };
  _cachePutJson_(cacheKey, result, 60);
  return result;
}

function _getBlocksInRange_(startDate, endDate) {
  const start = _normalizeYMD(startDate);
  const end = _normalizeYMD(endDate || startDate);
  if (!start) throw new Error('startDate が不正です');
  if (!end) throw new Error('endDate が不正です');
  if (start > end) throw new Error('startDate は endDate 以下にしてください');

  const cacheKey = 'blocks_range_v' + _getPublicApiCacheVersion_('blocked_slot_keys') + '_' + start + '_' + end;
  const cached = _cacheGetJson_(cacheKey);
  if (cached && Array.isArray(cached.blocks)) return cached;

  const sheet = _sh(SHEETS.BLOCK);
  if (!sheet || sheet.getLastRow() < 2) {
    const empty = { start: start, end: end, blocks: [] };
    _cachePutJson_(cacheKey, empty, 60);
    return empty;
  }

  const hm = _headerMap(sheet);
  const headers = hm.headers;
  const map = hm.map;
  const rowCount = sheet.getLastRow() - 1;
  const values = sheet.getRange(2, 1, rowCount, sheet.getLastColumn()).getValues();

  const dateColCandidates = [
    map['block_date'],
    map['date'],
    map['slot_date']
  ].filter(function(v, i, arr) {
    return Number.isFinite(v) && v > 0 && arr.indexOf(v) === i;
  });

  const rows = [];
  for (let r = 0; r < values.length; r++) {
    const row = values[r];
    let d = '';
    for (let i = 0; i < dateColCandidates.length; i++) {
      const col = dateColCandidates[i];
      d = _normalizeYMD(_cellToPlain(row[col - 1]));
      if (d) break;
    }
    if (!d || d < start || d > end) continue;

    const obj = {};
    for (let c = 0; c < headers.length; c++) {
      const k = headers[c];
      if (!k) continue;
      obj[k] = _cellToPlain(row[c]);
      const key2 = String(k).toLowerCase().replace(/\s+/g, '');
      if (key2 && obj[key2] === undefined) obj[key2] = obj[k];
    }
    rows.push(obj);
  }

  const result = { start: start, end: end, blocks: rows };
  _cachePutJson_(cacheKey, result, 60);
  return result;
}

function _releaseReservationBlocks_(reservationId) {
  const sheet = _sh(SHEETS.BLOCK);
  if (!sheet) throw new Error('ブロックシートが見つかりません');

  const rid = String(reservationId || '').trim();
  if (!rid) return 0;

  const hm = _headerMap(sheet);
  const map = hm.map;
  const ridCol = map['reservation_id'] ?? map['reservationid'] ?? map['予約id'] ?? map['予約ID'] ?? map['rid'] ?? null;
  const isBlockedCol = map['is_blocked'] ?? map['blocked'] ?? map['isBlocked'] ?? null;
  const updatedAtCol = map['updated_at'] ?? null;
  const reasonCol = map['reason'] ?? null;

  if (!ridCol || !isBlockedCol) return 0;

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;

  const now = new Date();
  const ridVals = sheet.getRange(2, ridCol, lastRow - 1, 1).getValues();
  const blkVals = sheet.getRange(2, isBlockedCol, lastRow - 1, 1).getValues();

  let changed = 0;
  for (let i = 0; i < ridVals.length; i++) {
    const r = String(ridVals[i][0] || '').trim();
    if (r !== rid) continue;

    const cur = _toBool(blkVals[i][0]);
    if (!cur) continue;

    const rowNum = 2 + i;
    sheet.getRange(rowNum, isBlockedCol).setValue(false);
    if (updatedAtCol) sheet.getRange(rowNum, updatedAtCol).setValue(now);
    if (reasonCol) sheet.getRange(rowNum, reasonCol).setValue('CANCELLED');
    changed++;
  }
  return changed;
}

function _releaseReservationBlocksBySlot_(slotDateStr, slotHour, slotMinute, reservationIdForReason, slotsCount) {
  const sheet = _sh(SHEETS.BLOCK);
  if (!sheet) throw new Error('ブロックシートが見つかりません');

  const d = _normalizeYMD(slotDateStr);
  const h0 = Number(slotHour);
  const m0 = Number(slotMinute || 0);
  if (!d || Number.isNaN(h0) || Number.isNaN(m0)) return 0;

  const keys = _makeReservationSlotKeys_(d, h0, m0, slotsCount);
  if (!keys.length) return 0;

  const hm = _headerMap(sheet);
  const map = hm.map;
  const keyCol = map['slot_key'] ?? map['key'] ?? map['block_key'] ?? null;
  const isBlockedCol = map['is_blocked'] ?? map['blocked'] ?? map['isBlocked'] ?? null;
  const dateCol = map['block_date'] ?? map['date'] ?? map['slot_date'] ?? null;
  const hourCol = map['block_hour'] ?? map['hour'] ?? map['slot_hour'] ?? null;
  const minuteCol = map['block_minute'] ?? map['minute'] ?? map['slot_minute'] ?? null;
  const updatedAtCol = map['updated_at'] ?? null;
  const reasonCol = map['reason'] ?? null;

  if (!isBlockedCol) return 0;

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;

  const lastCol = sheet.getLastColumn();
  const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  const now = new Date();

  const keySet = new Set(keys);

  let changed = 0;
  for (let i = 0; i < values.length; i++) {
    const row = values[i];

    let k = '';
    if (keyCol) k = String(row[keyCol - 1] || '').trim();

    if (!k) {
      const dd = dateCol ? _normalizeYMD(row[dateCol - 1]) : '';
      const hh = hourCol ? Number(row[hourCol - 1]) : NaN;
      const mm = minuteCol ? Number(row[minuteCol - 1]) : NaN;
      if (dd && !Number.isNaN(hh) && !Number.isNaN(mm)) k = dd + '-' + hh + '-' + mm;
    }

    if (!k || !keySet.has(k)) continue;

    const cur = _toBool(row[isBlockedCol - 1]);
    if (!cur) continue;

    const rowNum = 2 + i;
    sheet.getRange(rowNum, isBlockedCol).setValue(false);
    if (updatedAtCol) sheet.getRange(rowNum, updatedAtCol).setValue(now);
    if (reasonCol) sheet.getRange(rowNum, reasonCol).setValue('CANCELLED');
    changed++;
  }

  return changed;
}

function _makeReservationSlotKeys_(dateStr, hour, minute, slotsCount) {
  const n = (Number(slotsCount) === 2) ? 2 : 4;
  const start = _toDate(dateStr, hour, minute);
  const out = [];
  for (let i = 0; i < n; i++) {
    const dt = new Date(start.getTime() + i * 30 * 60 * 1000);
    out.push(_fmtYMD(dt) + '-' + dt.getHours() + '-' + dt.getMinutes());
  }
  return out;
}

function _reservationBlockSlotsFromObj_(obj) {
  const rt = String((obj && obj.round_trip) || '').trim();
  if (rt === '待機' || rt === '病院付き添い') return 4;
  return 2;
}

function _slotFromObj_(obj) {
  if (!obj) return null;
  const d = String(obj.slot_date || '').trim();
  const h = Number(obj.slot_hour);
  const m = Number(obj.slot_minute || 0);
  if (!d || Number.isNaN(h) || Number.isNaN(m)) return null;
  return { dateStr: d, hour: h, minute: m };
}

function _getReservationSlotFromRow_(sheet, rowNumber) {
  try {
    const hm = _headerMap(sheet);
    const map = hm.map;

    const colDate = map['slot_date'] ?? map['予約日'] ?? map['date'] ?? null;
    const colHour = map['slot_hour'] ?? map['予約時間'] ?? map['hour'] ?? null;
    const colMin  = map['slot_minute'] ?? map['minute'] ?? null;

    if (!colDate || !colHour) return null;

    const dRaw = sheet.getRange(rowNumber, colDate).getValue();
    const hRaw = sheet.getRange(rowNumber, colHour).getValue();
    const mRaw = colMin ? sheet.getRange(rowNumber, colMin).getValue() : 0;

    const d = String(_cellToPlain(dRaw) || '').trim();
    const h = Number(hRaw);
    const m = Number(mRaw || 0);

    if (!d || Number.isNaN(h) || Number.isNaN(m)) return null;
    return { dateStr: d, hour: h, minute: m };
  } catch (e) {
    return null;
  }
}

function _rowToObject_(sheet, rowNumber) {
  if (_isReservationSheet_(sheet)) _ensureReservationSheetSchema_(sheet);
  const hm = _headerMap(sheet);
  const headers = hm.headers;
  const vals = sheet.getRange(rowNumber, 1, 1, sheet.getLastColumn()).getValues()[0];
  const obj = {};
  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    if (!h) continue;
    obj[h] = _cellToPlain(vals[i]);
    const k2 = String(h).toLowerCase().replace(/\s+/g, '');
    if (k2 && obj[k2] === undefined) obj[k2] = obj[h];
  }
  return _isReservationSheet_(sheet) ? _buildReservationCanonicalObject_(obj) : obj;
}


function _clone_(obj) {
  return JSON.parse(JSON.stringify(obj || {}));
}

function _getConfigMap_() {
  const sheet = _sh(SHEETS.CONFIG);
  if (!sheet) return _clone_(DEFAULT_CONFIG);

  const values = sheet.getDataRange().getValues();
  const out = _clone_(DEFAULT_CONFIG);

  for (let i = 0; i < values.length; i++) {
    const k = String(values[i][0] || '').trim();
    if (!k || k === 'key' || k === '項目') continue;
    out[k] = _cellToPlain(values[i][1]);
  }

  return out;
}

function _upsertConfigMap_(mapObj) {
  const sheet = _sh(SHEETS.CONFIG);
  if (!sheet) throw new Error('設定シートが見つかりません');

  const lastRow = Math.max(sheet.getLastRow(), 1);
  const values = sheet.getRange(1, 1, lastRow, Math.max(sheet.getLastColumn(), 3)).getValues();

  let headerExists = false;
  if (values.length >= 1) {
    const a1 = String(values[0][0] || '').trim();
    const b1 = String(values[0][1] || '').trim();
    headerExists = (a1 === 'key' && b1 === 'value');
  }

  if (!headerExists) {
    sheet.getRange(1, 1, 1, 3).setValues([['key', 'value', 'note']]);
  }

  const keyToRow = {};
  const lr = sheet.getLastRow();
  if (lr >= 2) {
    const keys = sheet.getRange(2, 1, lr - 1, 1).getValues();
    for (let i = 0; i < keys.length; i++) {
      const k = String(keys[i][0] || '').trim();
      if (k) keyToRow[k] = 2 + i;
    }
  }

  const allKeys = Object.keys(mapObj);
  allKeys.forEach(function(k) {
    const v = mapObj[k];
    const row = keyToRow[k];
    if (row) {
      sheet.getRange(row, 2).setValue(v);
    } else {
      sheet.appendRow([k, v, '']);
    }
  });
}

function _ensureConfigDefaults_() {
  let sheet = _sh(SHEETS.CONFIG);
  const schemaVersion = 'config_schema_v4';
  if (sheet && _isConfigSheetHeaderValid_(sheet) && _getSchemaReadyFlag_(schemaVersion)) {
    return;
  }
  if (!sheet) {
    sheet = _ss().insertSheet(SHEETS.CONFIG);
  }

  if (sheet.getLastRow() < 1) {
    sheet.getRange(1, 1, 1, 3).setValues([['key', 'value', 'note']]);
  } else {
    const a1 = String(sheet.getRange(1, 1).getValue() || '').trim();
    const b1 = String(sheet.getRange(1, 2).getValue() || '').trim();
    if (!(a1 === 'key' && b1 === 'value')) {
      const oldLastRow = sheet.getLastRow();
      const oldLastCol = Math.max(sheet.getLastColumn(), 3);
      const oldData = oldLastRow > 0 ? sheet.getRange(1, 1, oldLastRow, oldLastCol).getValues() : [];
      sheet.clear();
      sheet.getRange(1, 1, 1, 3).setValues([['key', 'value', 'note']]);
      if (oldData.length > 0) {
        sheet.getRange(2, 1, oldData.length, oldData[0].length).setValues(oldData);
      }
    }
  }

  const noteMap = {
    main_title: '画面タイトル',
    admin_password: '管理画面パス（後で変更推奨）',
    admin_tap_count: 'ロゴのタップ回数で管理者ログイン',
    days_per_page: '表示日数',
    max_forward_days: '何日先まで表示するか',
    slot_minutes: '30分刻み',
    service_block_minutes: '予約1件で塞ぐ時間（120分）',
    calendar_start_h: '通常枠開始',
    calendar_end_h: '通常枠終了',
    extended_enabled: '他時間予約の有効(1=ON)',
    extended_start_h: '他時間(夜)開始',
    extended_end_h: '他時間(朝)終了',
    phone_notify_text: '予約後に表示する電話番号',
    gas_notify_url: '予約通知のGAS URL',
    gas_notify_secret: '通知用シークレット',
    sheet_reservations: '予約保存先シート名',
    sheet_blocks: '手動ブロック保存先',
    lock_minutes: '同時予約対策のロック目安',
    timezone: '固定',

    logo_text: 'ロゴ文字',
    logo_subtext: 'ロゴ下サブテキスト',
    logo_image_url: 'GitHub raw画像URL',
    logo_drive_file_id: '互換維持用',
    logo_use_drive_image: '互換維持用',
    logo_drive_folder_id: '互換維持用',
    logo_use_github_image: 'GitHub画像優先(1=ON)',
    logo_github_path: 'GitHub保存先パス',

    github_username: 'GitHub ユーザー名',
    github_repo: 'GitHub リポジトリ名',
    github_branch: 'GitHub ブランチ名',
    github_token: 'GitHub Personal Access Token',
    github_assets_base_path: 'GitHub保存ベースパス',

    same_day_enabled: '当日予約表示(1=ON)',
    same_day_min_hours: '当日予約の最短時間（現在+○時間）',
    admin_panels_collapsed_default: '管理画面パネルを初期で最小化(1=ON)',

    rule_force_body_assist_on_stair: '階段介助選択時に身体介助を自動セット(1=ON)',
    rule_force_body_assist_on_stretcher: 'ストレッチャー選択時に身体介助を自動セット(1=ON)',
    rule_force_stretcher_staff2_on_stretcher: 'ストレッチャー選択時に2名体制を自動加算(1=ON)',

    auto_rule_enabled_1: '自動ルール1 有効',
    auto_rule_target_1: '自動ルール1 対象グループ',
    auto_rule_trigger_key_1: '自動ルール1 発火キー',
    auto_rule_apply_group_1: '自動ルール1 追加先グループ',
    auto_rule_apply_key_1: '自動ルール1 追加キー',

    auto_rule_enabled_2: '自動ルール2 有効',
    auto_rule_target_2: '自動ルール2 対象グループ',
    auto_rule_trigger_key_2: '自動ルール2 発火キー',
    auto_rule_apply_group_2: '自動ルール2 追加先グループ',
    auto_rule_apply_key_2: '自動ルール2 追加キー',

    auto_rule_enabled_3: '自動ルール3 有効',
    auto_rule_target_3: '自動ルール3 対象グループ',
    auto_rule_trigger_key_3: '自動ルール3 発火キー',
    auto_rule_apply_group_3: '自動ルール3 追加先グループ',
    auto_rule_apply_key_3: '自動ルール3 追加キー',

    auto_rule_enabled_4: '自動ルール4 有効',
    auto_rule_target_4: '自動ルール4 対象グループ',
    auto_rule_trigger_key_4: '自動ルール4 発火キー',
    auto_rule_apply_group_4: '自動ルール4 追加先グループ',
    auto_rule_apply_key_4: '自動ルール4 追加キー',

    auto_rule_enabled_5: '自動ルール5 有効',
    auto_rule_target_5: '自動ルール5 対象グループ',
    auto_rule_trigger_key_5: '自動ルール5 発火キー',
    auto_rule_apply_group_5: '自動ルール5 追加先グループ',
    auto_rule_apply_key_5: '自動ルール5 追加キー',

    auto_rule_enabled_6: '自動ルール6 有効',
    auto_rule_target_6: '自動ルール6 対象グループ',
    auto_rule_trigger_key_6: '自動ルール6 発火キー',
    auto_rule_apply_group_6: '自動ルール6 追加先グループ',
    auto_rule_apply_key_6: '自動ルール6 追加キー',

    warning_stair_bodyassist_text: '階段介助時の警告文',
    warning_wheelchair_damage_text: '持込車いす時の警告文',
    warning_stretcher_bodyassist_text: 'ストレッチャー時の警告文',

    form_modal_title: '予約モーダルタイトル',
    form_privacy_text: '個人情報同意文',
    form_basic_section_title: '基本情報 見出し',
    form_basic_section_badge: '基本情報 バッジ',
    form_usage_type_label: 'ご利用区分 ラベル',
    form_usage_type_placeholder: 'ご利用区分 プレースホルダ',
    form_usage_type_option_first: 'ご利用区分 初回',
    form_usage_type_option_repeat: 'ご利用区分 リピーター',
    form_customer_name_label: 'お名前 ラベル',
    form_customer_name_placeholder: 'お名前 プレースホルダ',
    form_phone_label: '電話番号 ラベル',
    form_phone_placeholder: '電話番号 プレースホルダ',
    form_pickup_label: 'お伺い先 ラベル',
    form_pickup_placeholder: 'お伺い先 プレースホルダ',
    form_optional_section_title: '追加情報 見出し',
    form_optional_section_badge: '追加情報 バッジ',
    form_destination_label: '送迎先 ラベル',
    form_destination_placeholder: '送迎先 プレースホルダ',
    form_notes_label: '備考 ラベル',
    form_notes_placeholder: '備考 プレースホルダ',
    form_service_section_title: 'サービス選択 見出し',
    form_service_section_badge: 'サービス選択 バッジ',
    form_assistance_label: '介助内容 ラベル',
    form_stair_label: '階段介助 ラベル',
    form_equipment_label: '機材レンタル ラベル',
    form_round_trip_label: '往復送迎 ラベル',
    form_price_section_title: '料金概算 見出し',
    form_price_total_label: '料金概算 合計ラベル',
    form_price_notice_text: '料金案内文',
    form_submit_button_text: '予約ボタン文言',

    complete_title: '完了画面タイトル1',
    complete_title_sub: '完了画面タイトル2',
    complete_reservation_id_label: '予約IDラベル',
    complete_phone_guide_prefix: '完了画面電話案内 前半',
    complete_phone_guide_middle: '完了画面電話案内 中間',
    complete_phone_guide_after: '完了画面電話案内 後半',
    complete_phone_guide_warning: '完了画面注意文',
    complete_phone_guide_footer: '完了画面末尾文',
    complete_close_button_text: '完了画面閉じるボタン',

    calendar_toggle_extended_text: 'カレンダー 他時間ボタン',
    calendar_toggle_regular_text: 'カレンダー 通常時間ボタン',
    calendar_legend_available: 'カレンダー 凡例 予約可能',
    calendar_legend_unavailable: 'カレンダー 凡例 予約不可',
    calendar_scroll_guide_text: 'カレンダー スクロール案内'
  };

  const current = _getConfigMap_();
  const merged = _clone_(DEFAULT_CONFIG);
  Object.keys(current).forEach(function(k) {
    merged[k] = current[k];
  });

  _upsertConfigMap_(merged);

  const lr = sheet.getLastRow();
  if (lr >= 2) {
    const keys = sheet.getRange(2, 1, lr - 1, 1).getValues();
    const curNotes = sheet.getRange(2, 3, lr - 1, 1).getValues();
    const nextNotes = [];
    let hasDiff = false;

    for (let i = 0; i < keys.length; i++) {
      const k = String(keys[i][0] || '').trim();
      const next = noteMap[k] ? String(noteMap[k]) : String(curNotes[i][0] || '');
      nextNotes.push([next]);
      if (String(curNotes[i][0] || '') !== next) hasDiff = true;
    }

    if (hasDiff) {
      sheet.getRange(2, 3, nextNotes.length, 1).setValues(nextNotes);
    }
  }

  _setSchemaReadyFlag_(schemaVersion, true);
}

function _ensurePriceMasterDefaults_() {
  let sheet = _sh(SHEETS.PRICE_MASTER);
  const schemaVersion = 'price_master_schema_v4';
  if (sheet && _isPriceMasterHeaderValid_(sheet) && _getSchemaReadyFlag_(schemaVersion)) {
    return;
  }
  if (!sheet) {
    sheet = _ss().insertSheet(SHEETS.PRICE_MASTER);
  }

  const headers = _ensurePriceMasterHeader_(sheet);

  if (sheet.getLastRow() >= 2) {
    _repairExistingPriceMasterRows_(sheet);
    _setSchemaReadyFlag_(schemaVersion, true);
    return;
  }

  const rows = DEFAULT_PRICE_MASTER.map(function(obj) {
    return headers.map(function(h) {
      return obj[h] !== undefined ? obj[h] : '';
    });
  });

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }

  _setSchemaReadyFlag_(schemaVersion, true);
}

function _ensurePriceMasterHeader_(sheet) {
  const required = ['key', 'key_jp', 'label', 'price', 'note', 'is_visible', 'sort_order', 'menu_group', 'required_flag', 'auto_apply_group', 'auto_apply_key', 'auto_apply_group_2', 'auto_apply_key_2'];

  if (sheet.getLastRow() < 1 || sheet.getLastColumn() < required.length) {
    const oldData = (sheet.getLastRow() >= 1 && sheet.getLastColumn() >= 1)
      ? sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn()).getValues()
      : [];

    sheet.clear();
    sheet.getRange(1, 1, 1, required.length).setValues([required]);

    if (oldData.length > 1) {
      const oldHeaders = oldData[0].map(function(v) { return String(v || '').trim(); });
      const mapped = [];
      for (let r = 1; r < oldData.length; r++) {
        const row = oldData[r];
        const obj = {};
        oldHeaders.forEach(function(h, idx) {
          obj[h] = row[idx];
        });

        const key = String(obj.key || '').trim();
        const catalog = _findMenuCatalogByKey_(key);

        const newRow = required.map(function(h) {
          if (h === 'key_jp') return obj.key_jp !== undefined ? obj.key_jp : (catalog ? catalog.key_jp : '');
          if (h === 'menu_group') return _normalizeMenuGroup_(obj.menu_group !== undefined ? obj.menu_group : (catalog ? catalog.menu_group : 'custom'));
          if (h === 'required_flag') return obj.required_flag !== undefined ? obj.required_flag : (catalog ? catalog.required_flag : false);
          if (h === 'auto_apply_group') return _normalizeAutoApplyGroup_(obj.auto_apply_group !== undefined ? obj.auto_apply_group : (catalog ? catalog.auto_apply_group : ''));
          if (h === 'auto_apply_key') return obj.auto_apply_key !== undefined ? obj.auto_apply_key : (catalog ? catalog.auto_apply_key : '');
          if (h === 'auto_apply_group_2') return _normalizeAutoApplyGroup_(obj.auto_apply_group_2 !== undefined ? obj.auto_apply_group_2 : (catalog ? catalog.auto_apply_group_2 : ''));
          if (h === 'auto_apply_key_2') return obj.auto_apply_key_2 !== undefined ? obj.auto_apply_key_2 : (catalog ? catalog.auto_apply_key_2 : '');
          return obj[h] !== undefined ? obj[h] : '';
        });
        mapped.push(newRow);
      }

      if (mapped.length > 0) {
        sheet.getRange(2, 1, mapped.length, required.length).setValues(mapped);
      }
    }

    return required;
  }

  const current = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(function(v) {
    return String(v || '').trim();
  });

  let same = true;
  for (let i = 0; i < required.length; i++) {
    if (current[i] !== required[i]) {
      same = false;
      break;
    }
  }

  if (!same) {
    const data = [];
    if (sheet.getLastRow() >= 2) {
      const oldLastRow = sheet.getLastRow();
      const oldLastCol = sheet.getLastColumn();
      data.push.apply(data, sheet.getRange(2, 1, oldLastRow - 1, oldLastCol).getValues());
    }

    sheet.clear();
    sheet.getRange(1, 1, 1, required.length).setValues([required]);

    if (data.length > 0) {
      const hm = {};
      current.forEach(function(h, idx) {
        hm[h] = idx;
      });

      const mapped = data.map(function(row) {
        return required.map(function(h) {
          if (hm[h] !== undefined) {
            if (h === 'menu_group') return _normalizeMenuGroup_(row[hm[h]]);
            if (h === 'auto_apply_group' || h === 'auto_apply_group_2') return _normalizeAutoApplyGroup_(row[hm[h]]);
            return row[hm[h]];
          }

          if (h === 'key_jp') {
            const keyIdx = hm['key'];
            const key = (keyIdx !== undefined) ? String(row[keyIdx] || '').trim() : '';
            const catalog = _findMenuCatalogByKey_(key);
            return catalog ? catalog.key_jp : '';
          }

          if (h === 'menu_group') {
            const keyIdx = hm['key'];
            const key = (keyIdx !== undefined) ? String(row[keyIdx] || '').trim() : '';
            const catalog = _findMenuCatalogByKey_(key);
            return _normalizeMenuGroup_(catalog ? catalog.menu_group : 'custom');
          }

          if (h === 'required_flag') {
            const keyIdx = hm['key'];
            const key = (keyIdx !== undefined) ? String(row[keyIdx] || '').trim() : '';
            const catalog = _findMenuCatalogByKey_(key);
            return catalog ? catalog.required_flag : false;
          }

          if (h === 'auto_apply_group') {
            const keyIdx = hm['key'];
            const key = (keyIdx !== undefined) ? String(row[keyIdx] || '').trim() : '';
            const catalog = _findMenuCatalogByKey_(key);
            return _normalizeAutoApplyGroup_(catalog ? catalog.auto_apply_group : '');
          }

          if (h === 'auto_apply_key') {
            const keyIdx = hm['key'];
            const key = (keyIdx !== undefined) ? String(row[keyIdx] || '').trim() : '';
            const catalog = _findMenuCatalogByKey_(key);
            return catalog ? String(catalog.auto_apply_key || '') : '';
          }

          if (h === 'auto_apply_group_2') {
            const keyIdx = hm['key'];
            const key = (keyIdx !== undefined) ? String(row[keyIdx] || '').trim() : '';
            const catalog = _findMenuCatalogByKey_(key);
            return _normalizeAutoApplyGroup_(catalog ? catalog.auto_apply_group_2 : '');
          }

          if (h === 'auto_apply_key_2') {
            const keyIdx = hm['key'];
            const key = (keyIdx !== undefined) ? String(row[keyIdx] || '').trim() : '';
            const catalog = _findMenuCatalogByKey_(key);
            return catalog ? String(catalog.auto_apply_key_2 || '') : '';
          }

          return '';
        });
      });

      sheet.getRange(2, 1, mapped.length, required.length).setValues(mapped);
    }
  }

  return required;
}

function _repairExistingPriceMasterRows_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  const hm = _headerMap(sheet);
  const map = hm.map;

  const keyCol = map['key'] ?? null;
  const keyJpCol = map['key_jp'] ?? null;
  const menuGroupCol = map['menu_group'] ?? null;
  const requiredFlagCol = map['required_flag'] ?? null;
  const labelCol = map['label'] ?? null;
  const autoApplyGroupCol = map['auto_apply_group'] ?? null;
  const autoApplyKeyCol = map['auto_apply_key'] ?? null;
  const autoApplyGroup2Col = map['auto_apply_group_2'] ?? null;
  const autoApplyKey2Col = map['auto_apply_key_2'] ?? null;

  if (!keyCol) return;

  const values = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();

  for (let i = 0; i < values.length; i++) {
    const rowNo = 2 + i;
    const key = String(values[i][keyCol - 1] || '').trim();
    if (!key) continue;

    const catalog = _findMenuCatalogByKey_(key);

    if (keyJpCol) {
      const cur = String(values[i][keyJpCol - 1] || '').trim();
      if (!cur && catalog && catalog.key_jp) {
        sheet.getRange(rowNo, keyJpCol).setValue(catalog.key_jp);
      }
    }

    if (menuGroupCol) {
      const curGroup = String(values[i][menuGroupCol - 1] || '').trim();
      const nextGroup = _normalizeMenuGroup_(curGroup || (catalog ? catalog.menu_group : 'custom'));
      if (curGroup !== nextGroup) {
        sheet.getRange(rowNo, menuGroupCol).setValue(nextGroup);
      }
    }

    if (requiredFlagCol) {
      const curReq = values[i][requiredFlagCol - 1];
      const isBlank = (curReq === '' || curReq === null || curReq === undefined);
      if (isBlank && catalog) {
        sheet.getRange(rowNo, requiredFlagCol).setValue(!!catalog.required_flag);
      }
    }

    if (labelCol) {
      const curLabel = String(values[i][labelCol - 1] || '').trim();
      if (!curLabel && catalog && catalog.default_label) {
        sheet.getRange(rowNo, labelCol).setValue(catalog.default_label);
      }
    }

    if (autoApplyGroupCol) {
      const curAutoGroup = String(values[i][autoApplyGroupCol - 1] || '').trim();
      const nextAutoGroup = _normalizeAutoApplyGroup_(curAutoGroup || (catalog ? catalog.auto_apply_group : ''));
      if (curAutoGroup !== nextAutoGroup) {
        sheet.getRange(rowNo, autoApplyGroupCol).setValue(nextAutoGroup);
      }
    }

    if (autoApplyKeyCol) {
      const curAutoKey = String(values[i][autoApplyKeyCol - 1] || '').trim();
      if (!curAutoKey && catalog && catalog.auto_apply_key) {
        sheet.getRange(rowNo, autoApplyKeyCol).setValue(String(catalog.auto_apply_key || ''));
      }
    }

    if (autoApplyGroup2Col) {
      const curAutoGroup2 = String(values[i][autoApplyGroup2Col - 1] || '').trim();
      const nextAutoGroup2 = _normalizeAutoApplyGroup_(curAutoGroup2 || (catalog ? catalog.auto_apply_group_2 : ''));
      if (curAutoGroup2 !== nextAutoGroup2) {
        sheet.getRange(rowNo, autoApplyGroup2Col).setValue(nextAutoGroup2);
      }
    }

    if (autoApplyKey2Col) {
      const curAutoKey2 = String(values[i][autoApplyKey2Col - 1] || '').trim();
      if (!curAutoKey2 && catalog && catalog.auto_apply_key_2) {
        sheet.getRange(rowNo, autoApplyKey2Col).setValue(String(catalog.auto_apply_key_2 || ''));
      }
    }
  }
}

function _normalizeMenuItem_(item, defaultSort) {
  const obj = {};
  const key = _normalizeInternalMenuKey_((item && item.key) || '');

  const catalog = _findMenuCatalogByKey_(key);

  let keyJp = String((item && item.key_jp) || '').trim();
  if (!keyJp && catalog) keyJp = String(catalog.key_jp || '').trim();

  let label = String((item && item.label) || '').trim();
  if (!label && catalog && catalog.default_label) {
    label = String(catalog.default_label || '').trim();
  }

  let menuGroup = String((item && item.menu_group) || '').trim();
  if (!menuGroup && catalog) menuGroup = String(catalog.menu_group || '').trim();
  menuGroup = _inferMenuGroupFromLegacyRow_(menuGroup, key, keyJp, label);

  const price = (item && item.price !== undefined && item.price !== null && item.price !== '')
    ? Number(item.price || 0)
    : Number(catalog ? catalog.default_price : 0);

  const requiredFlag = (item && item.required_flag === undefined)
    ? (catalog ? catalog.required_flag : false)
    : _toBool(item.required_flag);

  let autoApplyGroup = '';
  if (item && item.auto_apply_group !== undefined) {
    autoApplyGroup = _normalizeAutoApplyGroup_(item.auto_apply_group);
  } else if (catalog) {
    autoApplyGroup = _normalizeAutoApplyGroup_(catalog.auto_apply_group || '');
  }

  let autoApplyKey = '';
  if (item && item.auto_apply_key !== undefined) {
    autoApplyKey = String(item.auto_apply_key || '').trim();
  } else if (catalog) {
    autoApplyKey = String(catalog.auto_apply_key || '').trim();
  }

  let autoApplyGroup2 = '';
  if (item && item.auto_apply_group_2 !== undefined) {
    autoApplyGroup2 = _normalizeAutoApplyGroup_(item.auto_apply_group_2);
  } else if (catalog) {
    autoApplyGroup2 = _normalizeAutoApplyGroup_(catalog.auto_apply_group_2 || '');
  }

  let autoApplyKey2 = '';
  if (item && item.auto_apply_key_2 !== undefined) {
    autoApplyKey2 = String(item.auto_apply_key_2 || '').trim();
  } else if (catalog) {
    autoApplyKey2 = String(catalog.auto_apply_key_2 || '').trim();
  }

  obj.key = key;
  obj.key_jp = keyJp;
  obj.label = label;
  obj.price = Number.isNaN(price) ? 0 : price;
  obj.note = String((item && item.note) || '').trim();
  obj.is_visible = (item && item.is_visible === undefined) ? true : _toBool(item.is_visible);
  obj.sort_order = (item && item.sort_order !== undefined && item.sort_order !== '') ? Number(item.sort_order) : Number(defaultSort || 9999);
  obj.menu_group = menuGroup;
  obj.required_flag = requiredFlag;
  obj.auto_apply_group = autoApplyGroup;
  obj.auto_apply_key = autoApplyKey;
  obj.auto_apply_group_2 = autoApplyGroup2;
  obj.auto_apply_key_2 = autoApplyKey2;

  return obj;
}

function _normalizeInternalMenuKey_(key) {
  let s = String(key || '').trim();
  if (!s) return '';

  s = s
    .replace(/[　\s]+/g, '_')
    .replace(/[^\w]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();

  return s;
}

function _getResolvedMenuGroupCatalog_() {
  const map = {};

  (MENU_GROUP_CATALOG || []).forEach(function(group) {
    const key = String(group && group.key || '').trim();
    if (!key) return;
    map[key] = {
      key: key,
      label: String(group && group.label || key).trim()
    };
  });

  try {
    const cfg = _getConfigMap_();
    const raw = cfg && cfg.menu_group_catalog_json ? JSON.parse(String(cfg.menu_group_catalog_json || '[]')) : [];
    (Array.isArray(raw) ? raw : []).forEach(function(group) {
      const key = String(group && group.key || '').trim();
      if (!key) return;
      map[key] = {
        key: key,
        label: String(group && group.label || (map[key] && map[key].label) || key).trim()
      };
    });
  } catch (_) {}

  return Object.keys(map).map(function(key) { return map[key]; });
}

function _normalizeMenuGroup_(group) {
  const s = String(group || '').trim();
  if (!s) return 'custom';

  const hit = _getResolvedMenuGroupCatalog_().find(function(g) {
    return String(g && g.key || '') === s;
  });
  return hit ? String(hit.key || '') : 'custom';
}

function _normalizeAutoApplyGroup_(group) {
  const s = String(group || '').trim();
  if (!s) return '';

  const hit = _getResolvedMenuGroupCatalog_().find(function(g) {
    return String(g && g.key || '') === s;
  });
  if (!hit) return '';
  if (s === 'price' || s === 'custom') return '';
  return String(hit.key || '');
}

function _findMenuCatalogByKey_(key) {
  const k = String(key || '').trim();
  if (!k) return null;
  for (let i = 0; i < MENU_KEY_CATALOG.length; i++) {
    if (String(MENU_KEY_CATALOG[i].key) === k) return MENU_KEY_CATALOG[i];
  }
  return null;
}

function _buildAutoRuleCatalog_() {
  const cfg = _getConfigMap_();
  const out = [];
  for (var i = 1; i <= 6; i++) {
    out.push({
      index: i,
      enabled: _toBool(cfg['auto_rule_enabled_' + i]),
      target: String(cfg['auto_rule_target_' + i] || ''),
      trigger_key: String(cfg['auto_rule_trigger_key_' + i] || ''),
      apply_group: String(cfg['auto_rule_apply_group_' + i] || ''),
      apply_key: String(cfg['auto_rule_apply_key_' + i] || '')
    });
  }
  return out;
}

// ===== GitHub helper =====
function _joinGithubPath_() {
  var parts = [];
  for (var i = 0; i < arguments.length; i++) {
    var p = String(arguments[i] || '').trim();
    if (!p) continue;
    p = p.replace(/^\/+/, '').replace(/\/+$/, '');
    if (p) parts.push(p);
  }
  return parts.join('/');
}

function _buildGithubRawUrl_(username, repo, branch, path) {
  return 'https://raw.githubusercontent.com/' + encodeURIComponent(username) + '/' + encodeURIComponent(repo) + '/' + encodeURIComponent(branch) + '/' + path.split('/').map(encodeURIComponent).join('/');
}

function _githubApiContentUrl_(username, repo, path) {
  return 'https://api.github.com/repos/' + encodeURIComponent(username) + '/' + encodeURIComponent(repo) + '/contents/' + path.split('/').map(encodeURIComponent).join('/');
}

function _githubRequest_(url, method, token, payloadObj) {
  var options = {
    method: method || 'get',
    muteHttpExceptions: true,
    headers: {
      Authorization: 'token ' + token,
      Accept: 'application/vnd.github+json'
    }
  };

  if (payloadObj !== undefined && payloadObj !== null) {
    options.contentType = 'application/json; charset=utf-8';
    options.payload = JSON.stringify(payloadObj);
  }

  var res = UrlFetchApp.fetch(url, options);
  var code = res.getResponseCode();
  var text = res.getContentText();
  var json = null;

  try {
    json = JSON.parse(text);
  } catch (_) {
    json = null;
  }

  if (code < 200 || code >= 300) {
    var msg = (json && (json.message || json.error)) ? (json.message || json.error) : text;
    throw new Error('GitHub APIエラー: ' + code + ' ' + msg);
  }

  return json || {};
}

function _githubGetContentShaIfExists_(username, repo, branch, token, path) {
  var url = _githubApiContentUrl_(username, repo, path) + '?ref=' + encodeURIComponent(branch);
  try {
    var json = _githubRequest_(url, 'get', token, null);
    return String(json.sha || '').trim();
  } catch (e) {
    var msg = String(e && e.message ? e.message : e);
    if (msg.indexOf('404') >= 0 || msg.indexOf('Not Found') >= 0) return '';
    return '';
  }
}

function _uploadBase64FileToGitHub_(username, repo, branch, token, path, base64Content, message) {
  var sha = _githubGetContentShaIfExists_(username, repo, branch, token, path);
  var url = _githubApiContentUrl_(username, repo, path);

  var payload = {
    message: message || ('upload ' + path),
    content: String(base64Content || '').trim(),
    branch: branch
  };

  if (sha) payload.sha = sha;

  var json = _githubRequest_(url, 'put', token, payload);
  return {
    sha: json && json.content ? String(json.content.sha || '') : '',
    path: json && json.content ? String(json.content.path || path) : path
  };
}

function _maskSecretConfig_(cfg) {
  var out = _clone_(cfg || {});
  if (out.github_token) out.github_token = '***';
  if (out.admin_password) out.admin_password = '***';
  return out;
}

function _logAdmin_(action, targetId, before, after, memo) {
  try {
    let sheet = _sh(SHEETS.ADMINLOG);
    if (!sheet) {
      sheet = _ss().insertSheet(SHEETS.ADMINLOG);
    }

    const headers = ['timestamp', 'action', 'target_id', 'before', 'after', 'memo'];

    if (sheet.getLastRow() < 1) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    } else {
      const current = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), headers.length)).getValues()[0];
      const currentA = String(current[0] || '').trim();
      const currentB = String(current[1] || '').trim();
      if (!(currentA === 'timestamp' && currentB === 'action')) {
        const oldLastRow = sheet.getLastRow();
        const oldLastCol = Math.max(sheet.getLastColumn(), headers.length);
        const oldData = oldLastRow >= 1 ? sheet.getRange(1, 1, oldLastRow, oldLastCol).getValues() : [];
        sheet.clear();
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
        if (oldData.length > 0) {
          sheet.getRange(2, 1, oldData.length, oldData[0].length).setValues(oldData);
        }
      }
    }

    const row = [
      Utilities.formatDate(new Date(), TZ, 'yyyy/MM/dd HH:mm:ss'),
      action || '',
      targetId || '',
      before || '',
      after || '',
      memo || ''
    ];
    sheet.appendRow(row);
  } catch (_) {}
}

function _validateSameDayBooking_(slotDate, slotHour, slotMinute) {
  const cfg = _getConfigMap_();
  const sameDayEnabled = _toBool(cfg.same_day_enabled);
  if (!sameDayEnabled) return true;

  const dateStr = _normalizeYMD(slotDate);
  const now = new Date();
  const todayStr = _fmtYMD(now);

  if (dateStr !== todayStr) return true;

  const minHours = Number(cfg.same_day_min_hours || 3);
  const threshold = new Date(now.getTime() + minHours * 60 * 60 * 1000);
  const thresholdRounded = _ceilToNext30Min_(threshold);
  const slotDt = _toDate(dateStr, slotHour, slotMinute);

  if (slotDt.getTime() < thresholdRounded.getTime()) {
    throw new Error('当日予約は現在時刻から' + minHours + '時間後以降の枠のみ予約できます');
  }

  return true;
}

function _validateReservationSlotAvailable_(slotDate, slotHour, slotMinute, slotsCount, reservationId) {
  const blockSheet = _sh(SHEETS.BLOCK);
  const keys = _makeReservationSlotKeys_(slotDate, slotHour, slotMinute, slotsCount);
  const keySet = new Set(keys);
  const reservationIdStr = String(reservationId || '').trim();

  if (!blockSheet || blockSheet.getLastRow() < 2) {
    return true;
  }

  const hm = _headerMap(blockSheet);
  const map = hm.map;
  const keyCol = map['slot_key'] ?? map['key'] ?? map['block_key'] ?? null;
  const isBlockedCol = map['is_blocked'] ?? map['blocked'] ?? map['isBlocked'] ?? null;
  const ridCol = map['reservation_id'] ?? map['reservationid'] ?? map['予約id'] ?? map['予約ID'] ?? map['rid'] ?? null;
  const dateCol = map['block_date'] ?? map['date'] ?? map['slot_date'] ?? null;
  const hourCol = map['block_hour'] ?? map['hour'] ?? map['slot_hour'] ?? null;
  const minuteCol = map['block_minute'] ?? map['minute'] ?? map['slot_minute'] ?? null;

  const values = blockSheet.getRange(2, 1, blockSheet.getLastRow() - 1, blockSheet.getLastColumn()).getValues();
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    var isBlocked = isBlockedCol ? _toBool(row[isBlockedCol - 1]) : false;
    if (!isBlocked) continue;

    var key = keyCol ? String(row[keyCol - 1] || '').trim() : '';
    if (!key) {
      var d = dateCol ? _normalizeYMD(row[dateCol - 1]) : '';
      var h = hourCol ? Number(row[hourCol - 1]) : NaN;
      var m = minuteCol ? Number(row[minuteCol - 1] || 0) : 0;
      if (d && !Number.isNaN(h) && !Number.isNaN(m)) key = d + '-' + h + '-' + m;
    }
    if (!key || !keySet.has(key)) continue;

    var rid = ridCol ? String(row[ridCol - 1] || '').trim() : '';
    if (rid !== reservationIdStr) {
      throw new Error('選択した時間帯はすでに予約済みまたはブロック済みです');
    }
  }

  return true;
}

function _ceilToNext30Min_(dt) {
  const d = new Date(dt.getTime());
  d.setSeconds(0, 0);

  const minute = d.getMinutes();
  if (minute === 0 || minute === 30) return d;

  if (minute < 30) {
    d.setMinutes(30, 0, 0);
    return d;
  }

  d.setHours(d.getHours() + 1);
  d.setMinutes(0, 0, 0);
  return d;
}

function _getPublicApiCacheVersion_(name) {
  const props = PropertiesService.getScriptProperties();
  const key = 'cache_ver_' + String(name || '').trim();
  const cur = Number(props.getProperty(key) || 1);
  return Number.isFinite(cur) && cur > 0 ? cur : 1;
}

function _bumpPublicApiCacheVersion_(name) {
  const props = PropertiesService.getScriptProperties();
  const key = 'cache_ver_' + String(name || '').trim();
  const next = _getPublicApiCacheVersion_(name) + 1;
  props.setProperty(key, String(next));
  return next;
}

function _invalidatePublicBootstrapCache_() {
  return _bumpPublicApiCacheVersion_('public_bootstrap');
}

function _invalidateBlockedSlotKeysCache_() {
  return _bumpPublicApiCacheVersion_('blocked_slot_keys');
}

function _cacheGetJson_(key) {
  const cache = CacheService.getScriptCache();
  const raw = cache.get(String(key || ''));
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

function _cachePutJson_(key, value, ttlSeconds) {
  const cache = CacheService.getScriptCache();
  cache.put(String(key || ''), JSON.stringify(value), Number(ttlSeconds || 60));
}


/***** reservation move_type schema patch start *****/
function _reservationHeaderAliases_() {
  return {
    reservation_id: ['reservation_id', 'reservationid', 'id', '予約id', '予約ID'],
    reservation_datetime: ['reservation_datetime', 'reservationdatetime', '予約日時', 'datetime', 'date_time'],
    usage_type: ['usage_type', 'usagetype', '区分', 'ご利用区分'],
    customer_name: ['customer_name', 'customername', 'name', 'お名前', '名前'],
    phone_number: ['phone_number', 'phonenumber', 'phone', 'tel', 'telephone', '連絡先', '電話番号'],
    pickup_location: ['pickup_location', 'pickuplocation', 'pickup', 'お伺い先', 'お伺い場所', '迎車地', '出発地'],
    destination: ['destination', '送迎先', '目的地'],
    move_type: ['move_type', 'movetype', '移動方法'],
    assistance_type: ['assistance_type', 'assistancetype', '介助内容'],
    stair_assistance: ['stair_assistance', 'stairassistance', '階段介助'],
    equipment_rental: ['equipment_rental', 'equipmentrental', 'equipment', '機材'],
    stretcher_two_staff: ['stretcher_two_staff', 'stretchertwostaff', 'two_staff', 'twostaff', '2名体制', '二名体制'],
    round_trip: ['round_trip', 'roundtrip', '往復', '往復送迎'],
    notes: ['notes', 'note', '備考', 'お問い合わせ', 'お問い先'],
    total_price: ['total_price', 'totalprice', 'price', '料金', '金額'],
    status: ['status', 'ステータス'],
    slot_date: ['slot_date', 'slotdate', 'date', '予約日', '日付'],
    slot_hour: ['slot_hour', 'slothour', 'hour', '時', '予約時'],
    slot_minute: ['slot_minute', 'slotminute', 'minute', '分'],
    is_visible: ['is_visible', 'isvisible', 'visible', '表示'],
    created_at: ['created_at', 'createdat', '作成日時'],
    updated_at: ['updated_at', 'updatedat', '更新日時']
  };
}

function _buildReservationCanonicalObject_(obj) {
  const src = obj || {};
  const out = {};
  for (const k in src) out[k] = src[k];

  for (const k in src) {
    const canonical = _getCanonicalReservationKey_(k);
    if (!canonical) continue;
    if (out[canonical] === undefined || out[canonical] === '') out[canonical] = src[k];
  }

  if ((out.slot_date === undefined || out.slot_date === '') && src.date !== undefined) out.slot_date = src.date;
  if ((out.slot_hour === undefined || out.slot_hour === '') && src.hour !== undefined) out.slot_hour = src.hour;
  if ((out.slot_minute === undefined || out.slot_minute === '') && src.minute !== undefined) out.slot_minute = src.minute;
  if ((out.reservation_id === undefined || out.reservation_id === '') && src.id !== undefined) out.reservation_id = src.id;
  if ((out.customer_name === undefined || out.customer_name === '') && src.name !== undefined) out.customer_name = src.name;
  if ((out.phone_number === undefined || out.phone_number === '') && src.phone !== undefined) out.phone_number = src.phone;
  if ((out.pickup_location === undefined || out.pickup_location === '') && src.pickup !== undefined) out.pickup_location = src.pickup;
  if ((out.move_type === undefined || out.move_type === '') && src.movetype !== undefined) out.move_type = src.movetype;

  if ((out.slot_date !== undefined && out.slot_date !== '') && (out.slot_hour !== undefined && out.slot_hour !== '')) {
    const hh = String(Number(out.slot_hour || 0)).padStart(2, '0');
    const mm = String(Number(out.slot_minute || 0)).padStart(2, '0');
    if (out.reservation_datetime === undefined || out.reservation_datetime === '') {
      out.reservation_datetime = String(out.slot_date) + ' ' + hh + ':' + mm;
    }
    if (out.date === undefined || out.date === '') out.date = out.slot_date;
    if (out.hour === undefined || out.hour === '') out.hour = Number(out.slot_hour || 0);
    if (out.minute === undefined || out.minute === '') out.minute = Number(out.slot_minute || 0);
  }

  return out;
}

function _ensureReservationSheetSchema_(sheet) {
  if (!_isReservationSheet_(sheet)) return;

  const required = [
    'reservation_id', 'reservation_datetime', 'usage_type', 'customer_name', 'phone_number',
    'pickup_location', 'destination', 'move_type', 'assistance_type', 'stair_assistance', 'equipment_rental',
    'stretcher_two_staff', 'round_trip', 'notes', 'total_price', 'status',
    'slot_date', 'slot_hour', 'slot_minute', 'is_visible', 'created_at', 'updated_at'
  ];

  const hm = _headerMap(sheet);
  const headers = hm.headers.slice();
  const existingNorms = new Set(headers.map(function(h) { return _normalizedKey_(h); }).filter(Boolean));
  const toAdd = [];

  required.forEach(function(h) {
    const aliases = _reservationHeaderAliases_()[h] || [h];
    const exists = aliases.some(function(a) { return existingNorms.has(_normalizedKey_(a)); });
    if (!exists) toAdd.push(h);
  });

  if (!toAdd.length) return;

  const startCol = Math.max(sheet.getLastColumn(), 0) + 1;
  sheet.getRange(1, startCol, 1, toAdd.length).setValues([toAdd]);
}
/***** reservation move_type schema patch end *****/
