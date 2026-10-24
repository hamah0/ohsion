/* =========================================================
   오시온의 휴대폰 — 동작
   폴더 열고 닫기 · 키패드 · 대기화면 · 메인 메뉴
   ========================================================= */
(function () {
  "use strict";

  const D = PHONE_DATA;   // js/data.js 에 있는 설정
  const $ = (sel) => document.querySelector(sel);

  const els = {
    stage:  $("#stage"),
    phone:  $("#phone"),
    lcd:    $("#lcd"),
    led:    $("#led"),
    oled:   $("#oledText"),
    cover:  $("#cover"),
    hinge:  $("#hinge"),
    numpad: $("#numpad"),
    toggle: $("#toggleBtn"),
  };

  /* 현재 상태 */
  const state = {
    open: false,
    booted: false,     // 처음 열 때만 부팅 화면
    screen: "idle",    // idle | menu | app | dial
    menuIndex: 0,
    appId: null,
    dial: "",
    sound: D.keySound !== false,   // data.js 의 keySound 로 켜고 끔
    notice: null,      // 문자 알림 상태: null | "date" | "message"
    msgMenuIndex: 0,   // 문자함: 고른 보관함
    msgBox: 0,         //         지금 보는 보관함 (0 받은 / 1 보낸 / 2 임시)
    listIndex: 0,      //         목록에서 고른 문자
    listScroll: 0, bodyScroll: 0, menuScroll: 0,
    msgFilter: null,   //         한 사람과 주고받은 문자만 볼 때 그 이름
    msgFilterFrom: "contact",   //  그 목록에서 '뒤로' 갈 곳: "contact"(전화번호부) | "threads"(대화별 보기)
    threadIndex: 0, threadScroll: 0,
    memoIndex: 0, memoScroll: 0, memoBodyScroll: 0,   // 메모장
    callTab: 0, callIndex: 0, callScroll: 0,           // 통화기록 (탭: 0 전체 1 발신 2 수신 3 부재중)
    callFilter: null, callsFrom: "menu",               //   한 사람만 볼 때 그 이름 / '뒤로' 갈 곳
    calY: 2009, calM: 11, calD: 24,                    // 일정(달력): 보고 있는 연·월(0=1월)·일
    schIndex: 0, schScroll: 0, calDayScroll: 0,
    musicIndex: 0, musicScroll: 0,                     // 뮤직 플레이어
    showStack: [], showScroll: 0, showLoading: false, showQuery: "",   // SHOW 포털
    contactIndex: 0, contactScroll: 0, contactsFrom: "menu",   // 전화번호부
    setIndex: 0, setSel: 0, setId: "",                  // 설정
  };

  /* ---------------------------------------------------------
     설정값 저장소 (설정 메뉴에서 바꾸는 값)
     브라우저에 저장해서 다시 들어와도 유지돼요.
     저장이 막힌 브라우저에서도 오류 없이 기본값으로 동작해요.
     --------------------------------------------------------- */
  const SET_KEY = "sion-phone-settings";
  const SET_DEFAULT = {
    ringVol: 3,                        // 벨소리 크기 0~5
    keySound: D.keySound !== false,    // 버튼음
    bright: 4,                         // 화면 밝기 1~5
    ringtone: "bell1",                 // 벨소리 (선택 상태만, 소리 없음)
    wall: D.wallpaper ? "photo" : "sky",   // 배경화면
    clock24: true,                     // 24시간제
    lock: false,                       // 휴대폰 잠금 (켜짐/꺼짐 표시만)
  };
  const SET = Object.assign({}, SET_DEFAULT);
  try {
    const saved = JSON.parse(localStorage.getItem(SET_KEY) || "null");
    if (saved && typeof saved === "object")
      Object.keys(SET_DEFAULT).forEach((k) => {
        if (k in saved && typeof saved[k] === typeof SET_DEFAULT[k]) SET[k] = saved[k];
      });
  } catch (e) { /* 저장소를 못 쓰면 기본값 */ }
  if (SET.wall === "photo" && !D.wallpaper) SET.wall = "sky";
  function saveSettings() {
    try { localStorage.setItem(SET_KEY, JSON.stringify(SET)); } catch (e) { /* 저장 못 해도 괜찮아요 */ }
  }
  state.sound = SET.keySound;

  /* 배터리 잔량 — 처음 접속하면 data.js 의 batteryStart(37%)로 시작,
     이후에는 저장된 잔량을 불러와요 (새로고침해도 초기화 X) */
  const BAT_KEY = "sion-phone-battery";
  const clampBat = (v) => Math.max(0, Math.min(100, Math.round(v)));
  let battery = clampBat(typeof D.batteryStart === "number" ? D.batteryStart : 37);
  try {
    const saved = JSON.parse(localStorage.getItem(BAT_KEY) || "null");
    if (saved && typeof saved.level === "number") battery = clampBat(saved.level);
    else localStorage.setItem(BAT_KEY, JSON.stringify({ level: battery }));   // 최초 방문: 시작 잔량 저장
  } catch (e) { /* 저장소를 못 쓰면 매번 시작 잔량 */ }
  function setBattery(v) {
    battery = clampBat(v);
    try { localStorage.setItem(BAT_KEY, JSON.stringify({ level: battery })); } catch (e) {}
    if (state.open) render();
  }
  window.PhoneBattery = { get: () => battery, set: setBattery };

  // 시계 표시 (12/24시간제 설정에 맞춰)
  function clockParts(t) {
    const h = t.getHours(), m = pad(t.getMinutes());
    if (SET.clock24) return { hm: `${pad(h)}:${m}`, ampm: "" };
    return { hm: `${pad(h % 12 || 12)}:${m}`, ampm: h < 12 ? "오전" : "오후" };
  }

  /* ---------------------------------------------------------
     1. 숫자 키패드 만들기 (SKY 천지인식 자판 표기)
     --------------------------------------------------------- */
  const KEYS = [
    ["1", "ㄱㅋ", ".QZ"], ["2", "ㅣㅡ", "ABC"], ["3", "ㅏㅑ", "DEF"],
    ["4", "ㄷㅌ", "GHI"], ["5", "ㄴㄹ", "JKL"], ["6", "ㅓㅕ", "MNO"],
    ["7", "ㅁㅅ", "PRS"], ["8", "ㅂㅍ", "TUV"], ["9", "ㅗㅛ", "WXY"],
    ["*", "ㅈㅊ", "이티켓"], ["0", "ㅇㅎ", "+"], ["#", "ㅜㅠ", "·"],
  ];
  els.numpad.innerHTML = KEYS.map(([d, ko, en]) => {
    const key = d === "*" ? "star" : d === "#" ? "hash" : d;
    return `<button class="key num" data-key="${key}" aria-label="${d}">
              <span class="d">${d}</span>
              <span class="sub"><span class="ko">${ko}</span><span class="en">${en}</span></span>
            </button>`;
  }).join("");

  /* ---------------------------------------------------------
     2. 시계
     --------------------------------------------------------- */
  const startReal = Date.now();
  const storyStart = D.clock
    ? new Date(D.clock.year, D.clock.month - 1, D.clock.day, D.clock.hour, D.clock.minute)
    : null;

  function now() {
    // 이야기 속 시각이 정해져 있으면 그 시각부터 실제로 흘러가게
    return storyStart ? new Date(storyStart.getTime() + (Date.now() - startReal)) : new Date();
  }
  const pad = (n) => String(n).padStart(2, "0");
  const WEEK_KO = ["일", "월", "화", "수", "목", "금", "토"];
  const WEEK_EN = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

  /* ---------------------------------------------------------
     3. 바깥 커버: LED 도트 & 외부 디스플레이
     --------------------------------------------------------- */
  const COLS = 11, ROWS = 9;
  const dots = [];
  for (let i = 0; i < COLS * ROWS; i++) {
    const dot = document.createElement("i");
    dot.className = "dot";
    els.led.appendChild(dot);
    dots.push(dot);
  }

  let ledStep = 0;
  function showLed(pattern) {
    for (let r = 0; r < ROWS; r++) {
      const row = (pattern && pattern[r]) || "";
      for (let c = 0; c < COLS; c++) {
        const ch = row[c] || ".";
        dots[r * COLS + c].className = "dot" + (ch === "p" ? " p" : ch === "b" ? " b" : "");
      }
    }
  }
  function tickLed() {
    if (state.open) return;               // 열려 있을 땐 안 보이니까 쉬기
    if (state.notice) return;             // 문자 알림 중엔 웃는 얼굴 유지
    const pats = D.ledPatterns || [];
    if (!pats.length) return;
    // 그림 → 잠깐 꺼짐 → 다음 그림 (네온사인처럼 깜빡)
    if (ledStep % 2 === 0) showLed(pats[(ledStep / 2) % pats.length]);
    else showLed(null);
    ledStep++;
  }

  let oledStep = 0;
  function tickOled() {
    if (state.notice) return;             // 문자 알림 중엔 날짜/저장명 유지
    if (els.oled.classList.contains("ring")) return;   // 전화가 오는 중엔 '☏ 우시우시' 유지
    const t = now();
    const msgs = D.outerMessages || [];
    const slots = 1 + msgs.length;
    const slot = Math.floor(oledStep / 2) % slots;   // 한 문구당 약 6초
    if (slot === 0) {
      els.oled.classList.remove("marquee");
      els.oled.textContent = oledStep % 2 === 0
        ? (SET.clock24 ? clockParts(t).hm : `${clockParts(t).ampm === "오전" ? "AM" : "PM"} ${clockParts(t).hm}`)
        : `${pad(t.getMonth() + 1)}.${pad(t.getDate())} ${WEEK_EN[t.getDay()]}`;
    } else {
      const text = msgs[slot - 1];
      if (els.oled.textContent !== text) {
        els.oled.textContent = text;
        els.oled.classList.toggle("marquee", text.length > 8);
      }
    }
    oledStep++;
  }

  /* ---------------------------------------------------------
     3-1. 첫 장면: 유우시의 문자 도착
     ① 날짜만 보이는 조용한 상태 (LED 꺼짐)
     ② 0.4초 뒤 문자 도착 → 저장명과 웃는 얼굴 LED가 "같은 순간" 켜짐
     --------------------------------------------------------- */
  const ENVELOPE = `<svg class="oled-env" viewBox="0 0 9 7" shape-rendering="crispEdges" aria-hidden="true">
      <rect x=".5" y=".5" width="8" height="6" fill="none" stroke="currentColor"/>
      <path d="M1 1h1v1h1v1h1v1h1V3h1V2h1V1h1" fill="none" stroke="currentColor" stroke-width=".9"/></svg>`;
  const escapeHtml = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  let introTimers = [];
  function startIntro() {
    const I = D.intro;
    if (!I) return false;
    // ① 조용한 시작: 날짜만, LED 전부 꺼짐
    state.notice = "date";
    showLed(null);
    els.led.classList.remove("notify", "breathe");
    els.oled.className = "oled-text notice";
    els.oled.innerHTML = `<span class="oled-line oled-date">${escapeHtml(I.date)}</span>`;
    // ② 날짜가 실제로 화면에 그려진 순간부터 재서, 잠시 뒤 문자 도착
    requestAnimationFrame(() => {
      introTimers.push(setTimeout(arrive, I.delay != null ? I.delay : 350));
    });
    return true;
  }

  function arrive() {
    if (state.open || state.notice !== "date") return;
    const I = D.intro;
    state.notice = "message";
    // 외부 화면: 저장명 줄을 아래에 준비 → 다음 프레임에 날짜와 자리 바꿈
    els.oled.insertAdjacentHTML("beforeend",
      `<span class="oled-line oled-sender">${ENVELOPE}<span class="oled-name">${escapeHtml(I.sender)}</span></span>`);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      // 같은 프레임에 LED 점등과 저장명 등장을 동시에 시작 (어긋나지 않게)
      els.led.classList.add("notify");
      showLed(I.led);
      els.oled.classList.add("is-message");
      els.led.classList.add("notify");
      els.stage.classList.add("buzz");
    }));
    introTimers.push(setTimeout(() => {
      els.led.classList.remove("notify");
      els.led.classList.add("breathe");      // 이후엔 은은하게 숨 쉬듯
      els.stage.classList.remove("buzz");
    }, 580));
  }

  function clearNotice() {
    if (!state.notice) return;
    introTimers.forEach(clearTimeout);
    introTimers = [];
    state.notice = null;
    els.led.classList.remove("notify", "breathe");
    els.stage.classList.remove("buzz");
    els.oled.className = "oled-text";
    els.oled.textContent = "";
    oledStep = 0;
  }

  /* ---------------------------------------------------------
     4. 버튼음 (실제 소리 파일 없이 브라우저에서 만들어요)
     --------------------------------------------------------- */
  let audio = null;
  const TONES = { 1: 697, 2: 770, 3: 852, 4: 941, 5: 1209, 6: 1336, 7: 1477, 8: 1633, 9: 1100, 0: 1000 };
  function beep(key) {
    if (!state.sound) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = "square";
      osc.frequency.value = TONES[key] || 1400;
      gain.gain.setValueAtTime(0.035, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.09);
      osc.connect(gain).connect(audio.destination);
      osc.start();
      osc.stop(audio.currentTime + 0.1);
    } catch (e) { /* 소리가 안 나도 괜찮아요 */ }
  }

  /* ---------------------------------------------------------
     5. 픽셀 아이콘 (16×16)
     --------------------------------------------------------- */
  const ICONS = {
    msg:   `<rect x="1" y="3" width="14" height="10" fill="#ffd84a"/><path d="M1 3l7 6 7-6" fill="none" stroke="#b07a00" stroke-width="1.2"/><rect x="1" y="3" width="14" height="10" fill="none" stroke="#7a5200"/>`,
    call:  `<path d="M3 2h3l1 3-2 1.5a8 8 0 0 0 4.5 4.5L11 9l3 1v3c0 1-1 1.5-2 1.5C6 14 2 10 2 4c0-1 .5-2 1-2z" fill="#5be36f" stroke="#1d7a2c"/>`,
    photo: `<rect x="1" y="4" width="14" height="10" rx="1" fill="#7fb8ff" stroke="#1f4f9a"/><rect x="5" y="2" width="5" height="3" fill="#1f4f9a"/><circle cx="8" cy="9" r="3" fill="#fff" stroke="#1f4f9a"/><circle cx="8" cy="9" r="1.3" fill="#1f4f9a"/>`,
    memo:  `<rect x="3" y="1" width="10" height="14" fill="#fff6c9" stroke="#8a6d1f"/><path d="M5 5h6M5 8h6M5 11h4" stroke="#8a6d1f"/>`,
    web:   `<circle cx="8" cy="8" r="6.5" fill="#ff8fbf" stroke="#9c2f5d"/><path d="M6.5 5l4 3-4 3z" fill="#fff"/>`,
    book:  `<rect x="2" y="1" width="12" height="14" rx="1" fill="#ff9b6a" stroke="#8f3d14"/><circle cx="8" cy="6" r="2" fill="#fff"/><path d="M4.5 12c.5-2.5 6.5-2.5 7 0" fill="#fff"/>`,
    music: `<path d="M6 3l8-2v9" fill="none" stroke="#c48bff" stroke-width="1.6"/><path d="M6 3v9" stroke="#c48bff" stroke-width="1.6"/><circle cx="4.5" cy="12.5" r="2" fill="#c48bff"/><circle cx="12.5" cy="10.5" r="2" fill="#c48bff"/>`,
    cal:   `<rect x="1" y="2" width="14" height="13" fill="#fff" stroke="#3a3f6b"/><rect x="1" y="2" width="14" height="4" fill="#ff5d6c"/><path d="M4 9h2M7 9h2M10 9h2M4 12h2M7 12h2" stroke="#3a3f6b"/>`,
    gear:  `<circle cx="8" cy="8" r="4.5" fill="#b9c2d6" stroke="#4b556e"/><path d="M8 1v3M8 12v3M1 8h3M12 8h3M3 3l2 2M11 11l2 2M13 3l-2 2M5 11l-2 2" stroke="#4b556e" stroke-width="1.6"/><circle cx="8" cy="8" r="1.8" fill="#4b556e"/>`,
  };
  const icon = (name) =>
    `<svg class="ico" viewBox="0 0 16 16" shape-rendering="crispEdges">${ICONS[name] || ""}</svg>`;

  /* ---------------------------------------------------------
     6. LCD 화면 그리기
     --------------------------------------------------------- */
  // 배터리 아이콘: 안쪽 칸(10px)을 잔량 비율만큼 채워요 (37% → 4칸)
  const batteryIcon = () => {
    const w = Math.round(battery / 10);
    const col = battery <= 15 ? "#ff6b6b" : "#7dff8a";
    return `<svg class="bat-ico" width="16" height="8" viewBox="0 0 16 8" shape-rendering="crispEdges" data-level="${battery}" aria-label="배터리 ${battery}%">
          <rect x=".5" y=".5" width="13" height="7" fill="none" stroke="#fff"/><rect x="14" y="2" width="2" height="4" fill="#fff"/>
          ${w ? `<rect x="2" y="2" width="${w}" height="4" fill="${col}"/>` : ""}
        </svg>`;
  };
  const statusBar = () => {
    const t = now();
    return `<div class="status">
      <div class="left">
        <svg width="14" height="9" viewBox="0 0 14 9" shape-rendering="crispEdges">
          <path d="M0 0h5L2.5 3z" fill="#fff"/><rect x="2" y="2" width="1" height="7" fill="#fff"/>
          <rect x="5" y="6" width="2" height="3" fill="#fff"/><rect x="8" y="4" width="2" height="5" fill="#fff"/><rect x="11" y="1" width="2" height="8" fill="#fff"/>
        </svg>
        <span class="mini-show">SHOW</span>
        ${window.MusicPlayer && MusicPlayer.isPlaying() ? `<span class="mini-note">♪</span>` : ""}
      </div>
      <div class="right">
        <span>${clockParts(t).ampm}${clockParts(t).hm}</span>
${batteryIcon()}
      </div>
    </div>`;
  };
  /* 화면 아래 소프트키. ["글자", "키"] 로 주면 화면에서 직접 눌러도 그 키가 눌려요 */
  const softkeys = (...items) => `<div class="softkeys">${items.map((it) => {
    const [label, key] = Array.isArray(it) ? it : [it, ""];
    return key ? `<span data-key="${key}" role="button">${label}</span>` : `<span>${label}</span>`;
  }).join("")}</div>`;

  function renderIdle() {
    const t = now();
    const wall = SET.wall === "photo" && D.wallpaper
      ? `class="idle-body" style="background-image:url('${D.wallpaper}')"`
      : `class="idle-body wall-${SET.wall}"`;
    return `<div class="screen">
      ${statusBar()}
      <div ${wall}>
        <div class="clock">
          <div class="time">${bigTimeHtml(t)}</div>
          <div class="date">${t.getMonth() + 1}월 ${t.getDate()}일 (${WEEK_KO[t.getDay()]})</div>
        </div>
        ${newMessageNotice()}
      </div>
      ${softkeys(["문자", "msg"], ["메뉴", "ok"], ["전화번호부", "contacts"])}
    </div>`;
  }

  function renderMenu() {
    const items = D.menu.map((m, i) => `
      <div class="mi${i === state.menuIndex ? " sel" : ""}" data-index="${i}">
        <span class="no">${i + 1}</span>
        ${icon(m.icon)}
        <span>${m.label}</span>
      </div>`).join("");
    return `<div class="screen">
      ${statusBar()}
      <div class="titlebar">${D.menu[state.menuIndex].label}</div>
      <div class="menu-grid">${items}</div>
      ${softkeys("", ["선택", "ok"], ["뒤로", "clear"])}
    </div>`;
  }

  function renderApp() {
    const m = D.menu.find((x) => x.id === state.appId) || D.menu[0];
    return `<div class="screen">
      ${statusBar()}
      <div class="titlebar">${m.label}</div>
      <div class="app-body">
        ${icon(m.icon)}
        <div>${m.label}<br>준비 중인 메뉴입니다.</div>
      </div>
      ${softkeys("", "", ["뒤로", "clear"])}
    </div>`;
  }

  function renderDial() {
    return `<div class="screen">
      ${statusBar()}
      <div class="dial-body">
        <div class="dial-msg">${state.dialMsg || ""}</div>
        ${contactByDigits(state.dial) ? `<div class="dial-name">${esc(contactByDigits(state.dial).name)}</div>` : ""}
        <div class="dial-num">${fmtDial(state.dial)}</div>
      </div>
      ${softkeys(["통화", "call"], "", ["지우기", "clear"])}
    </div>`;
  }

  function render() {
    const html = {
      idle: renderIdle, menu: renderMenu, app: renderApp, dial: renderDial,
      msgMenu: renderMsgMenu, msgList: renderMsgList, msgView: renderMsgView,
      contacts: renderContacts, contactView: renderContactView, threads: renderThreads,
      memoList: renderMemoList, memoView: renderMemoView,
      photoList: renderPhotoList, photoView: renderPhotoView,
      callList: renderCallList, callView: renderCallView,
      calendar: renderCalendar, calDay: renderCalDay, schList: renderSchList,
      musicList: renderMusicList, musicView: renderMusicView,
      show: renderShow,
      setMenu: renderSetMenu, setDetail: renderSetDetail,
      incoming: renderIncoming, incall: renderIncall, callEnd: renderCallEnd,
    }[state.screen]();
    // 부팅 화면이 떠 있으면 그 위에 덮어쓰지 않도록 보존
    const boot = els.lcd.querySelector(".boot");
    els.lcd.innerHTML = html;
    if (boot) els.lcd.appendChild(boot);
    afterRenderMessages();
  }

  let toastTimer = null;
  function toast(msg) {
    let t = els.lcd.querySelector(".toast");
    if (!t) {
      t = document.createElement("div");
      t.className = "toast";
      els.lcd.appendChild(t);
    }
    t.innerHTML = msg;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.remove(), 1400);
  }

  function go(screen, extra) {
    Object.assign(state, { screen }, extra || {});
    render();
  }

  /* 메뉴 항목 열기 — 나중에 문자함 등 실제 기능을 여기서 연결해요 */
  function openApp(index) {
    const item = D.menu[index];
    if (!item) return;
    state.menuIndex = index;
    if (item.id === "messages") return go("msgMenu", { msgMenuIndex: 0, msgFilter: null });
    if (item.id === "memo") return go("memoList", { memoIndex: 0, memoScroll: 0 });
    if (item.id === "photos") return go("photoList", { photoIndex: state.photoIndex || 0 });
    if (item.id === "internet") return openShow();
    if (item.id === "settings") return go("setMenu", { setIndex: 0 });
    if (item.id === "music")
      return go("musicList", { musicIndex: window.MusicPlayer && MusicPlayer.index >= 0 ? MusicPlayer.index : 0 });
    if (item.id === "schedule") {                        // 이야기 속 '오늘'(12월 24일)에서 시작
      const t = STORY_NOW || now();
      return go("calendar", { calY: t.getFullYear(), calM: t.getMonth(), calD: t.getDate() });
    }
    if (item.id === "calls")
      return go("callList", { callTab: 0, callIndex: 0, callScroll: 0, callFilter: null,
                              callsFrom: state.screen === "idle" ? "idle" : "menu" });
    if (item.id === "contacts")
      return go("contacts", { contactIndex: 0, contactScroll: 0, contactsFrom: state.screen === "idle" ? "idle" : "menu" });
    go("app", { appId: item.id });
  }

  /* ---------------------------------------------------------
     6-1. 문자함 (받은 문자함 · 보낸 문자함 · 임시 저장함)
     기록은 js/messages.js 에 있어요.
     --------------------------------------------------------- */
  const MSG = typeof MESSAGES !== "undefined" ? MESSAGES : {};
  const BOXES = [
    { id: "inbox",  label: "받은 문자함", short: "받은 문자", who: "from", whoLabel: "보낸이" },
    { id: "sent",   label: "보낸 문자함", short: "보낸 문자", who: "to",   whoLabel: "받는이" },
    { id: "drafts", label: "임시 저장함", short: "임시 저장", who: "to",   whoLabel: "받는이" },
  ];
  const esc = (t) => String(t == null ? "" : t)
    .replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // "2009-12-24 22:24" → Date (요일은 실제 달력으로 자동)
  function parseDate(str) {
    // 초(:30 등)는 같은 분 안의 순서를 정할 때만 쓰이고 화면에는 안 보여요
    const m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(String(str || "").trim());
    if (!m) return null;
    const d = new Date(+m[1], m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0));
    return d.getMonth() === m[2] - 1 && d.getDate() === +m[3] ? d : null;   // 2월 30일 같은 날짜 거르기
  }

  // 기록 정리: 날짜 확인 + 최신순 정렬
  const STORY_FROM = new Date(2009, 0, 1);                    // 2009년 1월 1일 (5월 같은 과거 기록 포함)
  const STORY_NOW = storyStart || null;                       // 이야기 속 '지금' (data.js 의 clock)
  const boxData = {};
  BOXES.forEach((b) => {
    boxData[b.id] = (MSG[b.id] || []).map((m, i) => {
      const d = parseDate(m.date);
      if (!d) console.warn(`[문자 기록] ${b.label} ${i + 1}번째: 날짜 형식이 이상해요 →`, m.date);
      else if (d < STORY_FROM || (STORY_NOW && d > STORY_NOW))
        console.warn(`[문자 기록] ${b.label} ${i + 1}번째: 이야기 기간(2009.09.01 ~ 지금) 밖의 날짜예요 →`, m.date);
      return Object.assign({}, m, { d, order: i, read: !m.unread, box: b.id });
    }).sort((x, y) => ((x.d ? x.d.getTime() : 0) - (y.d ? y.d.getTime() : 0)) || (x.order - y.order));
    if (MSG.order === "newest") boxData[b.id].reverse();     // 기본은 오래된 순 (9월 → 12월)
  });
  const unreadCount = () => boxData.inbox.filter((m) => !m.read).length;

  function fmtShort(d) {      // 목록용: 같은 날이면 시각, 아니면 월/일
    if (!d) return "";
    if (STORY_NOW && d.toDateString() === STORY_NOW.toDateString()) return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
  }
  function fmtLong(d) {       // 상세용: 2009.12.24 (목) 22:24
    if (!d) return "";
    return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} (${WEEK_KO[d.getDay()]}) ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  // 픽셀 아이콘 (봉투 닫힘/열림, 보낸 문자, 임시 저장)
  const MSG_ICONS = {
    unread: `<rect x=".5" y="2.5" width="13" height="9" fill="#ffd84a" stroke="#7a5200"/><path d="M1 3l6 5 6-5" fill="none" stroke="#7a5200"/>`,
    read:   `<path d="M.5 6.5 7 2l6.5 4.5v5H.5z" fill="#e6e9f5" stroke="#6b7290"/><path d="M1 6.5l6 4 6-4" fill="none" stroke="#6b7290"/>`,
    sent:   `<rect x=".5" y="3.5" width="10" height="8" fill="#bfe9f2" stroke="#1f6d7c"/><path d="M1 4l4.5 4L10 4" fill="none" stroke="#1f6d7c"/><path d="M9 1h4v4M13 1l-4 4" stroke="#1f6d7c" fill="none"/>`,
    drafts: `<rect x="1.5" y=".5" width="9" height="12" fill="#fff6c9" stroke="#8a6d1f"/><path d="M3 4h6M3 6.5h6M3 9h3" stroke="#8a6d1f"/><path d="M13 5l-5 6-1.5.5.5-1.5 5-6z" fill="#ff8a65" stroke="#8f3d14"/>`,
    box:    `<rect x=".5" y="2.5" width="13" height="9" fill="#cfe7ff" stroke="#1f4f9a"/><path d="M1 3l6 5 6-5" fill="none" stroke="#1f4f9a"/>`,
    thread: `<rect x=".5" y=".5" width="9" height="7" fill="#ffd6e6" stroke="#9c2f5d"/><path d="M2 7.5v3l2.5-3" fill="#ffd6e6" stroke="#9c2f5d"/><rect x="4.5" y="4.5" width="9" height="6" fill="#cfe7ff" stroke="#1f4f9a"/>`,
  };
  const msgIcon = (name) =>
    `<svg class="m-ico" viewBox="0 0 14 13" shape-rendering="crispEdges" aria-hidden="true">${MSG_ICONS[name]}</svg>`;

  const scrollBox = (cls, inner) =>
    `<div class="lcd-scrollwrap"><div class="lcd-scroll ${cls}">${inner}</div><div class="lcd-sb"><i></i></div></div>`;

  // 대기화면의 '새 문자' 알림
  function newMessageNotice() {
    const n = unreadCount();
    if (!n) return "";
    return `<div class="idle-notice" data-key="newmsg" role="button">${msgIcon("unread")}<span>새 문자 ${n}통</span></div>`;
  }

  function renderMsgMenu() {
    const rows = BOXES.map((b, i) => {
      const list = boxData[b.id];
      const nNew = b.id === "inbox" ? unreadCount() : 0;
      return `<div class="ml-row ml-box${i === state.msgMenuIndex ? " sel" : ""}" data-i="${i}">
        <span class="ml-no">${i + 1}</span>${msgIcon(b.id === "inbox" ? "box" : b.id)}
        <span class="ml-name">${b.label}</span>
        <span class="ml-count">${nNew ? `<b>새${nNew}</b>/` : ""}${list.length}</span>
      </div>`;
    }).join("") + `<div class="ml-row ml-box${state.msgMenuIndex === BOXES.length ? " sel" : ""}" data-i="${BOXES.length}">
        <span class="ml-no">${BOXES.length + 1}</span>${msgIcon("thread")}
        <span class="ml-name">대화별 보기</span>
        <span class="ml-count">${threadList().length}명</span>
      </div>`;
    return `<div class="screen msg-screen">
      ${statusBar()}
      <div class="titlebar">문자함</div>
      ${scrollBox("ml-boxes", rows)}
      ${softkeys("", ["선택", "ok"], ["뒤로", "clear"])}
    </div>`;
  }

  function renderMsgList() {
    const list = curList();
    const title = state.msgFilter ? `${esc(state.msgFilter)} 문자` : BOXES[state.msgBox].label;
    let lastDay = "";
    const rows = list.length ? list.map((m, i) => {
      // 날짜가 바뀌는 곳에 날짜 구분줄
      const day = m.d ? m.d.toDateString() : "";
      const divider = day && day !== lastDay
        ? `<div class="ml-day">${m.d.getFullYear()}.${pad(m.d.getMonth() + 1)}.${pad(m.d.getDate())} (${WEEK_KO[m.d.getDay()]})</div>` : "";
      lastDay = day;
      const b = BOX_BY_ID[m.box];
      const who = m[b.who] || "받는 사람 없음";
      const ico = b.id === "inbox" ? (m.read ? "read" : "unread") : b.id;
      const preview = String(m.body || "").replace(/\s+/g, " ").trim() || "(내용 없음)";
      const time = m.d ? `${pad(m.d.getHours())}:${pad(m.d.getMinutes())}` : "";
      return `${divider}<div class="ml-row ml-msg${i === state.listIndex ? " sel" : ""}${m.read ? "" : " unread"}" data-i="${i}">
        <div class="ml-top">${msgIcon(ico)}<span class="ml-name">${esc(who)}</span><span class="ml-date">${time}</span></div>
        <div class="ml-prev">${esc(preview)}</div>
      </div>`;
    }).join("") : `<div class="ml-empty">저장된 문자가<br>없습니다</div>`;
    return `<div class="screen msg-screen">
      ${statusBar()}
      <div class="titlebar">${title} <span class="tb-count">${list.length ? `${state.listIndex + 1}/${list.length}` : "0"}</span></div>
      ${scrollBox("ml-list", rows)}
      ${softkeys("", list.length ? ["열기", "ok"] : "", ["뒤로", "clear"])}
    </div>`;
  }

  function renderMsgView() {
    const list = curList();
    const m = list[state.listIndex];
    if (!m) return renderMsgList();
    const b = BOX_BY_ID[m.box];
    const who = m[b.who] || "받는 사람 없음";
    const c = contactByName[who];
    const body = String(m.body || "");
    return `<div class="screen msg-screen">
      ${statusBar()}
      <div class="titlebar">${b.short} <span class="tb-count">${state.listIndex + 1}/${list.length}</span></div>
      <div class="mv-head">
        <div><span class="mv-label">${b.whoLabel}</span> ${esc(who)}${c ? ` <span class="mv-tel">${esc(c.tel)}</span>` : ""}</div>
        <div class="mv-date">${fmtLong(m.d)}</div>
      </div>
      ${scrollBox("mv-body" + (m.art ? " mv-art" : ""), body ? esc(body) : `<span class="ml-dim">(내용 없음)</span>`)}
      ${softkeys(["크게", "big"], "", ["목록", "clear"])}
    </div>`;
  }

  // 그린 뒤: 스크롤 위치 되살리기 + 선택한 줄이 보이게 + 오른쪽 스크롤바
  function afterRenderMessages() {
    const sc = els.lcd.querySelector(".lcd-scroll");
    if (!sc) return;
    const key = { msgView: "bodyScroll", msgList: "listScroll", contacts: "contactScroll", threads: "threadScroll",
                  memoList: "memoScroll", memoView: "memoBodyScroll", photoList: "photoScroll", callList: "callScroll",
                  schList: "schScroll", calDay: "calDayScroll", musicList: "musicScroll", show: "showScroll", setMenu: "setScroll", setDetail: "setDetailScroll", incall: "icScroll" }[state.screen] || "menuScroll";
    if (state.screen === "incall") state.icScroll = 99999;   // 통화 대사는 항상 맨 아래
    sc.scrollTop = state[key] || 0;
    const sel = sc.querySelector(".sel");
    if (sel) {
      if (sel.offsetTop < sc.scrollTop) sc.scrollTop = sel.offsetTop;
      else if (sel.offsetTop + sel.offsetHeight > sc.scrollTop + sc.clientHeight)
        sc.scrollTop = sel.offsetTop + sel.offsetHeight - sc.clientHeight;
    }
    const sb = sc.parentNode.querySelector(".lcd-sb");
    const thumb = sb.firstElementChild;
    const update = () => {
      state[key] = sc.scrollTop;
      const over = sc.scrollHeight > sc.clientHeight + 1;
      sb.style.visibility = over ? "visible" : "hidden";
      if (!over) return;
      const h = Math.max(14, (sc.clientHeight / sc.scrollHeight) * sb.clientHeight);
      thumb.style.height = h + "px";
      thumb.style.top = (sc.scrollTop / (sc.scrollHeight - sc.clientHeight)) * (sb.clientHeight - h) + "px";
    };
    sc.addEventListener("scroll", update);
    update();
  }

  // 지금 보고 있는 목록 (보관함 하나, 또는 전화번호부에서 고른 사람과 주고받은 문자)
  const BOX_BY_ID = {};
  BOXES.forEach((b) => { BOX_BY_ID[b.id] = b; });
  function messagesWith(name) {
    const all = boxData.inbox.filter((m) => m.from === name).concat(boxData.sent.filter((m) => m.to === name));
    // 시간순. 같은 분이면 받은 문자 → 보낸 문자 (순서를 바꾸고 싶으면 date 에 초를 적어요: "15:23:30")
    const rank = { inbox: 0, sent: 1, drafts: 2 };
    all.sort((x, y) => ((x.d ? x.d.getTime() : 0) - (y.d ? y.d.getTime() : 0))
      || (rank[x.box] - rank[y.box]) || (x.order - y.order));
    if (MSG.order === "newest") all.reverse();
    return all;
  }
  function curList() {
    return state.msgFilter ? messagesWith(state.msgFilter) : boxData[BOXES[state.msgBox].id];
  }

  // 대화별 보기: 문자를 주고받은 사람 목록 (최근에 연락한 사람이 위로)
  function threadList() {
    const map = {};
    boxData.inbox.forEach((m) => { if (m.from) (map[m.from] = map[m.from] || []).push(m); });
    boxData.sent.forEach((m) => { if (m.to) (map[m.to] = map[m.to] || []).push(m); });
    return Object.keys(map).map((name) => {
      const list = messagesWith(name);
      const times = list.map((m) => (m.d ? m.d.getTime() : 0));
      const lastT = Math.max.apply(null, times);
      const last = list[times.indexOf(lastT)];
      return { name, count: list.length, last, unread: list.some((m) => m.box === "inbox" && !m.read) };
    }).sort((a, b) => (b.last.d ? b.last.d.getTime() : 0) - (a.last.d ? a.last.d.getTime() : 0));
  }

  function renderThreads() {
    const th = threadList();
    const rows = th.length ? th.map((t, i) => {
      const d = t.last.d;
      const when = d ? `${pad(d.getMonth() + 1)}/${pad(d.getDate())}` : "";
      const preview = String(t.last.body || "").replace(/\s+/g, " ").trim() || "(내용 없음)";
      return `<div class="ml-row ml-msg${i === state.threadIndex ? " sel" : ""}${t.unread ? " unread" : ""}" data-i="${i}">
        <div class="ml-top">${msgIcon(t.unread ? "unread" : "thread")}<span class="ml-name">${esc(t.name)}</span><span class="ml-date">${t.count}통 ${when}</span></div>
        <div class="ml-prev">${esc(preview)}</div>
      </div>`;
    }).join("") : `<div class="ml-empty">주고받은 문자가<br>없습니다</div>`;
    return `<div class="screen msg-screen">
      ${statusBar()}
      <div class="titlebar">대화별 보기 <span class="tb-count">${th.length ? `${state.threadIndex + 1}/${th.length}` : "0"}</span></div>
      ${scrollBox("ml-list", rows)}
      ${softkeys("", th.length ? ["열기", "ok"] : "", ["뒤로", "clear"])}
    </div>`;
  }

  function openMessage(boxIndex, i) {
    if (boxIndex != null) state.msgBox = boxIndex;
    const list = curList();
    if (!list[i]) return;
    if (list[i].box === "inbox") list[i].read = true;   // 읽으면 열린 봉투로
    go("msgView", { listIndex: i, bodyScroll: 0 });
    noteMessageSeen(list[i]);                            // 고백·답장을 다 읽었는지 (우시우시 전화)
  }

  function openNewestUnread() {
    state.msgFilter = null;
    const i = boxData.inbox.findIndex((m) => !m.read);
    if (i < 0) return go("msgMenu", { msgMenuIndex: 0 });
    state.listScroll = 0;
    openMessage(0, i);
  }

  function handleMessageKey(key, digit) {
    if (state.screen === "msgMenu") {
      const n = BOXES.length + 1;                       // 받은 · 보낸 · 임시 + 대화별 보기
      if (key === "up")   { state.msgMenuIndex = (state.msgMenuIndex + n - 1) % n; return render(); }
      if (key === "down") { state.msgMenuIndex = (state.msgMenuIndex + 1) % n; return render(); }
      if (digit && +digit >= 1 && +digit <= n) state.msgMenuIndex = +digit - 1;
      if (key === "ok" || key === "right" || (digit && +digit >= 1 && +digit <= n)) {
        if (state.msgMenuIndex === BOXES.length) return go("threads", { threadIndex: 0, threadScroll: 0 });
        return go("msgList", { msgBox: state.msgMenuIndex, msgFilter: null, listIndex: 0, listScroll: 0 });
      }
      if (key === "clear" || key === "left") return go("menu");
      return;
    }
    if (state.screen === "threads") {
      const th = threadList(), n = th.length;
      if (n && key === "up")   { state.threadIndex = (state.threadIndex + n - 1) % n; return render(); }
      if (n && key === "down") { state.threadIndex = (state.threadIndex + 1) % n; return render(); }
      if (n && (key === "ok" || key === "right"))
        return go("msgList", { msgFilter: th[state.threadIndex].name, msgFilterFrom: "threads", listIndex: 0, listScroll: 0 });
      if (key === "clear" || key === "left") return go("msgMenu");
      return;
    }
    const list = curList();
    if (state.screen === "msgList") {
      const n = list.length;
      if (n && key === "up")   { state.listIndex = (state.listIndex + n - 1) % n; return render(); }
      if (n && key === "down") { state.listIndex = (state.listIndex + 1) % n; return render(); }
      if (n && (key === "ok" || key === "right")) return openMessage(null, state.listIndex);
      if (key === "clear" || key === "left")      // 전화번호부에서 왔으면 그 연락처로 돌아가기
        return !state.msgFilter ? go("msgMenu")
          : state.msgFilterFrom === "threads" ? go("threads", { msgFilter: null })
          : state.msgFilterFrom === "call" ? go("callView", { msgFilter: null })
          : go("contactView", { msgFilter: null });
      return;
    }
    // msgView: 위/아래 = 내용 스크롤, 왼쪽/오른쪽 = 이전/다음 문자
    if (key === "up" || key === "down") {
      const sc = els.lcd.querySelector(".lcd-scroll");
      if (sc) sc.scrollTop += key === "up" ? -32 : 32;
      return;
    }
    if (key === "left" && state.listIndex > 0) return openMessage(null, state.listIndex - 1);
    if (key === "right" && state.listIndex < list.length - 1) return openMessage(null, state.listIndex + 1);
    if (key === "big" || key === "ok") {
      const m = list[state.listIndex], b = m && BOX_BY_ID[m.box];
      if (window.Viewer && m) Viewer.openText({ title: m[b.who] || b.short, meta: fmtLong(m.d), body: m.body || "(내용 없음)", art: !!m.art });
      return;
    }
    if (key === "clear") return go("msgList");
  }

  /* ---------------------------------------------------------
     6-2. 전화번호부 — 연락처는 js/contacts.js 에 있어요
     --------------------------------------------------------- */
  const CONTACT_LIST = (typeof CONTACTS !== "undefined" ? CONTACTS : [])
    .slice()
    .sort((a, b) => String(a.name).localeCompare(String(b.name), "ko"));   // ㄱㄴㄷ 순
  const contactByName = {};
  CONTACT_LIST.forEach((c) => { contactByName[c.name] = c; });
  const digitsOf = (tel) => String(tel || "").replace(/\D/g, "");
  const contactByDigits = (d) => (d && d.length >= 10 ? CONTACT_LIST.find((c) => digitsOf(c.tel) === d) : null);
  function fmtDial(d) {
    if (/^\d{11}$/.test(d)) return d.replace(/(\d{3})(\d{4})(\d{4})/, "$1-$2-$3");
    if (/^\d{10}$/.test(d)) return d.replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3");
    return d.replace(/(\d{3})(\d{4})(\d+)/, "$1-$2-$3");
  }

  // 숫자키로 초성 찾기 (SKY 자판: 1 ㄱㅋ, 4 ㄷㅌ, 5 ㄴㄹ, 7 ㅁㅅ, 8 ㅂㅍ, * ㅈㅊ, 0 ㅇㅎ)
  const CHO = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
  const KEY_CHO = { 1: "ㄱㄲㅋ", 4: "ㄷㄸㅌ", 5: "ㄴㄹ", 7: "ㅁㅅㅆ", 8: "ㅂㅃㅍ", star: "ㅈㅉㅊ", 0: "ㅇㅎ" };
  function choOf(name) {
    const code = String(name).charCodeAt(0) - 0xac00;
    return code >= 0 && code < 11172 ? CHO[Math.floor(code / 588)] : "";
  }

  function renderContacts() {
    const n = CONTACT_LIST.length;
    const rows = n ? CONTACT_LIST.map((c, i) => `
      <div class="ml-row ml-contact${i === state.contactIndex ? " sel" : ""}" data-i="${i}">
        <div class="ct-name">${esc(c.name)}</div>
        <div class="ct-tel">${esc(c.tel)}</div>
      </div>`).join("") : `<div class="ml-empty">저장된 번호가<br>없습니다</div>`;
    return `<div class="screen msg-screen">
      ${statusBar()}
      <div class="titlebar">전화번호부 <span class="tb-count">${n ? `${state.contactIndex + 1}/${n}` : "0"}</span></div>
      ${scrollBox("ml-list", rows)}
      ${softkeys("", n ? ["보기", "ok"] : "", ["뒤로", "clear"])}
    </div>`;
  }

  function renderContactView() {
    const c = CONTACT_LIST[state.contactIndex];
    if (!c) return renderContacts();
    const nMsg = messagesWith(c.name).length;
    const nCall = callsWith(c.name).length;
    return `<div class="screen msg-screen">
      ${statusBar()}
      <div class="titlebar">전화번호부 <span class="tb-count">${state.contactIndex + 1}/${CONTACT_LIST.length}</span></div>
      <div class="cv-body">
        <div class="cv-name">${esc(c.name)}</div>
        <div class="cv-row"><span class="mv-label">휴대폰</span></div>
        <div class="cv-tel">${esc(c.tel)}</div>
        <div class="cv-links">
        ${nMsg ? `<div class="cv-info" data-key="cmsg" role="button">${msgIcon("box")}<span>주고받은 문자 ${nMsg}통</span></div>` : ""}
        ${nCall ? `<div class="cv-info" data-key="ccall" role="button">${callIcon("out")}<span>통화기록 ${nCall}건</span></div>` : ""}
        </div>
      </div>
      ${softkeys(nMsg ? ["문자", "cmsg"] : "", "", ["목록", "clear"])}
    </div>`;
  }

  function handleContactKey(key, digit) {
    const n = CONTACT_LIST.length;
    if (state.screen === "contacts") {
      if (n && key === "up")   { state.contactIndex = (state.contactIndex + n - 1) % n; return render(); }
      if (n && key === "down") { state.contactIndex = (state.contactIndex + 1) % n; return render(); }
      const set = KEY_CHO[digit || key];
      if (n && set) {                                   // 초성으로 바로 찾기
        for (let k = 1; k <= n; k++) {
          const i = (state.contactIndex + k) % n;
          if (set.includes(choOf(CONTACT_LIST[i].name))) { state.contactIndex = i; return render(); }
        }
        return;
      }
      if (n && (key === "ok" || key === "right")) return go("contactView");
      if (key === "clear" || key === "left") return go(state.contactsFrom === "idle" ? "idle" : "menu");
      return;
    }
    // contactView
    const c = CONTACT_LIST[state.contactIndex];
    if (key === "up" || key === "left")    { state.contactIndex = (state.contactIndex + n - 1) % n; return render(); }
    if (key === "down" || key === "right") { state.contactIndex = (state.contactIndex + 1) % n; return render(); }
    if (key === "ccall" && c && callsWith(c.name).length)
      return go("callList", { callFilter: c.name, callsFrom: "contact", callTab: 0, callIndex: 0, callScroll: 0 });
    if (key === "cmsg" && c && messagesWith(c.name).length)
      return go("msgList", { msgFilter: c.name, msgFilterFrom: "contact", listIndex: 0, listScroll: 0 });
    // 통화 키: 기존 전화 걸기 화면에 번호를 채워서 보여 줘요 (실제 통화 X)
    if (key === "call" && c) return go("dial", { dial: digitsOf(c.tel), dialMsg: "" });
    if (key === "clear") return go("contacts");
  }

  /* ---------------------------------------------------------
     6-3. 메모장 — 메모는 js/memos.js 에 있어요
     --------------------------------------------------------- */
  const MEMO_LIST = (typeof MEMOS !== "undefined" ? MEMOS : []).map((m, i) => {
    const d = parseDate(m.date);
    if (!d) console.warn(`[메모] ${i + 1}번째: 날짜 형식이 이상해요 →`, m.date);
    return Object.assign({}, m, { d, order: i });
  }).sort((x, y) => ((x.d ? x.d.getTime() : 0) - (y.d ? y.d.getTime() : 0)) || (x.order - y.order));

  const memoDate = (d) => (d ? `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} (${WEEK_KO[d.getDay()]})` : "");
  const memoIcon = `<svg class="m-ico" viewBox="0 0 14 13" shape-rendering="crispEdges" aria-hidden="true">
      <rect x="2.5" y=".5" width="9" height="12" fill="#fff6c9" stroke="#8a6d1f"/><path d="M4 3.5h6M4 6h6M4 8.5h4" stroke="#8a6d1f"/></svg>`;

  // 메모 본문: 글자는 그대로, "1. ..." 줄은 번호 목록으로 가지런히
  function memoBodyHtml(body) {
    return String(body || "").split("\n").map((line) => {
      // 번호 줄: 원래 띄어쓰기 그대로 두고, 줄이 넘어가면 글자 아래로 들여쓰기
      const li = /^(\d+\.)(\s?)(.*)$/.exec(line);
      if (li) return `<div class="mm-li"><span class="mm-no">${esc(li[1])}${li[2]}</span><span class="mm-txt">${esc(li[3])}</span></div>`;
      return line.trim() === "" ? `<div class="mm-gap">\n</div>` : `<div class="mm-line">${esc(line)}</div>`;
    }).join("");
  }

  function renderMemoList() {
    const n = MEMO_LIST.length;
    const rows = n ? MEMO_LIST.map((m, i) => `
      <div class="ml-row ml-msg${i === state.memoIndex ? " sel" : ""}" data-i="${i}">
        <div class="ml-top">${memoIcon}<span class="ml-name">${esc(m.title || String(m.body || "").split("\n")[0])}</span></div>
        <div class="ml-prev">${memoDate(m.d)}</div>
      </div>`).join("") : `<div class="ml-empty">저장된 메모가<br>없습니다</div>`;
    return `<div class="screen msg-screen">
      ${statusBar()}
      <div class="titlebar">메모장 <span class="tb-count">${n ? `${state.memoIndex + 1}/${n}` : "0"}</span></div>
      ${scrollBox("ml-list", rows)}
      ${softkeys("", n ? ["열기", "ok"] : "", ["뒤로", "clear"])}
    </div>`;
  }

  function renderMemoView() {
    const m = MEMO_LIST[state.memoIndex];
    if (!m) return renderMemoList();
    return `<div class="screen msg-screen memo-screen">
      ${statusBar()}
      <div class="titlebar">메모 <span class="tb-count">${state.memoIndex + 1}/${MEMO_LIST.length}</span></div>
      <div class="mv-head"><div class="mv-date">${memoDate(m.d)}</div></div>
      ${scrollBox("mm-body", memoBodyHtml(m.body))}
      ${softkeys(["크게", "big"], "", ["목록", "clear"])}
    </div>`;
  }

  function handleMemoKey(key) {
    const n = MEMO_LIST.length;
    if (state.screen === "memoList") {
      if (n && key === "up")   { state.memoIndex = (state.memoIndex + n - 1) % n; return render(); }
      if (n && key === "down") { state.memoIndex = (state.memoIndex + 1) % n; return render(); }
      if (n && (key === "ok" || key === "right")) return go("memoView", { memoBodyScroll: 0 });
      if (key === "clear" || key === "left") return go("menu");
      return;
    }
    // memoView: 위/아래 = 스크롤, 왼쪽/오른쪽 = 이전/다음 메모
    if (key === "up" || key === "down") {
      const sc = els.lcd.querySelector(".lcd-scroll");
      if (sc) sc.scrollTop += key === "up" ? -32 : 32;
      return;
    }
    if (key === "left" && state.memoIndex > 0) return go("memoView", { memoIndex: state.memoIndex - 1, memoBodyScroll: 0 });
    if (key === "right" && state.memoIndex < n - 1) return go("memoView", { memoIndex: state.memoIndex + 1, memoBodyScroll: 0 });
    if (key === "big" || key === "ok") {
      const m = MEMO_LIST[state.memoIndex];
      if (window.Viewer && m) Viewer.openText({ title: m.title || "메모", meta: memoDate(m.d), body: m.body || "" });
      return;
    }
    if (key === "clear") return go("memoList");
  }

  /* ---------------------------------------------------------
     6-3b. 사진첩 — 목록은 js/photos.js, 파일은 images/photos/
     --------------------------------------------------------- */
  const PHOTO_LIST = (typeof PHOTOS !== "undefined" ? PHOTOS : []).filter((p) => p && p.src);
  const PH_COLS = 3;

  function renderPhotoList() {
    const n = PHOTO_LIST.length;
    const cells = n ? `<div class="ph-grid">${PHOTO_LIST.map((p, i) => `
      <div class="ph-cell${i === state.photoIndex ? " sel" : ""}" data-i="${i}" role="button">
        <img src="${esc(p.src)}" alt="사진 ${i + 1}" loading="lazy" decoding="async" draggable="false">
      </div>`).join("")}</div>` : `<div class="ml-empty">저장된 사진이<br>없습니다</div>`;
    return `<div class="screen msg-screen ph-screen">
      ${statusBar()}
      <div class="titlebar">사진첩 <span class="tb-count">${n ? `${state.photoIndex + 1}/${n}` : "0"}</span></div>
      ${scrollBox("ph-list", cells)}
      ${softkeys("", n ? ["보기", "ok"] : "", ["뒤로", "clear"])}
    </div>`;
  }

  function renderPhotoView() {
    const n = PHOTO_LIST.length, i = state.photoIndex;
    const p = PHOTO_LIST[i];
    if (!p) return renderPhotoList();
    return `<div class="screen ph-view-screen">
      ${statusBar()}
      <div class="titlebar">사진첩 <span class="tb-count">${i + 1}/${n}</span></div>
      <div class="ph-stage" data-key="big" role="button" aria-label="크게 보기">
        <img src="${esc(p.src)}" alt="사진 ${i + 1}" decoding="async" draggable="false">
        ${i > 0 ? `<span class="ph-arrow ph-prev" data-key="left" role="button" aria-label="이전 사진">◀</span>` : ""}
        ${i < n - 1 ? `<span class="ph-arrow ph-next" data-key="right" role="button" aria-label="다음 사진">▶</span>` : ""}
      </div>
      ${softkeys(["크게", "big"], "", ["목록", "clear"])}
    </div>`;
  }

  function openPhotoBig() {
    if (!window.Viewer || !PHOTO_LIST.length) return;
    Viewer.openPhoto({
      list: PHOTO_LIST.map((p) => p.src), index: state.photoIndex, title: "사진첩",
      // 큰 화면에서 넘긴 사진을 휴대폰 화면에도 맞춰 두기
      onIndex: (i) => { if (state.photoIndex !== i) { state.photoIndex = i; if (state.screen === "photoView") render(); } },
    });
  }

  function handlePhotoKey(key) {
    const n = PHOTO_LIST.length;
    if (state.screen === "photoList") {
      let i = state.photoIndex;
      if (n && key === "left")  i = (i + n - 1) % n;
      if (n && key === "right") i = (i + 1) % n;
      if (n && key === "up")    i = i - PH_COLS >= 0 ? i - PH_COLS : i;
      if (n && key === "down")  i = i + PH_COLS < n ? i + PH_COLS : i;
      if (i !== state.photoIndex) { state.photoIndex = i; return render(); }
      if (n && key === "ok") return go("photoView");
      if (key === "clear") return go("menu");
      return;
    }
    // photoView: 왼쪽/오른쪽(위/아래) = 이전/다음 사진
    if ((key === "left" || key === "up") && state.photoIndex > 0) return go("photoView", { photoIndex: state.photoIndex - 1 });
    if ((key === "right" || key === "down") && state.photoIndex < n - 1) return go("photoView", { photoIndex: state.photoIndex + 1 });
    if (key === "big" || key === "ok") return openPhotoBig();
    if (key === "clear") return go("photoList");
  }

  /* ---------------------------------------------------------
     6-4. 통화기록 — 기록은 js/calls.js 에 있어요
     --------------------------------------------------------- */
  const CALL_TABS = [
    { id: "all", label: "전체" }, { id: "out", label: "발신" },
    { id: "in", label: "수신" }, { id: "missed", label: "부재중" },
  ];
  const callKind = (c) => (c.dir === "in" ? (c.answered === false ? "missed" : "in") : "out");
  const callLabel = (c) => ({ missed: c.rejected ? "수신 · 거절" : "부재중", in: "수신", out: c.answered === false ? "발신 · 거절" : "발신" })[callKind(c)];

  const CALL_LIST = (typeof CALLS !== "undefined" ? CALLS : []).map((c, i) => {
    const d = parseDate(c.date);
    if (!d) console.warn(`[통화기록] ${i + 1}번째: 날짜 형식이 이상해요 →`, c.date);
    else if (d < STORY_FROM || (STORY_NOW && d > STORY_NOW))
      console.warn(`[통화기록] ${i + 1}번째: 이야기 기간 밖의 날짜예요 →`, c.date);
    if (c.name && !contactByName[c.name]) console.warn(`[통화기록] ${i + 1}번째: 전화번호부에 없는 이름이에요 →`, c.name);
    return Object.assign({}, c, { d, order: i });
  }).sort((x, y) => ((x.d ? x.d.getTime() : 0) - (y.d ? y.d.getTime() : 0)) || (x.order - y.order));
  if (MSG.order === "newest") CALL_LIST.reverse();

  const callsWith = (name) => CALL_LIST.filter((c) => c.name === name);
  function curCalls() {
    const base = state.callFilter ? callsWith(state.callFilter) : CALL_LIST;
    const tab = CALL_TABS[state.callTab].id;
    return tab === "all" ? base : base.filter((c) => callKind(c) === tab);
  }

  const CALL_ICONS = {
    out:    `<path d="M2 11L11 2M5 2h6v6" fill="none" stroke="#1f9a3c" stroke-width="1.8"/>`,
    in:     `<path d="M11 2L2 11M2 5v6h6" fill="none" stroke="#1f4f9a" stroke-width="1.8"/>`,
    missed: `<path d="M11 2L2 11M2 5v6h6" fill="none" stroke="#d6283f" stroke-width="1.8"/><path d="M8 8l4 4M12 8l-4 4" stroke="#d6283f" stroke-width="1.2"/>`,
  };
  const callIcon = (kind) =>
    `<svg class="m-ico" viewBox="0 0 14 13" shape-rendering="crispEdges" aria-hidden="true">${CALL_ICONS[kind]}</svg>`;

  function renderCallList() {
    const list = curCalls();
    let lastDay = "";
    const rows = list.length ? list.map((c, i) => {
      const day = c.d ? c.d.toDateString() : "";
      const divider = day && day !== lastDay
        ? `<div class="ml-day">${c.d.getFullYear()}.${pad(c.d.getMonth() + 1)}.${pad(c.d.getDate())} (${WEEK_KO[c.d.getDay()]})</div>` : "";
      lastDay = day;
      const kind = callKind(c);
      const time = c.d ? `${pad(c.d.getHours())}:${pad(c.d.getMinutes())}` : "";
      return `${divider}<div class="ml-row ml-msg cl-row ${kind}${i === state.callIndex ? " sel" : ""}" data-i="${i}">
        <div class="ml-top">${callIcon(kind)}<span class="ml-name">${esc(c.name)}</span><span class="ml-date">${time}</span></div>
        <div class="ml-prev">${callLabel(c)}</div>
      </div>`;
    }).join("") : `<div class="ml-empty">통화기록이<br>없습니다</div>`;
    const tabs = CALL_TABS.map((t, i) =>
      `<span class="cl-tab${i === state.callTab ? " on" : ""}" data-tab="${i}" role="button">${t.label}</span>`).join("");
    const title = state.callFilter ? `${esc(state.callFilter)} 통화` : "통화기록";
    return `<div class="screen msg-screen">
      ${statusBar()}
      <div class="titlebar">${title} <span class="tb-count">${list.length ? `${state.callIndex + 1}/${list.length}` : "0"}</span></div>
      <div class="cl-tabs">${tabs}</div>
      ${scrollBox("ml-list", rows)}
      ${softkeys("", list.length ? ["보기", "ok"] : "", ["뒤로", "clear"])}
    </div>`;
  }

  function renderCallView() {
    const list = curCalls();
    const c = list[state.callIndex];
    if (!c) return renderCallList();
    const kind = callKind(c);
    const ct = contactByName[c.name];
    const nMsg = messagesWith(c.name).length;
    return `<div class="screen msg-screen">
      ${statusBar()}
      <div class="titlebar">통화기록 <span class="tb-count">${state.callIndex + 1}/${list.length}</span></div>
      <div class="cv-body">
        <div class="cv-name">${esc(c.name)}</div>
        ${ct ? `<div class="cv-tel cl-tel">${esc(ct.tel)}</div>` : ""}
        <div class="cl-kind ${kind}">${callIcon(kind)}<span>${callLabel(c)}</span></div>
        <div class="cl-when">${fmtLong(c.d)}</div>
        <div class="cv-links">
        ${nMsg ? `<div class="cv-info" data-key="callmsg" role="button">${msgIcon("box")}<span>주고받은 문자 ${nMsg}통</span></div>` : ""}
        </div>
      </div>
      ${softkeys(nMsg ? ["문자", "callmsg"] : "", "", ["목록", "clear"])}
    </div>`;
  }

  function handleCallKey(key) {
    const list = curCalls(), n = list.length;
    if (state.screen === "callList") {
      if (key === "left" || key === "right") {         // 탭 바꾸기: 전체 ↔ 발신 ↔ 수신 ↔ 부재중
        const t = (state.callTab + (key === "right" ? 1 : CALL_TABS.length - 1)) % CALL_TABS.length;
        return go("callList", { callTab: t, callIndex: 0, callScroll: 0 });
      }
      if (n && key === "up")   { state.callIndex = (state.callIndex + n - 1) % n; return render(); }
      if (n && key === "down") { state.callIndex = (state.callIndex + 1) % n; return render(); }
      if (n && key === "ok") return go("callView");
      if (key === "clear")
        return state.callsFrom === "contact" ? go("contactView", { callFilter: null })
             : go(state.callsFrom === "idle" ? "idle" : "menu", { callFilter: null });
      return;
    }
    // callView
    const c = list[state.callIndex];
    if ((key === "left" || key === "up") && state.callIndex > 0) return go("callView", { callIndex: state.callIndex - 1 });
    if ((key === "right" || key === "down") && state.callIndex < n - 1) return go("callView", { callIndex: state.callIndex + 1 });
    if (key === "callmsg" && c && messagesWith(c.name).length)
      return go("msgList", { msgFilter: c.name, msgFilterFrom: "call", listIndex: 0, listScroll: 0 });
    // 통화 키: 번호 입력 화면에 번호를 채워서 보여 줘요 (실제 통화 X)
    const ct = c && contactByName[c.name];
    if (key === "call" && ct) return go("dial", { dial: digitsOf(ct.tel), dialMsg: "" });
    if (key === "clear") return go("callList");
  }

  /* ---------------------------------------------------------
     6-5. 일정 (2009년 달력) — 일정은 js/schedule.js 에 있어요
     --------------------------------------------------------- */
  const HOLIDAYS = typeof HOLIDAYS_2009 !== "undefined" ? HOLIDAYS_2009 : {};
  const ymd = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
  const SCH_LIST = (typeof SCHEDULE !== "undefined" ? SCHEDULE : []).map((e, i) => {
    const d = parseDate(e.date);
    if (!d) console.warn(`[일정] ${i + 1}번째: 날짜 형식이 이상해요 →`, e.date);
    return Object.assign({}, e, { d, order: i, key: d ? ymd(d.getFullYear(), d.getMonth(), d.getDate()) : "" });
  }).filter((e) => e.d)
    .sort((x, y) => (x.d.getTime() - y.d.getTime()) || (x.order - y.order));
  const eventsOn = (key) => SCH_LIST.filter((e) => e.key === key);
  const CAL_MIN = { y: 2009, m: 0 }, CAL_MAX = { y: 2009, m: 11 };    // 2009년 1월 ~ 12월
  const daysIn = (y, m) => new Date(y, m + 1, 0).getDate();
  const evTime = (e) => (/\d{1,2}:\d{2}/.test(e.date) ? `${pad(e.d.getHours())}:${pad(e.d.getMinutes())} ` : "");

  function renderCalendar() {
    const y = state.calY, m = state.calM;
    const first = new Date(y, m, 1).getDay(), nDays = daysIn(y, m);
    const today = STORY_NOW ? ymd(STORY_NOW.getFullYear(), STORY_NOW.getMonth(), STORY_NOW.getDate()) : "";
    let cells = "";
    for (let i = 0; i < first; i++) cells += `<span class="cal-day blank"></span>`;
    for (let d = 1; d <= nDays; d++) {
      const key = ymd(y, m, d), wd = (first + d - 1) % 7;
      const cls = ["cal-day",
        wd === 0 || HOLIDAYS[key] ? "red" : wd === 6 ? "blue" : "",
        eventsOn(key).length ? "has" : "",
        key === today ? "today" : "",
        d === state.calD ? "sel" : ""].filter(Boolean).join(" ");
      cells += `<span class="${cls}" data-day="${d}">${d}</span>`;
    }
    const selKey = ymd(y, m, state.calD);
    const evs = eventsOn(selKey);
    const selDate = new Date(y, m, state.calD);
    const info = [
      HOLIDAYS[selKey] ? `<div class="cal-hol">${esc(HOLIDAYS[selKey])}</div>` : "",
      evs.length ? evs.map((e) => `<div class="cal-ev">${evTime(e)}${esc(e.title)}</div>`).join("")
                 : `<div class="cal-none">일정 없음</div>`,
    ].join("");
    const canPrev = y > CAL_MIN.y || m > CAL_MIN.m, canNext = y < CAL_MAX.y || m < CAL_MAX.m;
    return `<div class="screen msg-screen cal-screen">
      ${statusBar()}
      <div class="titlebar cal-title">
        <span class="cal-arrow${canPrev ? "" : " off"}" data-key="pmon" role="button">◀</span>
        <span>${y}년 ${m + 1}월</span>
        <span class="cal-arrow${canNext ? "" : " off"}" data-key="nmon" role="button">▶</span>
      </div>
      <div class="cal-week"><span class="red">일</span><span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span class="blue">토</span></div>
      <div class="cal-grid">${cells}</div>
      <div class="cal-info">
        <div class="cal-sel">${m + 1}/${state.calD} (${WEEK_KO[selDate.getDay()]})</div>
        <div class="cal-evs">${info}</div>
      </div>
      ${softkeys(["목록", "schList"], ["보기", "ok"], ["뒤로", "clear"])}
    </div>`;
  }

  function renderCalDay() {
    const key = ymd(state.calY, state.calM, state.calD);
    const d = new Date(state.calY, state.calM, state.calD);
    const evs = eventsOn(key);
    const rows = (HOLIDAYS[key] ? `<div class="cd-hol">${esc(HOLIDAYS[key])}</div>` : "") +
      (evs.length ? evs.map((e) => `<div class="cd-ev"><span class="cd-dot">●</span><span>${evTime(e)}${esc(e.title)}</span></div>`).join("")
                  : `<div class="ml-empty">일정이<br>없습니다</div>`);
    return `<div class="screen msg-screen">
      ${statusBar()}
      <div class="titlebar">일정</div>
      <div class="mv-head"><div class="mv-date">${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} (${WEEK_KO[d.getDay()]})</div></div>
      ${scrollBox("cd-body", rows)}
      ${softkeys("", "", ["달력", "clear"])}
    </div>`;
  }

  function renderSchList() {
    const n = SCH_LIST.length;
    let lastMonth = "";
    const rows = n ? SCH_LIST.map((e, i) => {
      const mk = `${e.d.getFullYear()}.${pad(e.d.getMonth() + 1)}`;
      const divider = mk !== lastMonth ? `<div class="ml-day">${e.d.getFullYear()}년 ${e.d.getMonth() + 1}월</div>` : "";
      lastMonth = mk;
      return `${divider}<div class="ml-row ml-msg${i === state.schIndex ? " sel" : ""}" data-i="${i}">
        <div class="ml-top"><span class="sch-date">${pad(e.d.getMonth() + 1)}/${pad(e.d.getDate())} (${WEEK_KO[e.d.getDay()]})</span></div>
        <div class="ml-prev sch-title">${evTime(e)}${esc(e.title)}</div>
      </div>`;
    }).join("") : `<div class="ml-empty">등록된 일정이<br>없습니다</div>`;
    return `<div class="screen msg-screen">
      ${statusBar()}
      <div class="titlebar">일정 목록 <span class="tb-count">${n ? `${state.schIndex + 1}/${n}` : "0"}</span></div>
      ${scrollBox("ml-list", rows)}
      ${softkeys("", n ? ["보기", "ok"] : "", ["달력", "clear"])}
    </div>`;
  }

  function moveCal(deltaDays) {
    const d = new Date(state.calY, state.calM, state.calD + deltaDays);
    if (d.getFullYear() < CAL_MIN.y || (d.getFullYear() === CAL_MIN.y && d.getMonth() < CAL_MIN.m)) return;
    if (d.getFullYear() > CAL_MAX.y || (d.getFullYear() === CAL_MAX.y && d.getMonth() > CAL_MAX.m)) return;
    go("calendar", { calY: d.getFullYear(), calM: d.getMonth(), calD: d.getDate() });
  }
  function moveMonth(delta) {
    let y = state.calY, m = state.calM + delta;
    if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; }
    if (y < CAL_MIN.y || (y === CAL_MIN.y && m < CAL_MIN.m) || y > CAL_MAX.y || (y === CAL_MAX.y && m > CAL_MAX.m)) return;
    go("calendar", { calY: y, calM: m, calD: Math.min(state.calD, daysIn(y, m)) });
  }

  function handleCalKey(key) {
    if (state.screen === "calendar") {
      if (key === "left")  return moveCal(-1);
      if (key === "right") return moveCal(1);
      if (key === "up")    return moveCal(-7);
      if (key === "down")  return moveCal(7);
      if (key === "pmon" || key === "star") return moveMonth(-1);   // * 이전 달
      if (key === "nmon" || key === "hash") return moveMonth(1);    // # 다음 달
      if (key === "ok") return go("calDay", { calDayScroll: 0 });
      if (key === "schList") {
        const sel = ymd(state.calY, state.calM, state.calD);
        const i = SCH_LIST.findIndex((e) => e.key >= sel);          // 고른 날짜와 가까운 일정부터
        return go("schList", { schIndex: i < 0 ? Math.max(0, SCH_LIST.length - 1) : i, schScroll: 0 });
      }
      if (key === "clear") return go("menu");
      return;
    }
    if (state.screen === "calDay") {
      if (key === "left")  { const d = new Date(state.calY, state.calM, state.calD - 1);
        if (d.getFullYear() === 2009) return go("calDay", { calY: 2009, calM: d.getMonth(), calD: d.getDate() }); return; }
      if (key === "right") { const d = new Date(state.calY, state.calM, state.calD + 1);
        if (d.getFullYear() === 2009) return go("calDay", { calY: 2009, calM: d.getMonth(), calD: d.getDate() }); return; }
      if (key === "clear") return go("calendar");
      return;
    }
    // schList
    const n = SCH_LIST.length;
    if (n && key === "up")   { state.schIndex = (state.schIndex + n - 1) % n; return render(); }
    if (n && key === "down") { state.schIndex = (state.schIndex + 1) % n; return render(); }
    if (n && (key === "ok" || key === "right")) {
      const e = SCH_LIST[state.schIndex];
      return go("calendar", { calY: e.d.getFullYear(), calM: e.d.getMonth(), calD: e.d.getDate() });
    }
    if (key === "clear" || key === "left") return go("calendar");
  }

  /* ---------------------------------------------------------
     6-6. 뮤직 플레이어 — 곡은 js/music.js, 재생은 js/music-player.js
     --------------------------------------------------------- */
  const MP = window.MusicPlayer || null;
  const SONG_LIST = MP ? MP.songs : [];
  const mmss = (sec) => `${pad(Math.floor(sec / 60))}:${pad(Math.floor(sec % 60))}`;
  const MP_STATUS = { idle: "■ 정지", playing: "▶ 재생 중", paused: "❚❚ 일시정지", ended: "■ 재생 완료" };

  function renderMusicList() {
    const n = SONG_LIST.length;
    const cur = MP ? MP.index : -1;
    const rows = n ? SONG_LIST.map((s, i) => {
      const now = i === cur && MP && MP.isPlaying();
      return `<div class="ml-row ml-msg mu-row${i === state.musicIndex ? " sel" : ""}${i === cur ? " cur" : ""}" data-i="${i}">
        <div class="ml-top"><span class="mu-no">${pad(s.no)}</span><span class="ml-name">${esc(s.title)}</span>
          <span class="mu-st">${now ? `<i class="mu-eq"><b></b><b></b><b></b></i>` : i === cur ? "▶" : ""}</span></div>
        <div class="ml-prev mu-artist"><span>${esc(s.artist)}</span><span class="mu-len">${mmss(s.dur)}</span></div>
      </div>`;
    }).join("") : `<div class="ml-empty">저장된 곡이<br>없습니다</div>`;
    return `<div class="screen msg-screen">
      ${statusBar()}
      <div class="titlebar">뮤직 플레이어 <span class="tb-count">${n ? `${state.musicIndex + 1}/${n}` : "0"}</span></div>
      ${scrollBox("ml-list", rows)}
      ${softkeys("", n ? ["선택", "ok"] : "", ["뒤로", "clear"])}
    </div>`;
  }

  function renderMusicView() {
    const i = MP ? MP.index : -1;
    const s = SONG_LIST[i];
    if (!s) return renderMusicList();
    const status = MP.status;
    const playing = MP.isPlaying();
    const p = MP.progress();
    const pct = p.d ? Math.min(100, (p.t / p.d) * 100) : 0;
    const msg = MP_STATUS[status] || "";
    const bars = Array.from({ length: 9 }, (_, k) => `<b style="animation-delay:-${((k * 0.17) % 0.9).toFixed(2)}s"></b>`).join("");
    return `<div class="screen msg-screen mp-screen">
      ${statusBar()}
      <div class="titlebar">뮤직 플레이어 <span class="tb-count">${pad(s.no)}/${pad(SONG_LIST.length)}</span></div>
      <div class="mp-body">
        <div class="mp-art ${status}">${bars}</div>
        <div class="mp-title">${esc(s.title)}</div>
        <div class="mp-artist">${esc(s.artist)}</div>
        <div class="mp-status ${status}">${msg}</div>
        <div class="mp-prog">
          <div class="mp-bar" role="slider" aria-label="재생 위치" aria-valuemin="0" aria-valuemax="${Math.round(p.d)}" aria-valuenow="${Math.round(p.t)}"><i style="width:${pct}%"></i><b style="left:${pct}%"></b></div>
          <div class="mp-time">${mmss(p.t)} / ${mmss(p.d)}</div>
        </div>
        <div class="mp-ctrls">
          <span class="mp-btn${i > 0 ? "" : " off"}" data-key="left" role="button" aria-label="이전 곡">◀◀</span>
          <span class="mp-btn big" data-key="ok" role="button" aria-label="${playing ? "일시정지" : "재생"}">${playing ? "❚❚" : "▶"}</span>
          <span class="mp-btn${i < SONG_LIST.length - 1 ? "" : " off"}" data-key="right" role="button" aria-label="다음 곡">▶▶</span>
        </div>
      </div>
      ${softkeys(["정지", "mstop"], [playing ? "일시정지" : "재생", "ok"], ["목록", "clear"])}
    </div>`;
  }

  function handleMusicKey(key) {
    const n = SONG_LIST.length;
    if (state.screen === "musicList") {
      if (n && key === "up")   { state.musicIndex = (state.musicIndex + n - 1) % n; return render(); }
      if (n && key === "down") { state.musicIndex = (state.musicIndex + 1) % n; return render(); }
      if (n && (key === "ok" || key === "right")) {
        if (MP.index !== state.musicIndex) MP.select(state.musicIndex);   // 곡 바꾸기 (재생은 ▶ 를 눌러야)
        return go("musicView");
      }
      if (key === "clear" || key === "left") return go("menu");
      return;
    }
    // musicView
    const i = MP.index;
    if (key === "ok") return MP.toggle();                  // 재생 ↔ 일시정지
    if (key === "mstop") return MP.stop();
    // 이전·다음 곡: 재생 중이었으면 새 곡도 이어서 재생, 멈춰 있었으면 곡만 바뀜
    if (key === "left" && i > 0)      { state.musicIndex = i - 1; MP.select(i - 1, true); return render(); }
    if (key === "right" && i < n - 1) { state.musicIndex = i + 1; MP.select(i + 1, true); return render(); }
    if (key === "clear") { state.musicIndex = i; return go("musicList"); }
  }

  if (MP) {
    // 재생 상태가 바뀌면 휴대폰 화면도 갱신 (상태바 ♪ 포함)
    MP.onChange(() => {
      if (!state.open) return;
      if (state.screen === "musicView" || state.screen === "musicList") render();
      else {
        const left = els.lcd.querySelector(".status .left");
        const note = left && left.querySelector(".mini-note");
        if (left && MP.isPlaying() && !note) left.insertAdjacentHTML("beforeend", `<span class="mini-note">♪</span>`);
        if (note && !MP.isPlaying()) note.remove();
      }
    });
    // 재생바·시간만 부드럽게 갱신 (화면 전체를 다시 그리지 않음)
    const paintBar = (t, d) => {
      const pct = (d ? Math.min(100, (t / d) * 100) : 0) + "%";
      const fill = els.lcd.querySelector(".mp-bar i"), knob = els.lcd.querySelector(".mp-bar b");
      const tm = els.lcd.querySelector(".mp-time");
      if (fill) fill.style.width = pct;
      if (knob) knob.style.left = pct;
      if (tm) tm.textContent = `${mmss(t)} / ${mmss(d)}`;
    };
    setInterval(() => {
      if (!state.open || state.screen !== "musicView" || !MP.isPlaying() || seeking) return;
      const p = MP.progress();
      paintBar(p.t, p.d);
    }, 250);

    // 재생바를 누르거나 끌어서 원하는 위치로 이동
    let seeking = null;
    const fracAt = (bar, x) => {
      const r = bar.getBoundingClientRect();
      return Math.max(0, Math.min(1, (x - r.left) / r.width));
    };
    els.lcd.addEventListener("pointerdown", (e) => {
      const bar = e.target.closest(".mp-bar");
      if (!bar || state.screen !== "musicView") return;
      e.preventDefault();
      seeking = { bar, d: MP.progress().d, f: fracAt(bar, e.clientX) };
      try { bar.setPointerCapture(e.pointerId); } catch (err) {}
      paintBar(seeking.f * seeking.d, seeking.d);
    });
    els.lcd.addEventListener("pointermove", (e) => {
      if (!seeking) return;
      seeking.f = fracAt(seeking.bar, e.clientX);
      paintBar(seeking.f * seeking.d, seeking.d);       // 끄는 동안엔 화면만, 놓으면 이동
    });
    const endSeek = () => {
      if (!seeking) return;
      const s = seeking; seeking = null;
      MP.seek(s.f * s.d);
    };
    els.lcd.addEventListener("pointerup", endSeek);
    els.lcd.addEventListener("pointercancel", endSeek);
  }

  /* ---------------------------------------------------------
     6-7. SHOW 포털 (2009년풍 · 외부 연결 없음) — 내용은 js/show.js
     --------------------------------------------------------- */
  const SP = typeof SHOW_PORTAL !== "undefined" ? SHOW_PORTAL : { home: [] };
  const SART = typeof SHOW_ART !== "undefined" ? SHOW_ART : {};
  const SHOW_HOME = { title: "", home: true, items: SP.home };

  // 목록 항목 (추천곡은 휴대폰 뮤직 플레이어의 곡 목록을 그대로 사용)
  function showItems(node) {
    if (node.items === "MUSIC_LIST")
      return SONG_LIST.map((s, i) => ({ label: s.title, sub: s.artist, action: "music:" + i }));
    if (node.type === "search")
      return node.results ? node.results
        : (node.popular || []).map((kw) => ({ label: kw, sub: "인기 검색어", action: "search:" + kw }));
    return Array.isArray(node.items) ? node.items : [];
  }
  const showTop = () => state.showStack[state.showStack.length - 1];
  const showOpenable = (it) => !!(it && (it.page || it.action));      // 제목만 있는 줄은 열리지 않아요
  function showSelIdx(items) { return items.map((it, i) => (showOpenable(it) ? i : -1)).filter((i) => i >= 0); }

  // 포털 안 검색 (외부 검색 아님): 제목·내용에서 찾아요
  function searchPortal(q) {
    const key = String(q || "").replace(/\s+/g, "").toLowerCase();
    if (!key) return [];
    const out = [];
    (function walk(items, path, parent) {
      (items || []).forEach((it) => {
        const pg = it.page;
        if (!pg) {                                   // 제목만 있는 줄 → 그 목록 화면으로
          const hay = [it.label, it.sub].filter(Boolean).join(" ").replace(/\s+/g, "").toLowerCase();
          if (parent && hay.includes(key)) out.push({ label: it.label, sub: path.join(" > ") || "SHOW", page: parent });
          return;
        }
        if (pg.type === "search") return;
        const hay = [it.label, it.sub, pg.title, pg.note, pg.body].filter(Boolean).join(" ").replace(/\s+/g, "").toLowerCase();
        if (hay.includes(key)) out.push({ label: pg.title || it.label, sub: path.join(" > ") || "SHOW", page: pg });
        if (Array.isArray(pg.items)) walk(pg.items, path.concat(pg.title || it.label), pg);
      });
    })(SP.home, [], null);
    return out.slice(0, 20);
  }

  function pixelArt(name) {
    const rows = SART[name];
    if (!rows) return "";
    const PAL = { g: "#2f9e44", y: "#ffd43b", r: "#e03131", w: "#ffffff", b: "#4dabf7", n: "#1b2a5e", k: "#8d5524", o: "#ff922b" };
    const w = Math.max(...rows.map((r) => r.length)), h = rows.length;
    let rects = "";
    rows.forEach((row, y) => [...row].forEach((ch, x) => {
      if (PAL[ch]) rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${PAL[ch]}"/>`;
    }));
    return `<svg class="sh-art" viewBox="0 0 ${w} ${h}" shape-rendering="crispEdges" aria-hidden="true">${rects}</svg>`;
  }

  function renderShow() {
    const t = STORY_NOW || now();
    if (state.showLoading) {
      return `<div class="screen show-screen">
        ${statusBar()}
        <div class="sh-loading"><div class="sh-logo big">SHOW</div><div>접속중...</div><div class="sh-pbar"><i></i></div></div>
        ${softkeys("", "", ["취소", "clear"])}
      </div>`;
    }
    const top = showTop(), node = top.node;
    const items = showItems(node);
    const list = items.map((it, i) => showOpenable(it) ? `
      <div class="ml-row sh-item${i === top.sel ? " sel" : ""}" data-i="${i}">
        <span class="sh-no">${i < 9 ? i + 1 : "·"}.</span>${node.home && it.icon ? `<span class="sh-ico">${it.icon}</span>` : ""}<span class="sh-label">${esc(it.label)}</span>${it.sub ? ` <span class="sh-sub">${esc(it.sub)}</span>` : ""}
      </div>` : `
      <div class="sh-item sh-plain"><span class="sh-no">·</span><span class="sh-label">${esc(it.label)}</span>${it.sub ? ` <span class="sh-sub">${esc(it.sub)}</span>` : ""}</div>`).join("");
    let body = "";
    if (node.home) {
      body = `<div class="sh-date">${t.getMonth() + 1}/${t.getDate()}(${WEEK_KO[t.getDay()]}) ${esc(SP.greeting || "")}</div>
        <div class="sh-search"><input class="sh-input" type="text" maxlength="20" placeholder="검색어 입력" value="${esc(state.showQuery || "")}" aria-label="SHOW 검색어"><span class="sh-go" data-key="srch" role="button">검색</span></div>
        <div class="sh-list">${list}</div>`;
    } else if (node.type === "search") {
      body = `<div class="sh-title">${esc(node.title)}</div>
        <div class="sh-search"><input class="sh-input" type="text" maxlength="20" placeholder="검색어 입력" value="${esc(state.showQuery || "")}" aria-label="SHOW 검색어"><span class="sh-go" data-key="srch" role="button">검색</span></div>
        <div class="sh-note">${node.results ? `'${esc(state.showQuery)}' SHOW 안 검색 결과 ${node.results.length}건` : "인기 검색어"}</div>
        <div class="sh-list">${list || `<div class="sh-empty">검색 결과가 없습니다.</div>`}</div>`;
    } else {
      body = `<div class="sh-title">${esc(node.title || "")}</div>
        ${node.note ? `<div class="sh-note">${esc(node.note)}</div>` : ""}
        ${node.art ? `<div class="sh-artbox">${pixelArt(node.art)}</div>` : ""}
        ${node.body ? `<div class="sh-text">${esc(node.body)}</div>` : ""}
        ${list ? `<div class="sh-list">${list}</div>` : ""}`;
    }
    const crumb = state.showStack.slice(1).map((e) => e.node.title).filter(Boolean).slice(-1)[0] || "";
    return `<div class="screen show-screen">
      ${statusBar()}
      <div class="sh-head"><span class="sh-logo">SHOW</span><span class="sh-crumb">${esc(crumb)}</span></div>
      ${scrollBox("sh-body", body + `<div class="sh-foot"><span data-key="clear" role="button">*이전</span><span data-key="shome" role="button">#처음</span></div><div class="sh-copy">ⓒSHOW</div>`)}
      ${softkeys(["처음", "shome"], showSelIdx(items).length ? ["선택", "ok"] : "", ["이전", "clear"])}
    </div>`;
  }

  function openShow() {
    state.showStack = [{ node: SHOW_HOME, sel: 0, scroll: 0 }];
    state.showScroll = 0;
    state.showQuery = "";
    go("show", { showLoading: true });
    setTimeout(() => { if (state.screen === "show" && state.showLoading) go("show", { showLoading: false }); }, 650);
  }
  function showPush(node) {
    showTop().scroll = state.showScroll;
    state.showStack.push({ node, sel: Math.max(0, showSelIdx(showItems(node))[0] || 0), scroll: 0 });
    go("show", { showScroll: 0 });
  }
  function showBack() {
    if (state.showStack.length <= 1) return go("menu");
    state.showStack.pop();
    go("show", { showScroll: showTop().scroll || 0 });
  }
  function showSearch(q) {
    q = String(q || "").trim();
    state.showQuery = q;
    const results = q ? searchPortal(q) : null;
    const node = { type: "search", title: "검색", results, popular: SP.home[0] && SP.home[0].page.popular };
    if (showTop().node.type === "search") { showTop().node = node; showTop().sel = 0; go("show", { showScroll: 0 }); }
    else showPush(node);
  }
  function showOpenItem(it) {
    if (!it) return;
    if (it.page) return showPush(it.page);
    const a = String(it.action || "");
    if (a === "music") return go("musicList", { musicIndex: MP && MP.index >= 0 ? MP.index : 0 });
    if (a.startsWith("music:") && MP) {
      const i = Number(a.slice(6));
      if (MP.index !== i) MP.select(i);                 // 곡 준비만 (재생 X)
      return go("musicView", { musicIndex: i });
    }
    if (a.startsWith("search:")) return showSearch(a.slice(7));
  }

  function handleShowKey(key, digit) {
    if (state.showLoading) { if (key === "clear") { state.showLoading = false; return go("menu"); } return; }
    const top = showTop(), items = showItems(top.node), idx = showSelIdx(items), n = idx.length;
    if (key === "srch") { const inp = els.lcd.querySelector(".sh-input"); return showSearch(inp ? inp.value : ""); }
    if (key === "shome" || key === "hash") {
      state.showStack = [state.showStack[0]];
      return go("show", { showScroll: state.showStack[0].scroll || 0 });
    }
    if (key === "clear" || key === "star" || key === "left") return showBack();
    const pos = idx.indexOf(top.sel);
    if (n && key === "up")   { top.sel = idx[(pos + n - 1) % n]; return render(); }
    if (n && key === "down") { top.sel = idx[(pos + 1) % n]; return render(); }
    if (!n && (key === "up" || key === "down")) {      // 열 수 있는 줄이 없으면 화면만 스크롤
      const sc = els.lcd.querySelector(".lcd-scroll");
      if (sc) sc.scrollTop += key === "up" ? -32 : 32;
      return;
    }
    if (n && (key === "ok" || key === "right")) return showOpenItem(items[top.sel]);
    if (digit && showOpenable(items[+digit - 1])) { top.sel = +digit - 1; return showOpenItem(items[top.sel]); }
  }

  // 검색창: Enter 로 검색 (휴대폰 키 조작과 겹치지 않게 여기서 처리)
  els.lcd.addEventListener("keydown", (e) => {
    if (!e.target.classList || !e.target.classList.contains("sh-input")) return;
    if (e.key === "Enter") { e.preventDefault(); showSearch(e.target.value); }
    if (e.key === "Escape") { e.preventDefault(); e.target.blur(); }
  });

  /* ---------------------------------------------------------
     6-8. 설정 — 값은 위쪽 '설정값 저장소'(SET)에 보관
     --------------------------------------------------------- */
  function bigTimeHtml(t) {
    const c = clockParts(t);
    const [hh, mm] = c.hm.split(":");
    return `${c.ampm ? `<span class="ampm">${c.ampm}</span>` : ""}${hh}<span class="colon">:</span>${mm}`;
  }
  const BRIGHT = { 1: 0.55, 2: 0.7, 3: 0.85, 4: 1, 5: 1.12 };
  function applyBrightness() { els.lcd.style.filter = SET.bright === 4 ? "" : `brightness(${BRIGHT[SET.bright] || 1})`; }
  applyBrightness();

  const RINGTONES = [
    { id: "bell1", name: "기본 벨 1" }, { id: "bell2", name: "기본 벨 2" }, { id: "old", name: "따르릉 (옛날전화)" },
    { id: "melody", name: "멜로디 벨" }, { id: "xmas", name: "징글벨" }, { id: "silent", name: "무음" },
  ];
  const WALLS = [
    ...(D.wallpaper ? [{ id: "photo", name: "기본 (사진)" }] : []),
    { id: "sky", name: D.wallpaper ? "하늘" : "기본 (하늘)" }, { id: "pink", name: "분홍 노을" }, { id: "check", name: "체크 무늬" },
    { id: "night", name: "별 밤" }, { id: "teal", name: "청록 단색" }, { id: "dots", name: "도트 하트" },
  ];
  const SET_MENU = [
    { id: "sound",   label: "소리 설정",     ico: "♪" },
    { id: "display", label: "화면 설정",     ico: "☼" },
    { id: "ring",    label: "벨소리 설정",   ico: "☏" },
    { id: "wall",    label: "배경화면 설정", ico: "▦" },
    { id: "clock",   label: "시계 설정",     ico: "◷" },
    { id: "lock",    label: "휴대폰 잠금",   ico: "◈" },
    { id: "lang",    label: "언어 설정",     ico: "가" },
    { id: "info",    label: "휴대폰 정보",   ico: "ⓘ" },
  ];
  const nameOf = (list, id) => (list.find((x) => x.id === id) || list[0]).name;
  function setSummary(id) {
    return {
      sound: `크기 ${SET.ringVol}`, display: `${SET.bright}단계`, ring: nameOf(RINGTONES, SET.ringtone),
      wall: nameOf(WALLS, SET.wall), clock: SET.clock24 ? "24시간" : "12시간", lock: SET.lock ? "켜짐" : "꺼짐",
      lang: "한국어", info: "",
    }[id];
  }

  // 각 설정 화면의 줄 목록
  function setRows(id) {
    const radio = (list, key, after) => list.map((x) => ({
      kind: "radio", label: x.name, on: SET[key] === x.id, swatch: key === "wall" ? x.id : "",
      ok: () => { SET[key] = x.id; saveSettings(); if (after) after(); },
    }));
    const t = now();
    switch (id) {
      case "sound": return [
        { kind: "range", label: "벨소리 크기", value: SET.ringVol, max: 5,
          step: (d) => { SET.ringVol = Math.max(0, Math.min(5, SET.ringVol + d)); saveSettings(); } },
        { kind: "toggle", label: "버튼음", on: SET.keySound,
          ok: () => { SET.keySound = !SET.keySound; state.sound = SET.keySound; saveSettings(); } },
      ];
      case "display": return [1, 2, 3, 4, 5].map((n) => ({
        kind: "radio", label: `${n}단계${n === 4 ? " (기본)" : ""}`, on: SET.bright === n,
        ok: () => { SET.bright = n; saveSettings(); applyBrightness(); },
      }));
      case "ring": return [
        { kind: "info", label: `현재 벨소리: ${nameOf(RINGTONES, SET.ringtone)}` },
        ...radio(RINGTONES, "ringtone"),
      ];
      case "wall": return radio(WALLS, "wall");
      case "clock": {
        const h = t.getHours(), m = pad(t.getMinutes());
        return [
          { kind: "radio", label: `24시간제 (${pad(h)}:${m})`, on: SET.clock24, ok: () => { SET.clock24 = true; saveSettings(); tickOled(); } },
          { kind: "radio", label: `12시간제 (${h < 12 ? "오전" : "오후"} ${pad(h % 12 || 12)}:${m})`, on: !SET.clock24, ok: () => { SET.clock24 = false; saveSettings(); tickOled(); } },
        ];
      }
      case "lock": return [
        { kind: "toggle", label: "잠금 사용", on: SET.lock, ok: () => { SET.lock = !SET.lock; saveSettings(); } },
      ];
      case "lang": return [
        { kind: "radio", label: "한국어", on: true, ok: () => {} },
        { kind: "info", label: "이 휴대폰은 한국어만 지원해요." },
      ];
      case "info": return [
        { kind: "kv", label: "모델명", value: "IM-U300K" },
        { kind: "kv", label: "통신사", value: "SHOW" },
        { kind: "kv", label: "S/W 버전", value: "SION_091224" },
        { kind: "kv", label: "벨소리", value: nameOf(RINGTONES, SET.ringtone) },
      ];
    }
    return [];
  }
  const selectable = (r) => r.kind !== "info" && r.kind !== "kv";

  function renderSetMenu() {
    const rows = SET_MENU.map((m, i) => `
      <div class="ml-row set-mrow${i === state.setIndex ? " sel" : ""}" data-i="${i}">
        <span class="ml-no">${i + 1}</span><span class="set-ico">${m.ico}</span>
        <span class="ml-name">${m.label}</span><span class="set-val">${esc(setSummary(m.id))}</span>
      </div>`).join("");
    return `<div class="screen msg-screen">
      ${statusBar()}
      <div class="titlebar">설정 <span class="tb-count">${state.setIndex + 1}/${SET_MENU.length}</span></div>
      ${scrollBox("ml-list", rows)}
      ${softkeys("", ["선택", "ok"], ["뒤로", "clear"])}
    </div>`;
  }

  function renderSetDetail() {
    const m = SET_MENU.find((x) => x.id === state.setId) || SET_MENU[0];
    const rows = setRows(m.id).map((r, i) => {
      const sel = i === state.setSel && selectable(r) ? " sel" : "";
      if (r.kind === "info") return `<div class="set-info">${esc(r.label)}</div>`;
      if (r.kind === "kv") return `<div class="set-kv"><span>${esc(r.label)}</span><b>${esc(r.value)}</b></div>`;
      let right = "";
      if (r.kind === "radio") right = `<span class="set-radio">${r.on ? "◉" : "○"}</span>`;
      if (r.kind === "toggle") right = `<span class="set-tog${r.on ? " on" : ""}">${r.on ? "켜짐" : "꺼짐"}</span>`;
      if (r.kind === "action") right = `<span class="set-go">▶</span>`;
      if (r.kind === "range") right = `<span class="set-range"><span class="set-step" data-key="left" role="button">◀</span>${
        Array.from({ length: r.max }, (_, k) => `<i class="${k < r.value ? "on" : ""}"></i>`).join("")}<span class="set-step" data-key="right" role="button">▶</span></span>`;
      const sw = r.swatch ? `<span class="set-sw wall-${r.swatch}${r.swatch === "photo" ? " photo" : ""}"${r.swatch === "photo" ? ` style="background-image:url('${D.wallpaper}')"` : ""}></span>` : "";
      return `<div class="ml-row set-row ${r.kind}${sel}${r.on ? " is-on" : ""}" data-i="${i}">${sw}<span class="ml-name">${esc(r.label)}</span>${right}</div>`;
    }).join("");
    const rowsList = setRows(m.id);
    const cur = rowsList[state.setSel];
    const okLabel = !cur || !selectable(cur) ? "" : cur.kind === "range" ? "" : cur.kind === "toggle" ? ["변경", "ok"] : ["선택", "ok"];
    return `<div class="screen msg-screen">
      ${statusBar()}
      <div class="titlebar">${m.label}</div>
      ${scrollBox("ml-list set-list", rows)}
      ${softkeys("", okLabel, ["뒤로", "clear"])}
    </div>`;
  }

  function handleSetKey(key, digit) {
    if (state.screen === "setMenu") {
      const n = SET_MENU.length;
      if (key === "up")   { state.setIndex = (state.setIndex + n - 1) % n; return render(); }
      if (key === "down") { state.setIndex = (state.setIndex + 1) % n; return render(); }
      if (digit && +digit >= 1 && +digit <= n) state.setIndex = +digit - 1;
      if (key === "ok" || key === "right" || (digit && +digit >= 1 && +digit <= n)) {
        const rows = setRows(SET_MENU[state.setIndex].id);
        const first = Math.max(0, rows.findIndex(selectable));
        const on = rows.findIndex((r) => r.on && r.kind === "radio");
        return go("setDetail", { setId: SET_MENU[state.setIndex].id, setSel: on >= 0 ? on : first });
      }
      if (key === "clear" || key === "left") return go("menu");
      return;
    }
    // setDetail
    const rows = setRows(state.setId);
    const idx = rows.map((r, i) => (selectable(r) ? i : -1)).filter((i) => i >= 0);
    const pos = idx.indexOf(state.setSel);
    if (key === "up" && idx.length)   { state.setSel = idx[(pos + idx.length - 1) % idx.length]; return render(); }
    if (key === "down" && idx.length) { state.setSel = idx[(pos + 1) % idx.length]; return render(); }
    const r = rows[state.setSel];
    if (r && r.kind === "range" && (key === "left" || key === "right")) { r.step(key === "right" ? 1 : -1); return render(); }
    if (digit && +digit >= 1 && +digit <= idx.length) { state.setSel = idx[+digit - 1]; const rr = rows[state.setSel]; if (rr.ok) rr.ok(); return state.screen === "setDetail" ? render() : undefined; }
    if (key === "ok" && r && r.ok) { r.ok(); return state.screen === "setDetail" ? render() : undefined; }
    if (key === "clear" || key === "left") return go("setMenu");
  }

  /* ---------------------------------------------------------
     6-9. 우시우시의 전화 (data.js 의 incomingCall)
     고백(보낸 문자)과 답장(받은 문자)을 모두 읽으면 잠시 뒤 전화가 와요.
     --------------------------------------------------------- */
  const IC = D.incomingCall || null;
  const callEv = {
    status: "idle",          // idle → armed(6초 대기) → ringing → active → ended → done
                             // (첫 전화 거절 시: ringing → recallWait → armed → ringing … 두 번째 전화)
    seenSent: false, seenReply: false,
    timers: [], ringTimer: null, ringOscs: [], buzzTimer: null,
    lineCount: 0, startedAt: 0, logged: false,
    round: 1,                // 1 = 첫 번째 전화, 2 = 재전화
    missTimer: null,
  };
  // 지금 전화의 대사·간격 (재전화면 incomingCall.recall)
  const RC = IC && IC.recall ? IC.recall : null;
  const callCfg = () => (callEv.round === 2 && RC ? RC : IC);
  const clearCallTimers = () => { callEv.timers.forEach(clearTimeout); callEv.timers = []; };

  // 처음 조작할 때 소리를 켤 수 있게 준비 (브라우저 자동 재생 제한 대비)
  function unlockAudio() {
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === "suspended") audio.resume();
    } catch (e) { /* 소리를 못 써도 괜찮아요 */ }
  }
  ["pointerdown", "keydown", "touchstart"].forEach((ev) =>
    document.addEventListener(ev, unlockAudio, { passive: true }));

  // 메시지를 열 때마다 확인: 고백과 답장을 둘 다 봤는지
  function noteMessageSeen(m) {
    if (!IC || !m || callEv.status !== "idle") return;
    const when = m.d ? `${m.d.getFullYear()}-${pad(m.d.getMonth() + 1)}-${pad(m.d.getDate())} ${pad(m.d.getHours())}:${pad(m.d.getMinutes())}` : "";
    if (m.box === "sent" && m.to === IC.from && when === IC.afterSent) callEv.seenSent = true;
    if (m.box === "inbox" && m.from === IC.from && when === IC.afterReply) callEv.seenReply = true;
    if (callEv.seenSent && callEv.seenReply) {
      callEv.status = "armed";
      callEv.timers.push(setTimeout(startRinging, IC.delay != null ? IC.delay : 6000));
    }
  }

  /* ---------- 벨소리 (설정 > 벨소리 · 소리 > 벨소리 크기) ---------- */
  const RING_PATTERNS = {
    bell1:  { notes: [[1319,.07],[1047,.07],[1319,.07],[1047,.07],[1319,.07],[1047,.07],[1319,.07],[1047,.07]], rest: .8 },
    bell2:  { notes: [[880,.12],[1109,.12],[1319,.12],[1760,.24]], rest: .7 },
    old:    { notes: Array.from({ length: 22 }, (_, k) => [k % 2 ? 700 : 900, .04]), rest: 1.0 },
    melody: { notes: [[1047,.15],[1319,.15],[1568,.15],[1319,.15],[1397,.15],[1760,.15],[1568,.3]], rest: .6 },
    xmas:   { notes: [[1319,.15],[1319,.15],[1319,.3],[1319,.15],[1319,.15],[1319,.3],[1319,.15],[1568,.15],[1047,.22],[1175,.08],[1319,.4]], rest: .6 },
  };
  function stopRingSound() {
    clearTimeout(callEv.ringTimer); callEv.ringTimer = null;
    callEv.ringOscs.forEach((o) => { try { o.stop(); } catch (e) {} });
    callEv.ringOscs = [];
  }
  function playRingLoop(until) {
    const pat = RING_PATTERNS[SET.ringtone];
    if (!pat || !SET.ringVol || callEv.status !== "ringing" || Date.now() > until) return;   // 무음 · 크기 0 · 40초 지나면 조용히
    let len = 0;
    try {
      unlockAudio();
      let t = audio.currentTime + 0.03;
      pat.notes.forEach(([f, d]) => {
        const o = audio.createOscillator(), g = audio.createGain();
        o.type = "square"; o.frequency.value = f;
        g.gain.setValueAtTime(0.012 * SET.ringVol, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + d * 0.95);
        o.connect(g).connect(audio.destination);
        o.start(t); o.stop(t + d);
        callEv.ringOscs.push(o);
        t += d; len += d;
      });
    } catch (e) { return; }                                   // 소리가 안 나도 전화 화면은 그대로
    callEv.ringTimer = setTimeout(() => { callEv.ringOscs = []; playRingLoop(until); }, (len + pat.rest) * 1000);
  }

  function startRinging() {
    if (callEv.status !== "armed") return;
    callEv.status = "ringing";
    if (window.Viewer && Viewer.isOpen()) Viewer.close();
    if (state.open) go("incoming");
    showRingOnCover();
    playRingLoop(Date.now() + 40000);
    // 진동 느낌 (폰이 살짝 떨림)
    const buzz = () => { els.stage.classList.remove("buzz"); void els.stage.offsetWidth; els.stage.classList.add("buzz"); };
    buzz();
    callEv.buzzTimer = setInterval(() => { if (callEv.status === "ringing") buzz(); }, 2400);
    // 재전화는 한참 받지 않으면 부재중으로 끝나요 (전화 화면에 갇히지 않도록)
    if (callEv.round === 2 && RC) {
      clearTimeout(callEv.missTimer);
      callEv.missTimer = setTimeout(missCall, RC.noAnswer || 40000);
    }
  }
  function stopRinging() {
    clearTimeout(callEv.missTimer); callEv.missTimer = null;
    stopRingSound();
    clearInterval(callEv.buzzTimer); callEv.buzzTimer = null;
    els.stage.classList.remove("buzz");
  }

  // 닫힌 폰의 외부 화면에도 전화 표시
  function showRingOnCover() {
    if (callEv.status !== "ringing") return;
    els.oled.className = "oled-text ring";
    els.oled.textContent = `☏ ${IC.from}`;
  }

  /* ---------- 통화 기록에 남기기 (한 번만) ---------- */
  function logCall(result) {
    if (callEv.logged === callEv.round) return;           // 전화 한 통에 기록 한 줄
    callEv.logged = callEv.round;
    const t = now();
    const entry = {
      dir: "in", name: IC.from, answered: result === "answered", rejected: result === "rejected",
      date: `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())} ${pad(t.getHours())}:${pad(t.getMinutes())}`,
      d: t, order: CALL_LIST.length,
    };
    if (MSG.order === "newest") CALL_LIST.unshift(entry); else CALL_LIST.push(entry);
  }

  /* ---------- 받기 · 거절 · 종료 ---------- */
  function answerCall() {
    if (callEv.status !== "ringing") return;
    stopRinging();
    callEv.status = "active";
    callEv.startedAt = Date.now();
    callEv.lineCount = 0;
    logCall("answered");
    go("incall");
    nextLine();
  }
  // 다음 대사 보여 주기 (넘기기 버튼도 이걸 써요)
  function nextLine() {
    if (callEv.status !== "active") return;
    clearCallTimers();
    const cfg = callCfg();
    const lines = cfg.lines || [];
    if (callEv.lineCount >= lines.length) return endCall();
    callEv.lineCount++;
    if (state.screen === "incall") render();
    const gaps = cfg.gaps || [];
    const wait = callEv.lineCount < lines.length ? (gaps[callEv.lineCount - 1] || 2500) : (cfg.endAfter || 3000);
    callEv.timers.push(setTimeout(nextLine, wait));
  }
  function rejectCall() {
    if (callEv.status !== "ringing") return;
    stopRinging();
    clearCallTimers();
    restoreCover();
    if (callEv.round === 1 && RC) {
      // 첫 번째 전화 거절 → 부재중으로 남기고, 잠시 뒤 다시 전화가 와요
      logCall("missed");
      callEv.status = "recallWait";
      callEv.timers.push(setTimeout(() => {
        if (callEv.status !== "recallWait") return;
        callEv.round = 2;
        callEv.status = "armed";
        startRinging();
      }, RC.afterReject != null ? RC.afterReject : 5000));
    } else {
      logCall(RC ? "missed" : "rejected");               // 재전화도 거절 → 부재중
      callEv.status = "done";
    }
    if (state.open) go("idle");
  }
  // 재전화를 끝내 받지 않음 → 부재중
  function missCall() {
    if (callEv.status !== "ringing") return;
    stopRinging();
    clearCallTimers();
    restoreCover();
    logCall("missed");
    callEv.status = "done";
    if (state.screen === "incoming") go("idle");
  }
  function endCall() {
    if (callEv.status !== "active") return;
    clearCallTimers();
    stopRinging();
    callEv.status = "ended";
    callEv.endedAfter = Math.round((Date.now() - callEv.startedAt) / 1000);
    restoreCover();
    if (state.open) go("callEnd");
    callEv.timers.push(setTimeout(() => {
      callEv.status = "done";
      if (state.screen === "callEnd") go("idle");
    }, 1800));
  }
  function restoreCover() {
    if (els.oled.classList.contains("ring")) { els.oled.className = "oled-text"; els.oled.textContent = ""; tickOled(); }
  }

  /* ---------- 화면 ---------- */
  const callTel = () => (contactByName[IC.from] ? contactByName[IC.from].tel : "");
  function renderIncoming() {
    return `<div class="screen call-screen">
      ${statusBar()}
      <div class="ic-body">
        <div class="ic-label">전화 왔어요</div>
        <div class="ic-phone">☏</div>
        <div class="ic-name">${esc(IC.from)}</div>
        <div class="ic-tel">${esc(callTel())}</div>
      </div>
      ${softkeys(["통화", "answer"], "", ["거절", "reject"])}
    </div>`;
  }
  function renderIncall() {
    const lines = (callCfg().lines || []).slice(0, callEv.lineCount);
    const sec = Math.max(0, Math.floor((Date.now() - callEv.startedAt) / 1000));
    return `<div class="screen call-screen">
      ${statusBar()}
      <div class="ic-head"><span class="ic-name sm">${esc(IC.from)}</span><span class="ic-time">통화중 ${mmssCall(sec)}</span></div>
      ${scrollBox("ic-lines", lines.map((l, i) => `<div class="ic-line${i === lines.length - 1 ? " now" : ""}">「${esc(l)}」</div>`).join(""))}
      ${softkeys(["넘기기", "skip"], "", ["종료", "hangup"])}
    </div>`;
  }
  function renderCallEnd() {
    return `<div class="screen call-screen">
      ${statusBar()}
      <div class="ic-body">
        <div class="ic-label">통화 종료</div>
        <div class="ic-name">${esc(IC.from)}</div>
        <div class="ic-tel">통화시간 ${mmssCall(callEv.endedAfter || 0)}</div>
      </div>
      ${softkeys("", ["확인", "ok"], "")}
    </div>`;
  }
  const mmssCall = (s) => `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;

  // 통화 시간 숫자 갱신 + 대사는 항상 맨 아래가 보이게
  setInterval(() => {
    if (state.screen !== "incall" || callEv.status !== "active") return;
    const el = els.lcd.querySelector(".ic-time");
    if (el) el.textContent = `통화중 ${mmssCall(Math.floor((Date.now() - callEv.startedAt) / 1000))}`;
  }, 500);

  function handleCallEventKey(key) {
    if (state.screen === "incoming") {
      if (key === "answer" || key === "call" || key === "ok") return answerCall();
      if (key === "reject" || key === "end") return rejectCall();
      return;
    }
    if (state.screen === "incall") {
      if (key === "hangup" || key === "end") return endCall();
      if (key === "skip" || key === "ok") return nextLine();
      return;
    }
    if (state.screen === "callEnd") { clearCallTimers(); callEv.status = "done"; return go("idle"); }
  }

  /* ---------------------------------------------------------
     7. 키 입력 처리
     --------------------------------------------------------- */
  function handleKey(key) {
    if (!state.open) return;
    beep(key);
    const digit = /^[0-9]$/.test(key) ? key : null;

    // 공통: 종료 키는 언제나 대기화면으로
    // 전화가 오는 중 · 통화 중엔 전화 키만
    if (["incoming", "incall", "callEnd"].includes(state.screen)) return handleCallEventKey(key);

    if (key === "end") return go("idle", { dial: "", dialMsg: "", msgFilter: null });

    switch (state.screen) {
      case "idle":
        if (key === "ok" || ["up", "down", "left", "right"].includes(key)) return go("menu");
        if (key === "msg")  return openApp(D.menu.findIndex((m) => m.id === "messages"));
        if (key === "contacts") return openApp(D.menu.findIndex((m) => m.id === "contacts"));
        if (key === "newmsg") return openNewestUnread();
        if (key === "call") return openApp(D.menu.findIndex((m) => m.id === "calls"));
        if (digit || key === "star" || key === "hash")
          return go("dial", { dial: key === "star" ? "*" : key === "hash" ? "#" : digit, dialMsg: "" });
        if (key === "video" || key === "dmb") return toast("서비스 지역이<br>아닙니다");
        if (key === "lock") return toast("키 잠금이<br>해제되어 있습니다");
        return;

      case "menu": {
        const n = D.menu.length;
        let i = state.menuIndex;
        if (key === "left")  i = (i + n - 1) % n;
        if (key === "right") i = (i + 1) % n;
        if (key === "up")    i = (i + n - 3) % n;
        if (key === "down")  i = (i + 3) % n;
        if (i !== state.menuIndex) { state.menuIndex = i; return render(); }
        if (key === "ok") return openApp(state.menuIndex);
        if (digit && digit !== "0") return openApp(Number(digit) - 1);
        if (key === "clear") return go("idle");
        return;
      }

      case "app":
        if (key === "clear") return go("menu");
        return;

      case "msgMenu": case "msgList": case "msgView": case "threads":
        return handleMessageKey(key, digit);

      case "contacts": case "contactView":
        return handleContactKey(key, digit);

      case "memoList": case "memoView":
        return handleMemoKey(key);

      case "photoList": case "photoView":
        return handlePhotoKey(key);

      case "callList": case "callView":
        return handleCallKey(key);

      case "calendar": case "calDay": case "schList":
        return handleCalKey(key);

      case "musicList": case "musicView":
        return handleMusicKey(key);

      case "show":
        return handleShowKey(key, digit);

      case "setMenu": case "setDetail":
        return handleSetKey(key, digit);

      case "dial":
        if (digit || key === "star" || key === "hash") {
          if (state.dial.length < 16)
            state.dial += key === "star" ? "*" : key === "hash" ? "#" : digit;
          state.dialMsg = "";
          return render();
        }
        if (key === "clear") {
          state.dial = state.dial.slice(0, -1);
          state.dialMsg = "";
          return state.dial ? render() : go("idle");
        }
        if (key === "call") { state.dialMsg = "연결할 수 없는<br>번호입니다"; return render(); }
        return;
    }
  }

  // 화면 위 키 클릭
  document.querySelectorAll("[data-key]").forEach((btn) => {
    btn.addEventListener("click", () => handleKey(btn.dataset.key));
  });

  // LCD 메뉴 아이콘 직접 클릭
  els.lcd.addEventListener("click", (e) => {
    const mi = e.target.closest(".mi");
    if (mi && state.screen === "menu") {
      beep();
      const i = Number(mi.dataset.index);
      if (i === state.menuIndex) openApp(i);
      else { state.menuIndex = i; render(); }
      return;
    }
    // 문자 목록의 한 줄을 누르면 바로 열기
    const row = e.target.closest(".ml-row");
    if (row) {
      const i = Number(row.dataset.i);
      if (state.screen === "msgMenu") { state.msgMenuIndex = i; return handleKey("ok"); }
      if (state.screen === "msgList") { state.listIndex = i; return handleKey("ok"); }
      if (state.screen === "contacts") { state.contactIndex = i; return handleKey("ok"); }
      if (state.screen === "threads") { state.threadIndex = i; return handleKey("ok"); }
      if (state.screen === "memoList") { state.memoIndex = i; return handleKey("ok"); }
      if (state.screen === "callList") { state.callIndex = i; return handleKey("ok"); }
      if (state.screen === "schList") { state.schIndex = i; return handleKey("ok"); }
      if (state.screen === "musicList") { state.musicIndex = i; return handleKey("ok"); }
      if (state.screen === "show") { showTop().sel = i; return handleKey("ok"); }
      if (state.screen === "setMenu") { state.setIndex = i; return handleKey("ok"); }
      if (state.screen === "setDetail") {
        state.setSel = i;
        const k = e.target.closest("[data-key]");          // 벨소리 크기 ◀ ▶
        return handleKey(k ? k.dataset.key : "ok");
      }
    }
    // 사진첩 칸 누르기: 처음 누르면 선택, 한 번 더 누르면 보기
    const ph = e.target.closest(".ph-cell");
    if (ph && state.screen === "photoList") {
      const i = Number(ph.dataset.i);
      if (i === state.photoIndex) return handleKey("ok");
      beep();
      state.photoIndex = i;
      return render();
    }
    // 달력의 날짜 칸 누르기: 처음 누르면 선택, 한 번 더 누르면 그날 일정 보기
    const cell = e.target.closest(".cal-day[data-day]");
    if (cell && state.screen === "calendar") {
      const d = Number(cell.dataset.day);
      if (d === state.calD) return handleKey("ok");
      beep();
      return go("calendar", { calD: d });
    }
    // 통화기록 탭(전체·발신·수신·부재중) 누르기
    const tab = e.target.closest(".cl-tab");
    if (tab && state.screen === "callList") {
      beep();
      return go("callList", { callTab: Number(tab.dataset.tab), callIndex: 0, callScroll: 0 });
    }
    // 소프트키(뒤로·선택 등)와 새 문자 알림을 화면에서 직접 누르기
    const k = e.target.closest("[data-key]");
    if (k && els.lcd.contains(k)) handleKey(k.dataset.key);
  });

  // 컴퓨터 키보드로도 조작
  const KEYMAP = {
    ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
    Enter: "ok", Backspace: "clear", Escape: "end", "*": "star", "#": "hash",
  };
  document.addEventListener("keydown", (e) => {
    if (window.Viewer && Viewer.isOpen()) return;   // 큰 보기 창이 열려 있으면 폰 조작 잠시 멈춤
    if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;   // 검색창에 글자 입력 중
    if (e.key === " ") { e.preventDefault(); return toggle(); }
    const key = KEYMAP[e.key] || (/^[0-9]$/.test(e.key) ? e.key : null);
    if (!key) return;
    e.preventDefault();
    const btn = document.querySelector(`[data-key="${key}"]`);
    if (btn) { btn.classList.add("pressed"); setTimeout(() => btn.classList.remove("pressed"), 120); }
    handleKey(key);
  });

  /* ---------------------------------------------------------
     8. 폴더 열기 / 닫기
     --------------------------------------------------------- */
  function setOpen(open) {
    const apply = () => {
      state.open = open;
      els.phone.classList.toggle("is-closed", !open);
      els.stage.classList.toggle("closed", !open);   // 닫히면 무대 높이도 반으로
    };
    // 클로즈업 기능이 있으면 여닫는 동안 화면 맞춤을 부드럽게
    if (window.Closeup) Closeup.morph(apply); else apply();

    els.toggle.textContent = open ? "폴더 닫기" : "폴더 열기";
    els.cover.setAttribute("aria-hidden", open ? "true" : "false");

    if (open) {
      clearNotice();          // 폴더를 열면 문자 알림은 꺼짐
      state.screen = callEv.status === "ringing" ? "incoming"
                   : callEv.status === "active" ? "incall" : "idle";   // 전화가 오는 중이면 수신 화면부터
      render();
      if (!state.booted) {
        state.booted = true;
        const boot = document.createElement("div");
        boot.className = "boot";
        boot.innerHTML = `<div class="b-sky">SKY</div><div class="b-show">SHOW</div>`;
        els.lcd.appendChild(boot);
        setTimeout(() => boot.remove(), 1700);
      }
      beep(5);
    } else {
      // 닫으면 화면은 꺼지고 다음에 열면 대기화면부터
      if (callEv.status === "active") endCall();        // 폴더를 닫으면 통화 종료
      setTimeout(() => { if (!state.open && callEv.status !== "ringing") { state.screen = "idle"; state.dial = ""; } }, 800);
      showRingOnCover();
      tickLed();
      tickOled();
    }
  }
  const toggle = () => setOpen(!state.open);

  els.cover.addEventListener("click", () => { if (!state.open) setOpen(true); });
  els.cover.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !state.open) { e.stopPropagation(); setOpen(true); }
  });
  els.hinge.addEventListener("click", () => { if (state.open) setOpen(false); });
  els.toggle.addEventListener("click", toggle);

  /* (10. 화면 크기 맞춤과 확대/축소는 js/closeup.js 로 옮겼어요) */

  /* ---------------------------------------------------------
     시작!
     --------------------------------------------------------- */
  if (window.Closeup) Closeup.refresh();
  if (!startIntro()) { tickLed(); tickOled(); }   // 첫 장면(문자 도착)부터 시작
  setInterval(tickLed, 1300);
  setInterval(tickOled, 3000);
  // 시계만 새로 고침 (화면 전체를 다시 그리면 스크롤 위치가 튀어서 글자만 바꿔요)
  function tickClock() {
    if (!state.open) return;
    const t = now();
    const hm = clockParts(t).ampm + clockParts(t).hm;
    const st = els.lcd.querySelector(".status .right span");
    if (st && st.textContent !== hm) st.textContent = hm;
    const clock = els.lcd.querySelector(".clock");        // 대기화면의 큰 시계
    if (clock && state.screen === "idle") {
      const time = clock.querySelector(".time");
      const html = bigTimeHtml(t);
      if (time.innerHTML !== html) time.innerHTML = html;
      const date = `${t.getMonth() + 1}월 ${t.getDate()}일 (${WEEK_KO[t.getDay()]})`;
      const de = clock.querySelector(".date");
      if (de.textContent !== date) de.textContent = date;
    }
  }
  setInterval(tickClock, 5000);

  // 주소 끝에 #open 을 붙이면 열린 상태로 시작 (예: index.html#open)
  if (location.hash === "#open") { state.booted = true; setOpen(true); }
})();
