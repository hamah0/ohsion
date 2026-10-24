/* =========================================================
   오시온의 휴대폰 — 클로즈업(확대 보기)
   - 휴대폰 화면(LCD)을 누르면 화면 쪽으로 자동 클로즈업
   - 오른쪽 위 [클로즈업 / 클로즈업 해제] 버튼으로도 전환
   - 모바일 두 손가락(핀치) · 키보드 + − 로 확대·축소, 드래그·휠로 이동
   - 해제: 버튼, 휴대폰 바깥 빈 곳 클릭, 브라우저 뒤로 가기

   ★ 선명도 비결: 그림을 늘리는 transform: scale() 대신
     CSS zoom 으로 휴대폰(HTML/CSS)을 실제 크기로 다시 그려요.
     움직이는 순간에만 transform 을 쓰고, 멈추면 다시 선명해져요.
   ========================================================= */
(function () {
  "use strict";

  const $ = (s) => document.querySelector(s);
  const scene = $(".scene");
  const wrap  = $("#stageWrap");
  const stage = $("#stage");
  const btn   = $("#closeupBtn");

  // CSS zoom 을 지원하지 않는 아주 오래된 브라우저는 예전 방식(scale)으로
  const ZOOM_OK = typeof CSS !== "undefined" && CSS.supports && CSS.supports("zoom", "2");

  const view = {
    z: 1,          // 현재 배율
    fitZ: 1,       // 휴대폰 전체가 딱 맞는 배율
    atFit: true,   // 전체 보기 상태인가? (아니면 클로즈업)
    pushed: false, // 뒤로 가기용 기록을 남겼는가?
  };

  /* ---------- 기본 측정 ---------- */
  const isOpen = () => !stage.classList.contains("closed");

  function baseSize() {
    if (!ZOOM_OK) return { w: stage.offsetWidth, h: stage.offsetHeight };
    const r = stage.getBoundingClientRect();
    return { w: r.width / view.z, h: r.height / view.z };
  }

  function area() {   // 휴대폰을 놓을 수 있는 빈 공간 (여백 제외)
    const cs = getComputedStyle(scene);
    const pl = parseFloat(cs.paddingLeft), pr = parseFloat(cs.paddingRight);
    const pt = parseFloat(cs.paddingTop),  pb = parseFloat(cs.paddingBottom);
    return { w: scene.clientWidth - pl - pr, h: scene.clientHeight - pt - pb, pl, pt };
  }

  const clamp = (z) => Math.min(Math.max(view.fitZ * 5, 5), Math.max(view.fitZ * 0.85, z));

  /* ---------- 배율 적용 ---------- */
  function setZoomRaw(z) {
    const b = baseSize();
    view.z = z;
    if (ZOOM_OK) {
      stage.style.zoom = z;
    } else {
      stage.style.transformOrigin = "0 0";
      stage.style.transform = `scale(${z})`;
      wrap.style.width  = b.w * z + "px";
      wrap.style.height = b.h * z + "px";
    }
  }

  /* 특정 지점(커서·손가락 위치)을 고정한 채 확대/축소 */
  function setZoom(z, anchor) {
    z = clamp(z);
    if (Math.abs(z - view.z) < 0.0005) return;
    const r0 = stage.getBoundingClientRect();
    const ux = (anchor.x - r0.left) / view.z;
    const uy = (anchor.y - r0.top) / view.z;
    setZoomRaw(z);
    const r1 = stage.getBoundingClientRect();
    scene.scrollLeft += r1.left + ux * z - anchor.x;
    scene.scrollTop  += r1.top  + uy * z - anchor.y;
    setFit(Math.abs(z - view.fitZ) / view.fitZ < 0.03);
  }

  function viewCenter() {
    const s = scene.getBoundingClientRect(), a = area();
    return { x: s.left + a.pl + a.w / 2, y: s.top + a.pt + a.h / 2 };
  }
  function centerOn(rect) {
    const c = viewCenter();
    scene.scrollLeft += rect.left + rect.width / 2 - c.x;
    scene.scrollTop  += rect.top + rect.height / 2 - c.y;
  }

  /* 상태 표시 (버튼 글자, 커서 모양) */
  function setFit(fit) {
    view.atFit = fit;
    document.body.classList.toggle("at-fit", fit);
    document.body.classList.toggle("is-closeup", !fit);
    btn.textContent = fit ? "클로즈업" : "클로즈업 해제";
    btn.setAttribute("aria-pressed", String(!fit));
    scene.classList.toggle("can-pan", !fit && canPan());
  }

  /* ---------- 전체 보기 ---------- */
  function applyFit() {
    setZoomRaw(1);
    const b = baseSize(), a = area();
    view.fitZ = Math.min(a.h / b.h, a.w / b.w, 1.4) * 0.96;
    setZoomRaw(view.fitZ);
    scene.scrollLeft = scene.scrollTop = 0;
    setFit(true);
  }

  /* ---------- 클로즈업: 열림 → 내부 화면, 닫힘 → 외부 화면·LED ---------- */
  function focusRect() {
    if (isOpen()) return $(".lcd-frame").getBoundingClientRect();
    const a = $(".cover-show").getBoundingClientRect(), b = $("#led").getBoundingClientRect();
    const pad = 12 * view.z;
    const left = Math.min(a.left, b.left) - pad, top = Math.min(a.top, b.top) - pad;
    const right = Math.max(a.right, b.right) + pad, bottom = Math.max(a.bottom, b.bottom) + pad;
    return { left, top, width: right - left, height: bottom - top };
  }
  function applyCloseup() {
    const a = area(), r = focusRect();
    const z = clamp(Math.min(a.w / (r.width / view.z), a.h / (r.height / view.z)) * 0.84);
    setZoomRaw(z);
    centerOn(focusRect());
    setFit(false);
  }

  /* ---------- 부드러운 전환 (FLIP 기법) ----------
     1) 바꾸기 전 위치를 재고  2) 레이아웃을 바꾼 뒤 다시 재고
     3) 그 차이만큼 transform 으로 되돌려 놓았다가  4) 0으로 풀어 줌 */
  let morphTimer = null;
  function cancelMorph() {
    clearTimeout(morphTimer);
    wrap.style.transition = "none";
    wrap.style.transform = "";
    wrap.classList.remove("morphing");
  }
  function morph(change, opts) {
    opts = opts || {};
    cancelMorph();
    const anchor = typeof opts.anchor === "string" ? $(opts.anchor) : (opts.anchor || stage);
    const a = anchor.getBoundingClientRect();
    change();
    const b = anchor.getBoundingClientRect();
    if (!b.width || !a.width) return;
    const w = wrap.getBoundingClientRect();
    const k = a.width / b.width;
    const dx = a.left - (w.left + k * (b.left - w.left));
    const dy = a.top  - (w.top  + k * (b.top  - w.top));
    if (Math.abs(k - 1) < 0.002 && Math.abs(dx) < 1 && Math.abs(dy) < 1) return;

    const dur = opts.duration || 650;
    wrap.classList.add("morphing");
    wrap.style.transformOrigin = "0 0";
    wrap.style.transform = `translate(${dx}px, ${dy}px) scale(${k})`;
    void wrap.offsetWidth;
    wrap.style.transition = `transform ${dur}ms cubic-bezier(.22,.8,.24,1)`;
    wrap.style.transform = "";
    morphTimer = setTimeout(cancelMorph, dur + 40);
  }

  /* ---------- 클로즈업 켜기 / 끄기 ---------- */
  function closeup() {
    morph(applyCloseup);
    if (!view.pushed) {
      try { history.pushState({ sionCloseup: true }, ""); view.pushed = true; } catch (e) {}
    }
  }
  function release(fromHistory) {
    if (window.Viewer && Viewer.isOpen()) Viewer.close(true);
    morph(applyFit);
    if (view.pushed && !fromHistory) {
      view.pushed = false;
      try { history.back(); } catch (e) {}
    }
    view.pushed = false;
  }
  const toggleCloseup = () => (view.atFit ? closeup() : release());

  window.addEventListener("popstate", () => {
    if (window.Viewer && Viewer.skipPop) { Viewer.skipPop = false; return; }
    if (window.Viewer && Viewer.isOpen()) { Viewer.close(true); return; }
    if (!view.atFit) release(true);
  });

  btn.addEventListener("click", toggleCloseup);

  /* ---------- 클릭: 화면을 누르면 클로즈업, 빈 곳을 누르면 해제 ---------- */
  let suppressClick = false;
  scene.addEventListener("click", (e) => {
    if (suppressClick) {               // 드래그로 이동한 직후의 클릭은 무시
      suppressClick = false;
      e.preventDefault(); e.stopPropagation();
      return;
    }
    const t = e.target;
    // 전체 보기에서 열린 폰의 화면을 누르면 → 클로즈업 (메뉴는 누르지 않음)
    if (view.atFit && isOpen() && t.closest(".inner-glass")) {
      e.preventDefault(); e.stopPropagation();
      closeup();
      return;
    }
    // 클로즈업 중 휴대폰 바깥 빈 곳 → 해제
    if (!view.atFit && (t === scene || t === wrap || t === stage || t.id === "phone")) release();
  }, true);

  /* (마우스 휠 확대·축소는 사용하지 않아요. 휠은 목록·문자 스크롤과 화면 이동에만 쓰여요) */

  /* ---------- 마우스 드래그로 이동 ---------- */
  let drag = null;
  const canPan = () =>
    scene.scrollWidth > scene.clientWidth + 1 || scene.scrollHeight > scene.clientHeight + 1;

  scene.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "mouse" || e.button !== 0 || !canPan()) return;
    if (e.target.closest && e.target.closest(".mp-bar")) return;   // 음악 재생바를 끌 땐 화면 이동 X
    drag = { x: e.clientX, y: e.clientY, sl: scene.scrollLeft, st: scene.scrollTop, moved: false };
  });
  window.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) > 5) { drag.moved = true; scene.classList.add("dragging"); }
    if (drag.moved) { scene.scrollLeft = drag.sl - dx; scene.scrollTop = drag.st - dy; }
  });
  window.addEventListener("pointerup", () => {
    if (!drag) return;
    if (drag.moved) suppressClick = true;
    setTimeout(() => { suppressClick = false; }, 0);
    drag = null;
    scene.classList.remove("dragging");
  });

  /* ---------- 모바일: 두 손가락으로 확대·축소 ---------- */
  let pinch = null;
  const dist = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  scene.addEventListener("touchstart", (e) => {
    if (e.touches.length !== 2) return;
    cancelMorph();
    pinch = { d: dist(e.touches[0], e.touches[1]), z: view.z };
  }, { passive: true });
  scene.addEventListener("touchmove", (e) => {
    if (!pinch || e.touches.length !== 2) return;
    e.preventDefault();
    const [a, b] = e.touches;
    setZoom(pinch.z * dist(a, b) / pinch.d, {
      x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2,
    });
  }, { passive: false });
  scene.addEventListener("touchend", (e) => { if (e.touches.length < 2) pinch = null; });
  document.addEventListener("gesturestart", (e) => e.preventDefault());  // iOS 페이지 확대 막기

  // 키보드 + / − 로도 확대·축소
  document.addEventListener("keydown", (e) => {
    if (window.Viewer && Viewer.isOpen()) return;
    if (e.target && /^(INPUT|TEXTAREA)$/.test(e.target.tagName)) return;   // 검색창 입력 중엔 무시
    if (e.key === "+" || e.key === "=") { e.preventDefault(); morph(() => setZoom(view.z * 1.4, viewCenter()), { duration: 260 }); }
    if (e.key === "-" || e.key === "_") { e.preventDefault(); morph(() => setZoom(view.z / 1.4, viewCenter()), { duration: 260 }); }
  });

  /* ---------- 창 크기 변경 ---------- */
  let rz = null;
  window.addEventListener("resize", () => {
    clearTimeout(rz);
    rz = setTimeout(() => {
      cancelMorph();
      if (view.atFit) applyFit(); else { applyFit(); applyCloseup(); }
    }, 80);
  });

  /* ---------- 다른 파일(phone.js)에서 쓰는 기능 ---------- */
  window.Closeup = {
    /* 폴더를 여닫을 때: 바뀌는 동안 자연스럽게 전체 보기로 맞춤 */
    morph(change) {
      morph(() => { change(); applyFit(); }, { anchor: ".body", duration: 750 });
      if (view.pushed) { view.pushed = false; try { history.back(); } catch (e) {} }
    },
    refresh: applyFit,
    closeup, release,
    isCloseup: () => !view.atFit,
  };

  applyFit();
})();
