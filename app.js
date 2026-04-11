(() => {
  const STORAGE = {
    settings: 'careTaxi.settings.v1',
    reservations: 'careTaxi.reservations.v1',
    adminAuth: 'careTaxi.admin.auth.v1',
  };



  // ---- Backend integration (Cloudflare disabled / GitHub Contents API enabled) ----
  const CLOUDFLARE_DISABLED = true; // Cloudflare処理は無効化（削除しない方針に合わせる）
  const GITHUB_CONFIG = {
    enabled: true, // trueにするとGitHub Contents API同期を試行
    owner: '',
    repo: '',
    branch: 'main',
    tokenStorageKey: 'chiba_care_taxi_github_backend_v1',
    settingsPath: 'data/settings.json',
    reservationsPath: 'data/reservations.json',
  };

  const githubBackend = {
    api(path) {
      return `https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${path}?ref=${GITHUB_CONFIG.branch}`;
    },
    token() {
      return localStorage.getItem(GITHUB_CONFIG.tokenStorageKey) || '';
    },
    headers() {
      const token = this.token();
      return token ? { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' } : { Accept: 'application/vnd.github+json' };
    },
    async readJSON(path) {
      const res = await fetch(this.api(path), { headers: this.headers() });
      if (!res.ok) throw new Error(`GitHub read failed: ${res.status}`);
      const payload = await res.json();
      const raw = atob(payload.content.replace(/\n/g, ''));
      return { json: JSON.parse(raw), sha: payload.sha };
    },
    async writeJSON(path, json, message) {
      const current = await this.readJSON(path).catch(() => ({ sha: null }));
      const body = {
        message,
        branch: GITHUB_CONFIG.branch,
        content: btoa(unescape(encodeURIComponent(JSON.stringify(json, null, 2)))),
      };
      if (current.sha) body.sha = current.sha;
      const res = await fetch(this.api(path), {
        method: 'PUT',
        headers: { ...this.headers(), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`GitHub write failed: ${res.status}`);
      return res.json();
    },
  };

  async function syncToGitHub(path, json, message, storageKey) {
    if (!GITHUB_CONFIG.enabled) return;
    try {
      await githubBackend.writeJSON(path, json, message);
      const remote = await githubBackend.readJSON(path); // 保存→即GitHub再読込
      save(storageKey, remote.json);
      window.dispatchEvent(new CustomEvent('caretaxi:data-synced', { detail: { path, storageKey } }));
    } catch (e) {
      console.warn('[GitHub Sync]', e.message);
    }
  }

  async function bootstrapFromGitHub() {
    if (!GITHUB_CONFIG.enabled) return;
    try {
      const settingsRemote = await githubBackend.readJSON(GITHUB_CONFIG.settingsPath);
      const reservationsRemote = await githubBackend.readJSON(GITHUB_CONFIG.reservationsPath);
      save(STORAGE.settings, settingsRemote.json);
      save(STORAGE.reservations, reservationsRemote.json);
      // 常に取得データで上書き反映
      setSettings(settingsRemote.json);
      setReservations(reservationsRemote.json);
    } catch (e) {
      console.warn('[GitHub Bootstrap]', e.message);
    }
  }

  const defaultSettings = {
    businessHours: { start: 9, end: 18, interval: 60 },
    sameDayAllowed: true,
    cutoffHours: 3,
    manualBlocks: [],
    adminPassword: '95123',
    menus: [
      { id: 'ride', name: '乗降介助', price: 0 },
      { id: 'body', name: '身体介助', price: 1000 },
    ],
    options: [
      { id: 'stairs', name: '階段介助', price: 500, visible: true },
      { id: 'watch', name: '見守り介助', price: 500, visible: true },
      { id: 'assist2', name: '2名体制介助', price: 5000, visible: false },
    ],
    mobilityMethods: [
      { id: 'walk', name: '歩行', price: 0 },
      { id: 'wheelchair', name: '車いす', price: 0 },
      { id: 'stretcher', name: 'ストレッチャー', price: 1000 },
    ],
    stretcher: { enabled: true, fee: 0 },
    internalFee: 0,
    autoOptions: [{ id: 'assist2', when: { stretcher: true } }],
  };

  const load = (k, fallback) => {
    try {
      const raw = localStorage.getItem(k);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  };
  const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));

  const getSettings = () => {
    const current = load(STORAGE.settings, null);
    if (!current) {
      save(STORAGE.settings, defaultSettings);
      return structuredClone(defaultSettings);
    }
    return { ...defaultSettings, ...current };
  };
  const setSettings = (v) => {
    save(STORAGE.settings, v);
    syncToGitHub(GITHUB_CONFIG.settingsPath, v, 'Update settings from booking app', STORAGE.settings);
  };
  const getReservations = () => load(STORAGE.reservations, []);
  const setReservations = (v) => {
    save(STORAGE.reservations, v);
    syncToGitHub(GITHUB_CONFIG.reservationsPath, v, 'Update reservations from booking app', STORAGE.reservations);
  };

  const setAdminAuthenticated = (ok) => save(STORAGE.adminAuth, { ok, at: Date.now() });
  const isAdminAuthenticated = () => Boolean(load(STORAGE.adminAuth, {}).ok);
  const clearAdminAuthenticated = () => localStorage.removeItem(STORAGE.adminAuth);

  const pad = (n) => String(n).padStart(2, '0');
  const toDateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const formatJPDate = (d) => `${d.getMonth() + 1}/${d.getDate()}(${['日', '月', '火', '水', '木', '金', '土'][d.getDay()]})`;
  const slotKey = (dateKey, time) => `${dateKey} ${time}`;

  function weekDates() {
    const now = new Date();
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(now);
      d.setDate(now.getDate() + i);
      return d;
    });
  }

  function slotTimes(settings) {
    const { start, end, interval } = settings.businessHours;
    const out = [];
    for (let h = start; h <= end; h++) {
      out.push(`${pad(h)}:00`);
      if (interval === 30 && h !== end) out.push(`${pad(h)}:30`);
    }
    return out;
  }

  function isSameDay(dateKey) {
    return dateKey === toDateKey(new Date());
  }

  function hoursUntil(dateKey, time) {
    const [y, m, d] = dateKey.split('-').map(Number);
    const [hh, mm] = time.split(':').map(Number);
    const target = new Date(y, m - 1, d, hh, mm, 0);
    return (target.getTime() - Date.now()) / 1000 / 60 / 60;
  }

  function statusOfSlot(dateKey, time, reservations, settings) {
    const key = slotKey(dateKey, time);
    if (reservations.some((r) => r.slotKey === key && r.status !== '無効')) return 'reserved';
    if (settings.manualBlocks.includes(key)) return 'blocked';
    if (!settings.sameDayAllowed && isSameDay(dateKey)) return 'blocked';
    if (hoursUntil(dateKey, time) < settings.cutoffHours) return 'blocked';
    return 'open';
  }

  function calculateTotal({ menuId, mobilityId, selectedOptions, stretcher, stairAssist, roundTrip }, settings) {
    const menu = settings.menus.find((m) => m.id === menuId);
    const mobility = settings.mobilityMethods.find((m) => m.id === mobilityId);
    const set = new Set(selectedOptions);
    if (stretcher) settings.autoOptions.forEach((r) => r.when?.stretcher && set.add(r.id));

    const base = 730;
    const dispatch = 500;
    const vehicle = 1000;
    const stairFee = stairAssist === 'watch' ? 500 : stairAssist === 'stairs' ? 1500 : 0;
    const roundFee = roundTrip === 'wait' ? 1000 : roundTrip === 'support' ? 2000 : 0;

    let total = base + dispatch + vehicle + stairFee + roundFee + (menu?.price || 0) + (mobility?.price || 0);
    const detail = [`運賃:${base}`, `配車:${dispatch}`, `車両:${vehicle}`, `介助:${menu?.price || 0}`, `移動:${mobility?.price || 0}`];

    settings.options.forEach((o) => {
      if (set.has(o.id)) {
        total += Number(o.price || 0);
        detail.push(`${o.name}:${o.price}`);
      }
    });

    return {
      total,
      base,
      dispatch,
      vehicle,
      stairFee,
      roundFee,
      details: detail.join(' / '),
      appliedOptions: [...set],
    };
  }

  function bindHiddenAdminEntry() {
    const icon = document.getElementById('secretAdminIcon');
    const modal = document.getElementById('adminEntryModal');
    if (!icon || !modal) return;

    const form = document.getElementById('adminEntryForm');
    const input = document.getElementById('adminEntryPassword');
    const err = document.getElementById('adminEntryError');
    const cancel = document.getElementById('adminEntryCancel');

    cancel.onclick = () => modal.close();

    const taps = [];
    const windowMs = 2500;
    icon.onclick = () => {
      const now = Date.now();
      while (taps.length && now - taps[0] > windowMs) taps.shift();
      taps.push(now);
      if (taps.length >= 5) {
        taps.length = 0;
        form.reset();
        err.textContent = '';
        modal.showModal();
      }
    };

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

  async function initPublic() {
    await bootstrapFromGitHub();
    bindHiddenAdminEntry();

    const state = {
      settings: getSettings(),
      reservations: getReservations(),
      dates: weekDates(),
      times: null,
      selectedDateKey: null,
      selectedTime: null,
    };
    state.times = slotTimes(state.settings);

    const ruleSummary = document.getElementById('ruleSummary');
    const dateNav = document.getElementById('dateNav');
    const calendarGrid = document.getElementById('calendarGrid');
    const doneCard = document.getElementById('doneCard');
    const doneMessage = document.getElementById('doneMessage');

    ruleSummary.textContent = `当日予約:${state.settings.sameDayAllowed ? '可' : '不可'} / 現在+${state.settings.cutoffHours}時間締切`;

    dateNav.innerHTML = state.dates.map((d) => `<span class="date-pill">${formatJPDate(d)}</span>`).join('');

    const head = ['<div class="cell head"></div>']
      .concat(state.dates.map((d) => `<div class="cell head">${d.getMonth() + 1}/${d.getDate()}</div>`))
      .join('');
    const rows = state.times
      .map((t) => {
        const cols = state.dates
          .map((d) => `<div class="cell"><button type="button" class="slot-btn" data-date="${toDateKey(d)}" data-time="${t}">-</button></div>`)
          .join('');
        return `<div class="cell time">${t}</div>${cols}`;
      })
      .join('');
    calendarGrid.innerHTML = head + rows;

    const patchSlots = () => {
      calendarGrid.querySelectorAll('button[data-date][data-time]').forEach((btn) => {
        const dateKey = btn.dataset.date;
        const time = btn.dataset.time;
        const s = statusOfSlot(dateKey, time, state.reservations, state.settings);
        btn.className = `slot-btn ${s}` + (state.selectedDateKey === dateKey && state.selectedTime === time ? ' is-selected' : '');
        btn.disabled = s !== 'open';
        btn.innerHTML = `<span>${time}</span><small>${s === 'open' ? '◎' : '×'}</small>`;
      });
    };

    calendarGrid.onclick = (e) => {
      const btn = e.target.closest('button[data-date][data-time]');
      if (!btn || btn.disabled) return;
      state.selectedDateKey = btn.dataset.date;
      state.selectedTime = btn.dataset.time;
      patchSlots();

      openBookingModal(state, (html) => {
        doneCard.classList.remove('hidden');
        doneMessage.innerHTML = html;
        state.reservations = getReservations();
        patchSlots();
      });
    };

    patchSlots();

    // GitHub再取得後にカレンダー描画のみ再実行
    window.addEventListener('caretaxi:data-synced', () => {
      state.settings = getSettings();
      state.reservations = getReservations();
      state.times = slotTimes(state.settings);
      ruleSummary.textContent = `当日予約:${state.settings.sameDayAllowed ? '可' : '不可'} / 現在+${state.settings.cutoffHours}時間締切`;

      const head = ['<div class="cell head"></div>']
        .concat(state.dates.map((d) => `<div class="cell head">${d.getMonth() + 1}/${d.getDate()}</div>`))
        .join('');
      const rows = state.times
        .map((t) => {
          const cols = state.dates
            .map((d) => `<div class="cell"><button type="button" class="slot-btn" data-date="${toDateKey(d)}" data-time="${t}">-</button></div>`)
            .join('');
          return `<div class="cell time">${t}</div>${cols}`;
        })
        .join('');
      calendarGrid.innerHTML = head + rows;

      patchSlots();
    });
  }

  function openBookingModal(state, onBooked) {
    const modal = document.getElementById('bookingModal');
    const form = document.getElementById('bookingForm');

    const selectedSlot = document.getElementById('selectedSlot');
    const menu = document.getElementById('menu');
    const mobility = document.getElementById('mobility');
    const optionList = document.getElementById('optionList');
    const stretcher = document.getElementById('stretcher');

    const totalPrice = document.getElementById('totalPrice');
    const fareBase = document.getElementById('fareBase');
    const dispatchFee = document.getElementById('dispatchFee');
    const vehicleFee = document.getElementById('vehicleFee');
    const priceDetail = document.getElementById('priceDetail');
    const formError = document.getElementById('formError');

    const d = new Date(`${state.selectedDateKey}T00:00:00`);
    selectedSlot.textContent = `${d.getMonth() + 1}/${d.getDate()}(${['日', '月', '火', '水', '木', '金', '土'][d.getDay()]}) ${state.selectedTime} から`;

    menu.innerHTML = `<option value="">選択してください</option>` + state.settings.menus.map((m) => `<option value="${m.id}">${m.name}</option>`).join('');
    mobility.innerHTML = `<option value="">選択してください</option>` + state.settings.mobilityMethods.map((m) => `<option value="${m.id}">${m.name}</option>`).join('');
    optionList.innerHTML = state.settings.options
      .filter((o) => o.visible !== false)
      .map((o) => `<label class="checkbox-item"><input type="checkbox" name="options" value="${o.id}" />${o.name} (+¥${o.price})</label>`)
      .join('');

    const updateTotal = () => {
      const selectedOptions = [...form.querySelectorAll('input[name="options"]:checked')].map((n) => n.value);
      const calc = calculateTotal(
        {
          menuId: menu.value,
          mobilityId: mobility.value,
          selectedOptions,
          stretcher: stretcher.checked,
          stairAssist: form.elements.stairAssist.value,
          roundTrip: form.elements.roundTrip.value,
        },
        state.settings,
      );
      fareBase.textContent = calc.base.toLocaleString('ja-JP');
      dispatchFee.textContent = calc.dispatch.toLocaleString('ja-JP');
      vehicleFee.textContent = calc.vehicle.toLocaleString('ja-JP');
      totalPrice.textContent = calc.total.toLocaleString('ja-JP');
      priceDetail.textContent = `上記料金に加え、距離運賃・時間制運賃が加算されます。 (${calc.details})`;
      return calc;
    };

    form.reset();
    formError.textContent = '';
    updateTotal();

    form.oninput = updateTotal;
    document.getElementById('cancelBtn').onclick = () => modal.close();
    document.getElementById('closeModalX').onclick = () => modal.close();

    form.onsubmit = (e) => {
      e.preventDefault();
      const name = form.elements.name.value.trim();
      const phone = form.elements.phone.value.trim();
      if (!form.elements.privacyAgree.checked) return (formError.textContent = 'プライバシーポリシーへの同意が必要です');
      if (!name) return (formError.textContent = '名前を入力してください');
      if (!/^[0-9-]{10,13}$/.test(phone)) return (formError.textContent = '連絡先は電話番号形式で入力してください');
      if (!form.elements.usageType.value) return (formError.textContent = 'ご利用区分を選択してください');
      if (!menu.value || !mobility.value) return (formError.textContent = 'サービス選択の必須項目を入力してください');

      const calc = updateTotal();
      const reservation = {
        id: crypto.randomUUID(),
        dateKey: state.selectedDateKey,
        time: state.selectedTime,
        slotKey: slotKey(state.selectedDateKey, state.selectedTime),
        name,
        phone,
        pickup: form.elements.pickup.value,
        dropoff: form.elements.dropoff.value,
        memo: form.elements.memo.value,
        menuId: menu.value,
        menuName: state.settings.menus.find((m) => m.id === menu.value)?.name || '',
        mobilityId: mobility.value,
        stairAssist: form.elements.stairAssist.value,
        roundTrip: form.elements.roundTrip.value,
        rental: form.elements.rental.value,
        stretcher: stretcher.checked,
        options: calc.appliedOptions,
        total: calc.total,
        status: '確定',
        createdAt: new Date().toISOString(),
      };
      const all = getReservations();
      all.push(reservation);
      setReservations(all);

      modal.close('ok');
      onBooked(
        `<strong>予約ID:</strong> ${reservation.id}<br><strong>日時:</strong> ${reservation.dateKey} ${reservation.time} から<br><strong>お名前:</strong> ${reservation.name}<br>確認のため [090-6331-4289] よりお電話いたします。`,
      );
    };

    modal.showModal();
  }

  window.CareTaxi = {
    STORAGE,
    getSettings,
    setSettings,
    getReservations,
    setReservations,
    setAdminAuthenticated,
    isAdminAuthenticated,
    clearAdminAuthenticated,
    weekDates,
    slotTimes,
    toDateKey,
    formatJPDate,
    statusOfSlot,
    hoursUntil,
    calculateTotal,
  };

  if (document.body.dataset.page === 'public') {
    initPublic();
  }
})();
