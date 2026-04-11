if (typeof globalThis.hasBoundGridDelegation === 'undefined') globalThis.hasBoundGridDelegation = false;
let publicCalendarPage = 0;
let hasBoundPublicCalendarNav = false;
let hasEarlyCalendarPaint = false;

function getPublicDaysPerPage(){
  return Math.max(1, Number(config.days_per_page || 7));
}

function getPublicStartOffset(){
  return String(config.same_day_enabled || '0') === '1' ? 0 : 1;
}

function applyCalendarGridColumns(gridEl, daysCount){
  const isMobile = window.matchMedia('(max-width: 640px)').matches;
  const timeCol = isMobile ? 44 : 60;
  const normalizedDays = Math.max(1, Number(daysCount || 1));

  if (!isMobile){
    gridEl.style.gridTemplateColumns = `${timeCol}px repeat(${normalizedDays}, minmax(112px, 1fr))`;
  } else {
    gridEl.style.gridTemplateColumns = `${timeCol}px repeat(${normalizedDays}, minmax(62px, 1fr))`;
  }
}

function getDatesRange(){
  const today = new Date();
  today.setHours(0,0,0,0);

  const maxForwardDays = Math.max(1, Number(config.max_forward_days || 30));
  const startOffset = getPublicStartOffset();
  const daysPerPage = getPublicDaysPerPage();
  const startIndex = Math.max(0, publicCalendarPage * daysPerPage);
  const remaining = Math.max(0, maxForwardDays - startIndex);
  const visibleDays = Math.max(0, Math.min(daysPerPage, remaining));
  const dates = [];

  for (let i = 0; i < visibleDays; i++){
    const dt = new Date(today);
    dt.setDate(today.getDate() + startOffset + startIndex + i);
    dates.push(dt);
  }
  return dates;
}

function getPublicCalendarPageInfo(){
  const maxForwardDays = Math.max(1, Number(config.max_forward_days || 30));
  const daysPerPage = getPublicDaysPerPage();
  const totalPages = Math.max(1, Math.ceil(maxForwardDays / daysPerPage));
  const currentPage = Math.min(Math.max(0, publicCalendarPage), totalPages - 1);
  return { daysPerPage, totalPages, currentPage };
}

function ensurePublicCalendarNav(){
  const dateRangeEl = document.getElementById('dateRange');
  if (!dateRangeEl) return;

  let nav = document.getElementById('publicCalendarPager');
  if (!nav) return;

  if (!hasBoundPublicCalendarNav){
    const prevBtn = document.getElementById('publicPrevWeekBtn');
    const nextBtn = document.getElementById('publicNextWeekBtn');

    if (prevBtn){
      prevBtn.addEventListener('click', async ()=>{
        const info = getPublicCalendarPageInfo();
        if (info.currentPage <= 0) return;
        publicCalendarPage = info.currentPage - 1;
        try{
          await withLoading(async ()=>{
            await ensureBlockedSlotsFresh(false, true);
            renderCalendar();
          }, '前の週を表示中...');
        }catch(err){
          toast(err?.message || '表示更新に失敗しました');
        }
      });
    }

    if (nextBtn){
      nextBtn.addEventListener('click', async ()=>{
        const info = getPublicCalendarPageInfo();
        if (info.currentPage >= info.totalPages - 1) return;
        publicCalendarPage = info.currentPage + 1;
        try{
          await withLoading(async ()=>{
            await ensureBlockedSlotsFresh(false, true);
            renderCalendar();
          }, '次の週を表示中...');
        }catch(err){
          toast(err?.message || '表示更新に失敗しました');
        }
      });
    }

    hasBoundPublicCalendarNav = true;
  }

  const info = getPublicCalendarPageInfo();
  const prevBtn = document.getElementById('publicPrevWeekBtn');
  const nextBtn = document.getElementById('publicNextWeekBtn');
  if (prevBtn){
    prevBtn.disabled = info.currentPage <= 0;
    prevBtn.style.opacity = info.currentPage <= 0 ? '0.45' : '1';
    prevBtn.style.pointerEvents = info.currentPage <= 0 ? 'none' : '';
  }
  if (nextBtn){
    nextBtn.disabled = info.currentPage >= info.totalPages - 1;
    nextBtn.style.opacity = info.currentPage >= info.totalPages - 1 ? '0.45' : '1';
    nextBtn.style.pointerEvents = info.currentPage >= info.totalPages - 1 ? 'none' : '';
  }
}

function buildSlots(){
  const regularSlots = [];
  for (let h=6; h<=21; h++){
    regularSlots.push({hour:h, minute:0, display:`${String(h).padStart(2,'0')}:00`});
    if (h < 21) regularSlots.push({hour:h, minute:30, display:`${String(h).padStart(2,'0')}:30`});
  }

  const extendedSlots = [];
  extendedSlots.push({hour:21, minute:30, display:`21:30`});
  for (let h=22; h<24; h++){
    extendedSlots.push({hour:h, minute:0, display:`${String(h).padStart(2,'0')}:00`});
    extendedSlots.push({hour:h, minute:30, display:`${String(h).padStart(2,'0')}:30`});
  }
  for (let h=0; h<=5; h++){
    extendedSlots.push({hour:h, minute:0, display:`${String(h).padStart(2,'0')}:00`});
    extendedSlots.push({hour:h, minute:30, display:`${String(h).padStart(2,'0')}:30`});
  }
  return { regularSlots, extendedSlots };
}

function createPublicSlotBlockedChecker(){
  const sameDayEnabled = String(config.same_day_enabled || '0') === '1';
  const todayStr = sameDayEnabled ? ymdLocal(new Date()) : '';
  const roundedThresholdMs = sameDayEnabled
    ? ceilToNext30Min(new Date(Date.now() + Number(config.same_day_min_hours || 3) * 60 * 60 * 1000)).getTime()
    : -1;

  return function(dateObj, dateStr, hour, minute){
    const key = `${dateStr}-${hour}-${minute}`;
    if (blockedSlots.has(key) || reservedSlots.has(key)) return true;
    if (!sameDayEnabled || dateStr !== todayStr) return false;

    const slotDt = new Date(
      dateObj.getFullYear(),
      dateObj.getMonth(),
      dateObj.getDate(),
      Number(hour || 0),
      Number(minute || 0),
      0,
      0
    );
    return slotDt.getTime() < roundedThresholdMs;
  };
}

function renderCalendar() {
  const grid = document.getElementById('calendarGrid');
  const dateRangeEl = document.getElementById('dateRange');
  if (!grid || !dateRangeEl) return;

  ensurePublicCalendarNav();

  const dates = getDatesRange();
  calendarDates = dates;

  if (dates.length === 0) {
    dateRangeEl.textContent = '';
    grid.innerHTML = '';
    ensurePublicCalendarNav();
    return;
  }

  const dateMeta = dates.map(date => ({
    date,
    ymd: ymdLocal(date),
    label: formatDate(date),
    isWeekend: (date.getDay() === 0 || date.getDay() === 6)
  }));
  const isBlockedFast = createPublicSlotBlockedChecker();

  dateRangeEl.textContent = `${dateMeta[0].label} ～ ${dateMeta[dateMeta.length - 1].label}`;
  ensurePublicCalendarNav();

  const { regularSlots, extendedSlots } = buildSlots();

  let html = '';
  html += '<div class="time-label sticky-corner">時間</div>';

  dateMeta.forEach((meta, idx)=>{
    html += `<div class="date-header sticky-top ${meta.isWeekend ? 'weekend' : ''}" data-date-idx="${idx}">${meta.label}</div>`;
  });

  for (const slot of regularSlots){
    html += `<div class="time-label sticky-left">${slot.display}</div>`;
    for (let idx=0; idx<dates.length; idx++){
      const meta = dateMeta[idx];
      const blocked = isBlockedFast(meta.date, meta.ymd, slot.hour, slot.minute);
      const slotClass = blocked ? 'slot-unavailable' : 'slot-available';

      html += `<div class="${slotClass} p-3 text-center text-lg font-bold rounded-lg cursor-pointer transition"
                data-action="slot"
                data-date-idx="${idx}"
                data-hour="${slot.hour}"
                data-minute="${slot.minute}">
                ${blocked ? 'X' : '◎'}
              </div>`;
    }
  }

  const shouldShowExtended = isExtendedView;
  if (shouldShowExtended){
    html += '<div class="time-label sticky-left" style="font-weight:bold;background:linear-gradient(135deg,#cffafe 0%,#a5f3fc 100%);color:#0e7490;border:2px solid #06b6d4;">他時間</div>';

    dateMeta.forEach((meta, idx)=>{
      html += `<div class="date-header ${meta.isWeekend ? 'weekend' : ''}"
                style="background:linear-gradient(135deg,#cffafe 0%,#a5f3fc 100%);border-color:#06b6d4;color:#0e7490;"
                data-date-idx="${idx}">${meta.label}</div>`;
    });

    for (const slot of extendedSlots){
      html += `<div class="time-label sticky-left" style="background:linear-gradient(135deg,#cffafe 0%,#a5f3fc 100%);border:2px solid #06b6d4;color:#0e7490;font-weight:600;">${slot.display}</div>`;
      for (let idx=0; idx<dates.length; idx++){
        const meta = dateMeta[idx];
        const blocked = isBlockedFast(meta.date, meta.ymd, slot.hour, slot.minute);
        const slotClass = blocked ? 'slot-unavailable' : 'slot-alternate';

        html += `<div class="${slotClass} p-3 text-center text-lg font-bold rounded-lg cursor-pointer transition"
                  data-action="slot"
                  data-date-idx="${idx}"
                  data-hour="${slot.hour}"
                  data-minute="${slot.minute}">
                  ${blocked ? 'X' : '◎'}
                </div>`;
      }
    }
  }

  grid.innerHTML = html;

  applyCalendarGridColumns(grid, dates.length);
}

function bindGridDelegation(){
  if (globalThis.hasBoundGridDelegation) return;

  const grid = document.getElementById('calendarGrid');
  if (!grid) return;

  grid.addEventListener('click', async (ev)=>{
    const el = ev.target && ev.target.closest ? ev.target.closest('[data-action]') : null;
    if (!el) return;

    const action = el.dataset.action;

    if (action === 'slot'){
      const dateIdx = Number(el.dataset.dateIdx);
      const hour = Number(el.dataset.hour);
      const minute = Number(el.dataset.minute || 0);

      const date = calendarDates[dateIdx];
      if (!date) return;

      const blocked = isSlotBlockedWithMinute(date, hour, minute);
      if (blocked) return;

      await openBookingForm(date, hour, minute);
    }
  }, { passive: false });

  globalThis.hasBoundGridDelegation = true;
}

function tryEarlyCalendarPaint(){
  if (hasEarlyCalendarPaint) return;
  hasEarlyCalendarPaint = true;

  const run = ()=>{
    try{
      if (typeof schedulePublicCalendarRender === 'function'){
        schedulePublicCalendarRender();
      } else {
        renderCalendar();
      }
    }catch(_){ }
  };

  if (typeof requestAnimationFrame === 'function'){
    requestAnimationFrame(run);
  } else {
    setTimeout(run, 0);
  }
}

if (document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', tryEarlyCalendarPaint, { once: true });
} else {
  tryEarlyCalendarPaint();
}
