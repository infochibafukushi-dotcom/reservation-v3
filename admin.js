(function () {
  if (document.body.dataset.page !== 'admin') return;

  const blockedCard = document.getElementById('blockedCard');
  const panels = ['securityPanel', 'adminPanel', 'blockPanel', 'catalogPanel', 'reservationPanel'].map((id) => document.getElementById(id));

  function showPanels() {
    blockedCard.classList.add('hidden');
    panels.forEach((p) => p.classList.remove('hidden'));
  }

  if (!window.CareTaxi.isAdminAuthenticated()) {
    blockedCard.classList.remove('hidden');
    return;
  }
  showPanels();

  function renderRuleForm() {
    const s = window.CareTaxi.getSettings();
    document.getElementById('startHour').value = s.businessHours.start;
    document.getElementById('endHour').value = s.businessHours.end;
    document.getElementById('interval').value = s.businessHours.interval;
    document.getElementById('cutoffHours').value = s.cutoffHours;
    document.getElementById('sameDayAllowed').checked = s.sameDayAllowed;
    document.getElementById('menuJson').value = JSON.stringify(s.menus, null, 2);
    document.getElementById('optionJson').value = JSON.stringify(s.options, null, 2);
    document.getElementById('mobilityJson').value = JSON.stringify(s.mobilityMethods, null, 2);
    document.getElementById('stretcherFee').value = s.stretcher?.fee || 0;
    document.getElementById('internalFee').value = s.internalFee || 0;
  }

  function renderAdminCalendar() {
    const s = window.CareTaxi.getSettings();
    const rs = window.CareTaxi.getReservations();
    const dates = window.CareTaxi.weekDates();
    const times = window.CareTaxi.slotTimes(s);
    const root = document.getElementById('adminCalendarGrid');

    const head = ['<div class="cell head"></div>'].concat(dates.map((d) => `<div class="cell head">${window.CareTaxi.formatJPDate(d)}</div>`)).join('');
    const rows = times.map((t) => {
      const cols = dates.map((d) => {
        const dateKey = window.CareTaxi.toDateKey(d);
        const state = window.CareTaxi.statusOfSlot(dateKey, t, rs, s);
        const key = `${dateKey} ${t}`;
        const locked = rs.some((r) => r.slotKey === key && r.status !== '無効');
        return `<div class="cell"><button class="slot-btn ${state}" data-key="${key}" ${locked ? 'disabled' : ''}>${state === 'open' ? '◎' : '×'}</button></div>`;
      }).join('');
      return `<div class="cell time">${t}</div>${cols}`;
    }).join('');

    root.innerHTML = head + rows;
    root.onclick = (e) => {
      const btn = e.target.closest('.slot-btn');
      if (!btn || btn.disabled) return;
      const settings = window.CareTaxi.getSettings();
      const key = btn.dataset.key;
      const idx = settings.manualBlocks.indexOf(key);
      if (idx >= 0) settings.manualBlocks.splice(idx, 1); else settings.manualBlocks.push(key);
      window.CareTaxi.setSettings(settings);
      renderAdminCalendar();
    };
  }

  function applyBlockByDay(date, block) {
    if (!date) return;
    const s = window.CareTaxi.getSettings();
    const times = window.CareTaxi.slotTimes(s);
    const set = new Set(s.manualBlocks);
    times.forEach((t) => {
      const key = `${date} ${t}`;
      if (block) set.add(key); else set.delete(key);
    });
    s.manualBlocks = [...set];
    window.CareTaxi.setSettings(s);
    renderAdminCalendar();
  }

  function renderReservations() {
    const list = document.getElementById('reservationList');
    const dateFilter = document.getElementById('filterDate').value;
    const q = (document.getElementById('searchText').value || '').trim();

    let rows = window.CareTaxi.getReservations();
    if (dateFilter) rows = rows.filter((r) => r.dateKey === dateFilter);
    if (q) rows = rows.filter((r) => `${r.name} ${r.phone}`.includes(q));
    rows.sort((a, b) => `${a.dateKey} ${a.time}`.localeCompare(`${b.dateKey} ${b.time}`));

    list.innerHTML = rows.length
      ? rows.map((r) => `<article class="item"><strong>${r.dateKey} ${r.time} / ${r.name}</strong><br>${r.phone} / ${r.menuName} / ¥${r.total}<br>状態:${r.status}
      <div class="row-actions">
        <button data-id="${r.id}" data-act="toggle">有効/無効切替</button>
        <button data-id="${r.id}" data-act="edit" class="secondary">時間変更</button>
        <button data-id="${r.id}" data-act="delete" class="secondary">削除</button>
      </div></article>`).join('')
      : '<article class="item muted">該当予約なし</article>';

    list.onclick = (e) => {
      const b = e.target.closest('button[data-id]');
      if (!b) return;
      const all = window.CareTaxi.getReservations();
      const r = all.find((x) => x.id === b.dataset.id);
      if (!r) return;
      if (b.dataset.act === 'delete') {
        window.CareTaxi.setReservations(all.filter((x) => x.id !== r.id));
      } else if (b.dataset.act === 'edit') {
        const t = prompt('新しい時間（例 13:00）', r.time);
        if (t && /^\d{2}:\d{2}$/.test(t)) { r.time = t; r.slotKey = `${r.dateKey} ${t}`; window.CareTaxi.setReservations(all); }
      } else if (b.dataset.act === 'toggle') {
        r.status = r.status === '無効' ? '確定' : '無効';
        window.CareTaxi.setReservations(all);
      }
      renderReservations();
      renderAdminCalendar();
    };
  }

  document.getElementById('saveRules').onclick = () => {
    const s = window.CareTaxi.getSettings();
    s.businessHours.start = Number(document.getElementById('startHour').value);
    s.businessHours.end = Number(document.getElementById('endHour').value);
    s.businessHours.interval = Number(document.getElementById('interval').value);
    s.cutoffHours = Number(document.getElementById('cutoffHours').value);
    s.sameDayAllowed = document.getElementById('sameDayAllowed').checked;
    window.CareTaxi.setSettings(s);
    renderAdminCalendar();
  };

  document.getElementById('saveCatalog').onclick = () => {
    const err = document.getElementById('catalogError');
    err.textContent = '';
    try {
      const s = window.CareTaxi.getSettings();
      s.menus = JSON.parse(document.getElementById('menuJson').value);
      s.options = JSON.parse(document.getElementById('optionJson').value);
      s.mobilityMethods = JSON.parse(document.getElementById('mobilityJson').value);
      s.stretcher.fee = Number(document.getElementById('stretcherFee').value || 0);
      s.internalFee = Number(document.getElementById('internalFee').value || 0);
      window.CareTaxi.setSettings(s);
      renderAdminCalendar();
    } catch {
      err.textContent = 'JSON形式が不正です';
    }
  };

  document.getElementById('applyFilter').onclick = renderReservations;
  document.getElementById('blockDayBtn').onclick = () => applyBlockByDay(document.getElementById('bulkDate').value, true);
  document.getElementById('unblockDayBtn').onclick = () => applyBlockByDay(document.getElementById('bulkDate').value, false);
  document.getElementById('blockTimeBtn').onclick = () => {
    const d = document.getElementById('partialDate').value;
    const t = document.getElementById('partialTime').value;
    if (!d || !t) return;
    const s = window.CareTaxi.getSettings();
    const key = `${d} ${t}`;
    if (!s.manualBlocks.includes(key)) s.manualBlocks.push(key);
    window.CareTaxi.setSettings(s);
    renderAdminCalendar();
  };

  document.getElementById('logoutBtn').onclick = () => {
    window.CareTaxi.clearAdminAuthenticated();
    location.href = 'index.html';
  };

  document.getElementById('changePasswordBtn').onclick = () => {
    const next = document.getElementById('newPassword').value.trim();
    const msg = document.getElementById('securityMsg');
    if (!next) return (msg.textContent = '新パスワードを入力してください');
    const s = window.CareTaxi.getSettings();
    s.adminPassword = next;
    window.CareTaxi.setSettings(s);
    msg.textContent = 'パスワードを変更しました';
  };

  renderRuleForm();
  renderAdminCalendar();
  renderReservations();
})();
