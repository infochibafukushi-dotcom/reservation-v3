(function () {
  const STORAGE = {
    settings: 'careTaxi.settings.v1',
    reservations: 'careTaxi.reservations.v1',
    adminAuth: 'careTaxi.admin.auth.v1',
  };

  const defaultSettings = {
    businessHours: { start: 9, end: 18, interval: 60 },
    sameDayAllowed: true,
    cutoffHours: 3,
    manualBlocks: [],
    adminPassword: '95123',
    menus: [
      { id: 'normal', name: '通常送迎（片道）', price: 2500 },
      { id: 'hospital', name: '通院付き添いプラン', price: 4800 },
      { id: 'shopping', name: '買い物付き添いプラン', price: 6500 },
    ],
    options: [
      { id: 'stairs', name: '階段介助', price: 800, visible: true },
      { id: 'night', name: '夜間対応', price: 1200, visible: true },
      { id: 'extra', name: '追加付き添い', price: 1500, visible: true },
      { id: 'assist2', name: '2名介助', price: 2000, visible: false },
    ],
    mobilityMethods: [
      { id: 'walk', name: '歩行', price: 0 },
      { id: 'wheelchair', name: '車椅子', price: 1000 },
    ],
    stretcher: { enabled: true, fee: 3000 },
    internalFee: 200,
    autoOptions: [{ id: 'assist2', when: { stretcher: true } }],
  };

  const load = (key, fallback) => {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
  };
  const save = (key, value) => localStorage.setItem(key, JSON.stringify(value));

  const getSettings = () => {
    const current = load(STORAGE.settings, null);
    if (!current) { save(STORAGE.settings, defaultSettings); return structuredClone(defaultSettings); }
    return { ...defaultSettings, ...current };
  };
  const setSettings = (s) => save(STORAGE.settings, s);
  const getReservations = () => load(STORAGE.reservations, []);
  const setReservations = (rows) => save(STORAGE.reservations, rows);

  const setAdminAuthenticated = (ok) => save(STORAGE.adminAuth, { ok, at: Date.now() });
  const isAdminAuthenticated = () => Boolean(load(STORAGE.adminAuth, {}).ok);
  const clearAdminAuthenticated = () => localStorage.removeItem(STORAGE.adminAuth);

  const pad = (n) => String(n).padStart(2, '0');
  const toDateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const formatJPDate = (d) => `${d.getMonth() + 1}/${d.getDate()}(${['日', '月', '火', '水', '木', '金', '土'][d.getDay()]})`;
  const weekDates = () => Array.from({ length: 7 }).map((_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return d; });
  const slotKey = (dateKey, time) => `${dateKey} ${time}`;

  function slotTimes(settings) {
    const { start, end, interval } = settings.businessHours;
    const rows = [];
    for (let h = start; h <= end; h++) { rows.push(`${pad(h)}:00`); if (interval === 30 && h !== end) rows.push(`${pad(h)}:30`); }
    return rows;
  }

  const isSameDay = (dateKey) => dateKey === toDateKey(new Date());
  const isPastCutoff = (dateKey, time, settings) => {
    const now = new Date();
    const [y, m, d] = dateKey.split('-').map(Number);
    const [hh, mm] = time.split(':').map(Number);
    return (new Date(y, m - 1, d, hh, mm, 0) - now) / 36e5 < settings.cutoffHours;
  };

  function hoursUntil(dateKey, time) {
    const now = new Date();
    const [y, m, d] = dateKey.split('-').map(Number);
    const [hh, mm] = time.split(':').map(Number);
    return (new Date(y, m - 1, d, hh, mm, 0) - now) / 36e5;
  }

  function statusOfSlot(dateKey, time, reservations, settings) {
    const key = slotKey(dateKey, time);
    if (reservations.some((r) => r.slotKey === key && r.status !== '無効')) return 'reserved';
    if (settings.manualBlocks.includes(key)) return 'blocked';
    if (!settings.sameDayAllowed && isSameDay(dateKey)) return 'blocked';
    const left = hoursUntil(dateKey, time);
    if (left < settings.cutoffHours) return 'blocked';
    if (left < settings.cutoffHours + 1) return 'limited';
    return 'open';
  }

  function calculateTotal({ menuId, mobilityId, selectedOptions, stretcher }, settings) {
    const menu = settings.menus.find((m) => m.id === menuId);
    const mobility = settings.mobilityMethods.find((m) => m.id === mobilityId);
    const optSet = new Set(selectedOptions);
    settings.autoOptions.forEach((r) => { if (r.when?.stretcher && stretcher) optSet.add(r.id); });

    let total = (menu?.price || 0) + (mobility?.price || 0) + (settings.internalFee || 0);
    const details = [`メニュー:${menu?.price || 0}`, `移動:${mobility?.price || 0}`];
    settings.options.forEach((o) => { if (optSet.has(o.id)) { total += Number(o.price || 0); details.push(`${o.name}:${o.price}`); } });
    if (stretcher && settings.stretcher?.enabled) { total += Number(settings.stretcher.fee || 0); details.push(`ストレッチャー:${settings.stretcher.fee || 0}`); }
    details.push(`内部加算:${settings.internalFee || 0}`);
    return { total, details: details.join(' / '), appliedOptions: [...optSet] };
  }

  function bindHiddenAdminEntry() {
    const icon = document.getElementById('secretAdminIcon');
    const modal = document.getElementById('adminEntryModal');
    if (!icon || !modal) return;

    const form = document.getElementById('adminEntryForm');
    const input = document.getElementById('adminEntryPassword');
    const err = document.getElementById('adminEntryError');
    document.getElementById('adminEntryCancel').onclick = () => modal.close();

    let taps = [];
    const windowMs = 2500;
    icon.addEventListener('click', () => {
      const now = Date.now();
      taps = taps.filter((t) => now - t <= windowMs);
      taps.push(now);
      if (taps.length >= 5) {
        taps = [];
        err.textContent = '';
        form.reset();
        modal.showModal();
      }
    });

    form.onsubmit = (e) => {
      e.preventDefault();
      const settings = getSettings();
      if (input.value === settings.adminPassword) {
        setAdminAuthenticated(true);
        location.href = 'admin.html';
      } else {
        err.textContent = 'パスワードが違います';
      }
    };
  }

  function initPublic() {
    bindHiddenAdminEntry();

    const state = { settings: getSettings(), reservations: getReservations(), dates: weekDates(), selectedDateKey: null, selectedTime: null };
    const times = slotTimes(state.settings);

    const calendarGrid = document.getElementById('calendarGrid');
    const ruleSummary = document.getElementById('ruleSummary');
    const todayList = document.getElementById('todayList');
    const doneCard = document.getElementById('doneCard');
    const doneMessage = document.getElementById('doneMessage');

    ruleSummary.textContent = `当日予約:${state.settings.sameDayAllowed ? '可' : '不可'} / 現在+${state.settings.cutoffHours}時間締切`;

    function renderCalendarStructure() {
      const head = ['<div class="cell head"></div>']
        .concat(state.dates.map((d) => `<div class="cell head">${formatJPDate(d)}</div>`))
        .join('');
      const body = times
        .map((t) => {
          const cols = state.dates
            .map((d) => {
              const dateKey = toDateKey(d);
              return `<div class="cell"><button type="button" class="slot-btn" data-date="${dateKey}" data-time="${t}">-</button></div>`;
            })
            .join('');
          return `<div class="cell time">${t}</div>${cols}`;
        })
        .join('');
      calendarGrid.innerHTML = head + body;
    }

    function patchSlotStates() {
      calendarGrid.querySelectorAll('button[data-date][data-time]').forEach((btn) => {
        const dateKey = btn.dataset.date;
        const time = btn.dataset.time;
        const status = statusOfSlot(dateKey, time, state.reservations, state.settings);
        btn.className = `slot-btn ${status}` + (state.selectedDateKey === dateKey && state.selectedTime === time ? ' is-selected' : '');
        btn.disabled = status === 'blocked' || status === 'reserved';
        btn.innerHTML = status === 'open' ? '◎' : status === 'limited' ? '△' : '×';
      });
    }

    function renderToday() {
      const today = toDateKey(new Date());
      const rows = state.reservations.filter((r) => r.dateKey === today && r.status !== '無効');
      todayList.innerHTML = rows.length ? rows.map((r) => `<article class="item">${r.time} ${r.name} / ${r.menuName} / ¥${r.total}</article>`).join('') : '<article class="item muted">本日の予約はありません</article>';
    }

    calendarGrid.onclick = (e) => {
      const b = e.target.closest('button[data-date][data-time]');
      if (!b || b.disabled) return;
      state.selectedDateKey = b.dataset.date;
      state.selectedTime = b.dataset.time;
      patchSlotStates();
      openBookingModal(state, {
        onBooked: (message) => {
          doneCard.classList.remove('hidden');
          doneMessage.textContent = message;
          state.reservations = getReservations();
          patchSlotStates();
          renderToday();
        },
      });
    };

    renderCalendarStructure();
    patchSlotStates();
    renderToday();
  }

  function openBookingModal(state, hooks) {
    const modal = document.getElementById('bookingModal');
    const form = document.getElementById('bookingForm');
    const selectedSlot = document.getElementById('selectedSlot');
    const menu = document.getElementById('menu');
    const mobility = document.getElementById('mobility');
    const optionList = document.getElementById('optionList');
    const stretcher = document.getElementById('stretcher');
    const totalPrice = document.getElementById('totalPrice');
    const priceDetail = document.getElementById('priceDetail');
    const formError = document.getElementById('formError');

    selectedSlot.textContent = `${state.selectedDateKey} ${state.selectedTime}`;
    menu.innerHTML = state.settings.menus.map((m) => `<option value="${m.id}">${m.name} / ¥${m.price}</option>`).join('');
    mobility.innerHTML = state.settings.mobilityMethods.map((m) => `<option value="${m.id}">${m.name}${m.price ? ` / ¥${m.price}` : ''}</option>`).join('');
    optionList.innerHTML = state.settings.options.filter((o) => o.visible !== false).map((o) => `<label class="checkbox-item"><input type="checkbox" name="options" value="${o.id}"/>${o.name} (+¥${o.price})</label>`).join('');

    const updateTotal = () => {
      const selectedOptions = [...form.querySelectorAll('input[name="options"]:checked')].map((n) => n.value);
      const calc = calculateTotal({ menuId: menu.value, mobilityId: mobility.value, selectedOptions, stretcher: stretcher.checked }, state.settings);
      totalPrice.textContent = calc.total.toLocaleString('ja-JP');
      priceDetail.textContent = calc.details;
      return calc;
    };

    form.reset(); formError.textContent = ''; updateTotal();
    form.oninput = updateTotal;
    document.getElementById('cancelBtn').onclick = () => modal.close();

    form.onsubmit = (e) => {
      e.preventDefault();
      const name = form.elements.name.value.trim();
      const phone = form.elements.phone.value.trim();
      if (!name) return (formError.textContent = '名前を入力してください');
      if (!/^\d{10,11}$/.test(phone)) return (formError.textContent = '連絡先は10〜11桁の数字で入力してください');

      const calc = updateTotal();
      const menuObj = state.settings.menus.find((m) => m.id === menu.value);
      const current = getReservations();
      current.push({
        id: crypto.randomUUID(), name, phone,
        dateKey: state.selectedDateKey, time: state.selectedTime, slotKey: slotKey(state.selectedDateKey, state.selectedTime),
        menuId: menu.value, menuName: menuObj?.name || '', mobilityId: mobility.value,
        stretcher: stretcher.checked, options: calc.appliedOptions, total: calc.total,
        status: '確定', createdAt: new Date().toISOString(),
      });
      setReservations(current);
      modal.close('ok');
      hooks.onBooked(`予約が確定しました：${state.selectedDateKey} ${state.selectedTime} / ${name} / ¥${calc.total.toLocaleString('ja-JP')}`);
    };

    modal.showModal();
  }

  window.CareTaxi = {
    STORAGE,
    getSettings, setSettings, getReservations, setReservations,
    setAdminAuthenticated, isAdminAuthenticated, clearAdminAuthenticated,
    weekDates, slotTimes, toDateKey, formatJPDate, statusOfSlot,
  };

  if (document.body.dataset.page === 'public') initPublic();
})();
