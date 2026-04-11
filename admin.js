(function () {
  if (document.body.dataset.page !== 'admin') return;

  const loginBtn = document.getElementById('loginBtn');
  const passInput = document.getElementById('adminPassword');
  const loginError = document.getElementById('loginError');

  const loginCard = document.getElementById('loginCard');
  const adminPanel = document.getElementById('adminPanel');
  const blockPanel = document.getElementById('blockPanel');
  const catalogPanel = document.getElementById('catalogPanel');
  const reservationPanel = document.getElementById('reservationPanel');

  function showPanels() {
    adminPanel.classList.remove('hidden');
    blockPanel.classList.remove('hidden');
    catalogPanel.classList.remove('hidden');
    reservationPanel.classList.remove('hidden');
  }

  function renderRuleForm() {
    const settings = window.CareTaxi.getSettings();
    document.getElementById('startHour').value = settings.businessHours.start;
    document.getElementById('endHour').value = settings.businessHours.end;
    document.getElementById('interval').value = settings.businessHours.interval;
    document.getElementById('cutoffHours').value = settings.cutoffHours;
    document.getElementById('sameDayAllowed').checked = settings.sameDayAllowed;

    document.getElementById('menuJson').value = JSON.stringify(settings.menus, null, 2);
    document.getElementById('optionJson').value = JSON.stringify(settings.options, null, 2);
    document.getElementById('mobilityJson').value = JSON.stringify(settings.mobilityMethods, null, 2);
    document.getElementById('stretcherFee').value = settings.stretcher?.fee || 0;
    document.getElementById('internalFee').value = settings.internalFee || 0;
  }

  function renderAdminCalendar() {
    const settings = window.CareTaxi.getSettings();
    const reservations = window.CareTaxi.getReservations();
    const dates = window.CareTaxi.weekDates();
    const times = window.CareTaxi.slotTimes(settings);
    const root = document.getElementById('adminCalendarGrid');

    const head = ['<div class="cell head"></div>']
      .concat(dates.map((d) => `<div class="cell head">${window.CareTaxi.formatJPDate(d)}</div>`))
      .join('');

    const rows = times
      .map((t) => {
        const cols = dates
          .map((d) => {
            const dateKey = window.CareTaxi.toDateKey(d);
            const state = window.CareTaxi.statusOfSlot(dateKey, t, reservations, settings);
            const key = `${dateKey} ${t}`;
            const lockedByReservation = reservations.some((r) => r.slotKey === key);
            return `<div class="cell"><button class="slot-btn ${state}" data-key="${key}" ${
              lockedByReservation ? 'disabled' : ''
            }>${state === 'open' ? '◎' : '×'}</button></div>`;
          })
          .join('');
        return `<div class="cell time">${t}</div>${cols}`;
      })
      .join('');

    root.innerHTML = head + rows;

    root.onclick = (e) => {
      const btn = e.target.closest('.slot-btn');
      if (!btn || btn.disabled) return;
      const settingsNow = window.CareTaxi.getSettings();
      const key = btn.dataset.key;
      const idx = settingsNow.manualBlocks.indexOf(key);
      if (idx >= 0) settingsNow.manualBlocks.splice(idx, 1);
      else settingsNow.manualBlocks.push(key);
      window.CareTaxi.setSettings(settingsNow);
      renderAdminCalendar();
    };
  }

  function renderReservations() {
    const root = document.getElementById('reservationList');
    const rows = window.CareTaxi.getReservations().sort((a, b) => `${a.dateKey} ${a.time}`.localeCompare(`${b.dateKey} ${b.time}`));
    root.innerHTML = rows.length
      ? rows
          .map(
            (r) => `<article class="item">
              <strong>${r.dateKey} ${r.time} / ${r.name}</strong><br>
              ${r.phone} / ${r.menuName} / ¥${r.total} / ${r.status}
              <div class="row-actions">
                <button data-id="${r.id}" data-act="edit">時間変更</button>
                <button data-id="${r.id}" data-act="delete" class="secondary">削除</button>
              </div>
            </article>`,
          )
          .join('')
      : '<article class="item muted">予約なし</article>';

    root.onclick = (e) => {
      const b = e.target.closest('button[data-id]');
      if (!b) return;
      const act = b.dataset.act;
      const id = b.dataset.id;
      const all = window.CareTaxi.getReservations();
      const target = all.find((x) => x.id === id);
      if (!target) return;

      if (act === 'delete') {
        const next = all.filter((x) => x.id !== id);
        window.CareTaxi.setReservations(next);
      }

      if (act === 'edit') {
        const newTime = prompt('新しい時間（例 13:00）', target.time);
        if (newTime && /^\d{2}:\d{2}$/.test(newTime)) {
          target.time = newTime;
          target.slotKey = `${target.dateKey} ${newTime}`;
          window.CareTaxi.setReservations(all);
        }
      }
      renderReservations();
      renderAdminCalendar();
    };
  }

  function saveRules() {
    const s = window.CareTaxi.getSettings();
    s.businessHours.start = Number(document.getElementById('startHour').value);
    s.businessHours.end = Number(document.getElementById('endHour').value);
    s.businessHours.interval = Number(document.getElementById('interval').value);
    s.cutoffHours = Number(document.getElementById('cutoffHours').value);
    s.sameDayAllowed = document.getElementById('sameDayAllowed').checked;
    window.CareTaxi.setSettings(s);
    renderAdminCalendar();
  }

  function saveCatalog() {
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
  }

  loginBtn.onclick = () => {
    const settings = window.CareTaxi.getSettings();
    if (passInput.value !== settings.adminPassword) {
      loginError.textContent = 'パスワードが違います';
      return;
    }
    loginCard.classList.add('hidden');
    showPanels();
    renderRuleForm();
    renderAdminCalendar();
    renderReservations();
  };

  document.getElementById('saveRules').onclick = saveRules;
  document.getElementById('saveCatalog').onclick = saveCatalog;
})();
