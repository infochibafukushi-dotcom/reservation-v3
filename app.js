(function () {
  const STORAGE = {
    settings: 'careTaxi.settings.v1',
    reservations: 'careTaxi.reservations.v1',
  };

  const defaultSettings = {
    businessHours: { start: 9, end: 18, interval: 60 },
    sameDayAllowed: true,
    cutoffHours: 3,
    manualBlocks: [],
    adminPassword: 'admin123',
    menus: [
      { id: 'normal', name: '通常送迎（片道）', price: 2500 },
      { id: 'hospital', name: '通院付き添いプラン', price: 4800 },
      { id: 'shopping', name: '買い物付き添いプラン', price: 6500 },
    ],
    options: [
      { id: 'stairs', name: '階段介助', price: 800 },
      { id: 'night', name: '夜間対応', price: 1200 },
      { id: 'extra', name: '追加付き添い', price: 1500 },
    ],
    mobilityMethods: [
      { id: 'walk', name: '歩行', price: 0 },
      { id: 'wheelchair', name: '車椅子', price: 1000 },
    ],
    stretcher: { enabled: true, fee: 3000 },
    internalFee: 200,
    autoOptions: [{ id: 'stairs', when: { mobility: 'wheelchair' } }],
  };

  const defaultReservations = [];

  function load(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch {
      return fallback;
    }
  }

  function save(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function getSettings() {
    const current = load(STORAGE.settings, null);
    if (!current) {
      save(STORAGE.settings, defaultSettings);
      return structuredClone(defaultSettings);
    }
    return { ...defaultSettings, ...current };
  }

  function getReservations() {
    return load(STORAGE.reservations, defaultReservations);
  }

  function setReservations(rows) {
    save(STORAGE.reservations, rows);
  }

  function setSettings(settings) {
    save(STORAGE.settings, settings);
  }

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function toDateKey(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function formatJPDate(date) {
    const days = ['日', '月', '火', '水', '木', '金', '土'];
    return `${date.getMonth() + 1}/${date.getDate()}(${days[date.getDay()]})`;
  }

  function weekDates() {
    const arr = [];
    const now = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(now);
      d.setDate(now.getDate() + i);
      arr.push(d);
    }
    return arr;
  }

  function slotTimes(settings) {
    const { start, end, interval } = settings.businessHours;
    const rows = [];
    for (let h = start; h <= end; h++) {
      if (interval === 60) {
        rows.push(`${pad(h)}:00`);
      } else {
        rows.push(`${pad(h)}:00`);
        if (h !== end) rows.push(`${pad(h)}:30`);
      }
    }
    return rows;
  }

  function slotKey(dateKey, time) {
    return `${dateKey} ${time}`;
  }

  function isPastCutoff(dateKey, time, settings) {
    const now = new Date();
    const [y, m, d] = dateKey.split('-').map(Number);
    const [hh, mm] = time.split(':').map(Number);
    const target = new Date(y, m - 1, d, hh, mm, 0);
    const diffHours = (target.getTime() - now.getTime()) / 1000 / 60 / 60;
    return diffHours < settings.cutoffHours;
  }

  function isSameDay(dateKey) {
    return dateKey === toDateKey(new Date());
  }

  function calculateTotal({ menuId, mobilityId, selectedOptions, stretcher }, settings) {
    const menu = settings.menus.find((m) => m.id === menuId);
    const mobility = settings.mobilityMethods.find((m) => m.id === mobilityId);
    const optionSet = new Set(selectedOptions);

    settings.autoOptions.forEach((rule) => {
      if (rule.when?.mobility === mobilityId) optionSet.add(rule.id);
    });

    let total = (menu?.price || 0) + (mobility?.price || 0) + (settings.internalFee || 0);
    const details = [`メニュー:${menu?.price || 0}`, `移動:${mobility?.price || 0}`, `内部:${settings.internalFee || 0}`];

    settings.options.forEach((opt) => {
      if (optionSet.has(opt.id)) {
        total += Number(opt.price || 0);
        details.push(`${opt.name}:${opt.price}`);
      }
    });

    if (stretcher === 'yes' && settings.stretcher?.enabled) {
      total += Number(settings.stretcher.fee || 0);
      details.push(`ストレッチャー:${settings.stretcher.fee || 0}`);
    }

    return { total, details: details.join(' / '), appliedOptions: [...optionSet] };
  }

  function statusOfSlot(dateKey, time, reservations, settings) {
    const key = slotKey(dateKey, time);
    if (reservations.some((r) => r.slotKey === key)) return 'reserved';
    if (settings.manualBlocks.includes(key)) return 'blocked';
    if (!settings.sameDayAllowed && isSameDay(dateKey)) return 'blocked';
    if (isPastCutoff(dateKey, time, settings)) return 'blocked';
    return 'open';
  }

  function initPublic() {
    const settings = getSettings();
    const reservations = getReservations();
    const dates = weekDates();
    const times = slotTimes(settings);

    const weekHeader = document.getElementById('weekHeader');
    const calendarGrid = document.getElementById('calendarGrid');
    const ruleSummary = document.getElementById('ruleSummary');
    const todayList = document.getElementById('todayList');
    const recentList = document.getElementById('recentList');

    ruleSummary.textContent = `締切: 現在+${settings.cutoffHours}時間 / 当日予約: ${settings.sameDayAllowed ? '可' : '不可'}`;

    weekHeader.innerHTML = dates
      .map((d, i) => `<div class="date-tab ${i === 0 ? 'is-today' : ''}">${formatJPDate(d)}</div>`)
      .join('');

    const head = ['<div class="cell head"></div>']
      .concat(dates.map((d) => `<div class="cell head">${d.getDate()}日</div>`))
      .join('');

    const rows = times
      .map((t) => {
        const line = dates
          .map((d) => {
            const dateKey = toDateKey(d);
            const s = statusOfSlot(dateKey, t, reservations, settings);
            const mark = s === 'open' ? '◎' : '×';
            return `<div class="cell"><button class="slot-btn ${s} ${isSameDay(dateKey) ? 'today' : ''}" data-date="${dateKey}" data-time="${t}" ${
              s !== 'open' ? 'disabled' : ''
            }>${mark}</button></div>`;
          })
          .join('');
        return `<div class="cell time">${t}</div>${line}`;
      })
      .join('');

    calendarGrid.innerHTML = head + rows;

    const todayKey = toDateKey(new Date());
    const todays = reservations.filter((r) => r.dateKey === todayKey);
    todayList.innerHTML = todays.length
      ? todays
          .map(
            (r) => `<article class="item">${r.time} ${r.name} / ${r.menuName}<br><span class="muted">${r.phone} / ${r.status}</span></article>`,
          )
          .join('')
      : '<article class="item muted">本日の予約はありません</article>';

    recentList.innerHTML = reservations.length
      ? reservations
          .slice(-5)
          .reverse()
          .map((r) => `<article class="item">${r.dateKey} ${r.time} / ${r.name} / 合計¥${r.total}</article>`)
          .join('')
      : '<article class="item muted">予約データなし</article>';

    bindBookingModal(settings, reservations);
  }

  function bindBookingModal(settings, reservations) {
    const modal = document.getElementById('bookingModal');
    if (!modal) return;
    const form = document.getElementById('bookingForm');
    const selectedSlot = document.getElementById('selectedSlot');
    const menu = document.getElementById('menu');
    const mobility = document.getElementById('mobility');
    const stretcher = document.getElementById('stretcher');
    const optionList = document.getElementById('optionList');
    const totalPrice = document.getElementById('totalPrice');
    const priceDetail = document.getElementById('priceDetail');
    const formError = document.getElementById('formError');
    const cancelBtn = document.getElementById('cancelBtn');

    menu.innerHTML = settings.menus.map((m) => `<option value="${m.id}">${m.name} / ¥${m.price}</option>`).join('');
    mobility.innerHTML = settings.mobilityMethods
      .map((m) => `<option value="${m.id}">${m.name}${m.price ? ` / ¥${m.price}` : ''}</option>`)
      .join('');
    optionList.innerHTML = settings.options
      .map(
        (o) =>
          `<label class="checkbox-item"><input type="checkbox" name="options" value="${o.id}"/>${o.name} (+¥${o.price})</label>`,
      )
      .join('');

    let activeDate = null;
    let activeTime = null;

    function updateTotal() {
      const selectedOptions = [...form.querySelectorAll('input[name="options"]:checked')].map((n) => n.value);
      const calc = calculateTotal(
        {
          menuId: menu.value,
          mobilityId: mobility.value,
          selectedOptions,
          stretcher: stretcher.value,
        },
        settings,
      );
      totalPrice.textContent = calc.total.toLocaleString('ja-JP');
      priceDetail.textContent = calc.details;
      return calc;
    }

    document.getElementById('calendarGrid').addEventListener('click', (e) => {
      const btn = e.target.closest('.slot-btn.open');
      if (!btn) return;
      activeDate = btn.dataset.date;
      activeTime = btn.dataset.time;
      selectedSlot.textContent = `選択枠: ${activeDate} ${activeTime}`;
      formError.textContent = '';
      form.reset();
      updateTotal();
      modal.showModal();
    });

    form.addEventListener('input', updateTotal);
    cancelBtn.addEventListener('click', () => modal.close());

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!activeDate || !activeTime) return;

      const name = form.elements.name.value.trim();
      const phone = form.elements.phone.value.trim();
      if (!name) {
        formError.textContent = 'お名前を入力してください';
        return;
      }
      if (!/^\d{10,11}$/.test(phone)) {
        formError.textContent = '電話番号はハイフン無し10〜11桁で入力してください';
        return;
      }

      const calc = updateTotal();
      const menuObj = settings.menus.find((m) => m.id === menu.value);
      const record = {
        id: crypto.randomUUID(),
        name,
        phone,
        dateKey: activeDate,
        time: activeTime,
        slotKey: slotKey(activeDate, activeTime),
        menuId: menu.value,
        menuName: menuObj?.name || '',
        mobilityId: mobility.value,
        stretcher: stretcher.value,
        options: calc.appliedOptions,
        total: calc.total,
        status: '確定',
        createdAt: new Date().toISOString(),
      };

      reservations.push(record);
      setReservations(reservations);
      modal.close('ok');
      alert(`予約を確定しました。\n合計 ¥${calc.total.toLocaleString('ja-JP')}`);
      initPublic();
    });

    updateTotal();
  }

  window.CareTaxi = {
    STORAGE,
    getSettings,
    setSettings,
    getReservations,
    setReservations,
    weekDates,
    slotTimes,
    toDateKey,
    formatJPDate,
    statusOfSlot,
  };

  if (document.body.dataset.page === 'public') {
    initPublic();
  }
})();
