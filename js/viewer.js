/* =========================================================
   오시온의 휴대폰 — 큰 보기 창 (사진 · 문자)
   휴대폰 속 앱(문자함, 사진첩 등)에서 이렇게 불러 쓰면 돼요:

     Viewer.openPhoto({ src: "images/photo1.jpg", caption: "사진 설명", date: "2009.05.14" });
     Viewer.openText({ title: "보낸 사람", meta: "2009.05.14 22:47", body: "문자 내용" });

   - 사진: 원본 해상도 그대로, 휠·핀치·버튼으로 확대, 드래그로 이동
   - 문자: 이미지가 아닌 실제 글자라서 글자 크기를 키워도 선명
   ========================================================= */
(function () {
  "use strict";

  let root = null;       // 창 전체
  let mode = null;       // "photo" | "text"
  let img = null, box = null;
  const pv = { z: 1, fit: 1, natW: 0, natH: 0 };
  let textSize = 17;

  function build() {
    root = document.createElement("div");
    root.className = "viewer";
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.innerHTML = `
      <div class="viewer-panel">
        <header class="viewer-head">
          <div class="viewer-title"></div>
          <button class="viewer-x" type="button" aria-label="닫기">✕</button>
        </header>
        <div class="viewer-body"></div>
        <footer class="viewer-bar"></footer>
      </div>`;
    document.body.appendChild(root);
    root.addEventListener("click", (e) => { if (e.target === root) close(); });
    root.querySelector(".viewer-x").addEventListener("click", () => close());
  }

  function show(title) {
    if (!root) build();
    root.querySelector(".viewer-title").textContent = title || "";
    root.classList.add("open");
    document.body.classList.add("viewer-open");
    try { history.pushState({ sionViewer: true }, ""); } catch (e) {}
    setTimeout(() => root.querySelector(".viewer-x").focus({ preventScroll: true }), 30);
  }

  /* ---------------- 사진 ----------------
     여러 장: Viewer.openPhoto({ list: ["a.jpg", "b.jpg"], index: 0, title: "사진첩", onIndex(i) {} })
     → ◀ ▶ 버튼, 키보드 ←/→, 좌우로 밀기로 이전·다음 사진 */
  let gal = null;   // { list, index, title, onIndex }
  function openPhoto(opts) {
    opts = opts || {};
    gal = Array.isArray(opts.list) && opts.list.length
      ? { list: opts.list, index: Math.max(0, Math.min(opts.index || 0, opts.list.length - 1)),
          title: opts.title || "사진", onIndex: opts.onIndex }
      : null;
    show(gal ? "" : (opts.caption || "사진"));
    mode = "photo";
    const body = root.querySelector(".viewer-body");
    body.innerHTML = `<div class="pv-box"><img class="pv-img" alt=""></div>`;
    box = body.querySelector(".pv-box");
    img = body.querySelector(".pv-img");
    img.decoding = "async";
    img.draggable = false;

    root.querySelector(".viewer-bar").innerHTML = `
      ${gal ? `<div class="pv-tools pv-nav">
        <button type="button" data-nav="-1" aria-label="이전 사진">◀</button>
        <button type="button" data-nav="1" aria-label="다음 사진">▶</button>
      </div>` : `<span class="pv-meta"></span>`}
      <div class="pv-tools">
        <button type="button" data-z="out" aria-label="축소">−</button>
        <button type="button" data-z="fit" class="pv-pct">맞춤</button>
        <button type="button" data-z="in" aria-label="확대">+</button>
        <button type="button" data-z="one" title="원본 크기 (1:1)">1:1</button>
      </div>`;
    root.querySelectorAll("[data-z]").forEach((b) => b.addEventListener("click", () => {
      const c = boxCenter();
      if (b.dataset.z === "in")  zoomPhoto(pv.z * 1.5, c);
      if (b.dataset.z === "out") zoomPhoto(pv.z / 1.5, c);
      if (b.dataset.z === "fit") fitPhoto();
      if (b.dataset.z === "one") zoomPhoto(1, c);
    }));
    root.querySelectorAll("[data-nav]").forEach((b) => b.addEventListener("click", () => stepPhoto(Number(b.dataset.nav))));

    img.onload = () => {
      pv.natW = img.naturalWidth;
      pv.natH = img.naturalHeight;
      fitPhoto();
      const meta = root.querySelector(".pv-meta");
      if (meta) meta.textContent = [opts.date, `${pv.natW}×${pv.natH}`].filter(Boolean).join(" · ");
    };
    if (gal) loadGal();
    else { img.alt = opts.alt || opts.caption || ""; img.src = opts.src; }   // 원본 파일 그대로 (썸네일 X)
    bindPhotoGestures();
  }

  function loadGal() {
    const n = gal.list.length, i = gal.index;
    root.querySelector(".viewer-title").textContent = `${gal.title} ${i + 1}/${n}`;
    img.alt = `${gal.title} ${i + 1}/${n}`;
    img.removeAttribute("style");
    pv.natW = 0;
    img.src = gal.list[i];
    root.querySelectorAll("[data-nav]").forEach((b) => {
      const t = i + Number(b.dataset.nav);
      b.disabled = t < 0 || t >= n;
    });
    if (gal.onIndex) gal.onIndex(i);
  }
  function stepPhoto(d) {
    if (!gal || mode !== "photo") return;
    const t = gal.index + d;
    if (t < 0 || t >= gal.list.length) return;
    gal.index = t;
    loadGal();
  }

  function boxCenter() {
    const r = box.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  function sizePhoto(z) {
    pv.z = z;
    img.style.width  = Math.round(pv.natW * z) + "px";
    img.style.height = Math.round(pv.natH * z) + "px";
    const p = root.querySelector(".pv-pct");
    if (p) p.textContent = Math.round(z * 100) + "%";
    box.classList.toggle("can-pan", box.scrollWidth > box.clientWidth || box.scrollHeight > box.clientHeight);
  }
  function fitPhoto() {
    if (!pv.natW) return;
    // 작은 사진은 억지로 늘리지 않고(최대 1배), 큰 사진은 창에 맞춤
    pv.fit = Math.min(box.clientWidth / pv.natW, box.clientHeight / pv.natH, 1);
    sizePhoto(pv.fit);
  }
  function zoomPhoto(z, at) {
    // 원본의 2배까지만 (그 이상은 픽셀이 보이기 시작)
    z = Math.min(Math.max(z, pv.fit * 0.8), Math.max(2, pv.fit));
    const r0 = img.getBoundingClientRect();
    const ux = (at.x - r0.left) / pv.z, uy = (at.y - r0.top) / pv.z;
    sizePhoto(z);
    const r1 = img.getBoundingClientRect();
    box.scrollLeft += r1.left + ux * z - at.x;
    box.scrollTop  += r1.top  + uy * z - at.y;
  }

  let gesturesBound = false, drag = null, pinch = null;
  function bindPhotoGestures() {
    if (gesturesBound) return;
    gesturesBound = true;
    const body = root.querySelector(".viewer-body");
    body.addEventListener("wheel", (e) => {
      if (mode !== "photo") return;
      e.preventDefault();
      zoomPhoto(pv.z * Math.exp(-e.deltaY * 0.0018), { x: e.clientX, y: e.clientY });
    }, { passive: false });
    body.addEventListener("dblclick", (e) => {
      if (mode !== "photo") return;
      zoomPhoto(pv.z > pv.fit * 1.05 ? pv.fit : Math.max(1, pv.fit * 2), { x: e.clientX, y: e.clientY });
    });
    body.addEventListener("pointerdown", (e) => {
      if (mode !== "photo" || e.pointerType !== "mouse") return;
      drag = { x: e.clientX, y: e.clientY, sl: box.scrollLeft, st: box.scrollTop };
      box.classList.add("dragging");
    });
    window.addEventListener("pointermove", (e) => {
      if (!drag) return;
      box.scrollLeft = drag.sl - (e.clientX - drag.x);
      box.scrollTop  = drag.st - (e.clientY - drag.y);
    });
    window.addEventListener("pointerup", () => { drag = null; if (box) box.classList.remove("dragging"); });
    const d = (a, b) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    let swipe = null;
    body.addEventListener("touchstart", (e) => {
      if (mode === "photo" && e.touches.length === 2) { pinch = { d: d(e.touches[0], e.touches[1]), z: pv.z }; swipe = null; }
      else if (mode === "photo" && gal && e.touches.length === 1 && pv.z <= pv.fit * 1.02)
        swipe = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }, { passive: true });
    body.addEventListener("touchend", (e) => {
      if (!swipe || e.touches.length) return;
      const t = e.changedTouches[0], dx = t.clientX - swipe.x, dy = t.clientY - swipe.y;
      swipe = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) stepPhoto(dx < 0 ? 1 : -1);
    });
    body.addEventListener("touchmove", (e) => {
      if (!pinch || e.touches.length !== 2) return;
      e.preventDefault();
      const [a, b] = e.touches;
      zoomPhoto(pinch.z * d(a, b) / pinch.d, { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 });
    }, { passive: false });
    body.addEventListener("touchend", (e) => { if (e.touches.length < 2) pinch = null; });
  }

  /* ---------------- 문자 ---------------- */
  function openText(opts) {
    opts = opts || {};
    show(opts.title || "문자");
    mode = "text";
    const body = root.querySelector(".viewer-body");
    body.innerHTML = `<article class="tv"><div class="tv-meta"></div><div class="tv-text"></div></article>`;
    body.querySelector(".tv-meta").textContent = opts.meta || "";
    body.querySelector(".tv-text").textContent = opts.body || "";   // 글자 그대로 (HTML 해석 X)
    if (opts.art) body.querySelector(".tv").classList.add("tv-art");   // 그림문자: 공백·줄바꿈 그대로
    body.querySelector(".tv").style.fontSize = textSize + "px";

    root.querySelector(".viewer-bar").innerHTML = `
      <span class="pv-meta">글자 크기</span>
      <div class="pv-tools">
        <button type="button" data-t="-1" aria-label="글자 작게">가−</button>
        <button type="button" data-t="1" aria-label="글자 크게">가+</button>
      </div>`;
    root.querySelectorAll("[data-t]").forEach((b) => b.addEventListener("click", () => {
      textSize = Math.min(34, Math.max(13, textSize + Number(b.dataset.t) * 2));
      body.querySelector(".tv").style.fontSize = textSize + "px";
    }));
  }

  /* ---------------- 닫기 ---------------- */
  function close(fromHistory) {
    if (!root || !root.classList.contains("open")) return;
    root.classList.remove("open");
    document.body.classList.remove("viewer-open");
    mode = null;
    gal = null;
    root.querySelector(".viewer-body").innerHTML = "";
    if (!fromHistory && history.state && history.state.sionViewer) {
      Viewer.skipPop = true;   // 이 뒤로 가기는 클로즈업까지 닫지 않도록
      try { history.back(); } catch (e) {}
    }
  }

  document.addEventListener("keydown", (e) => {
    if (!isOpen()) return;
    if (e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); close(); }
    if (gal && mode === "photo" && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
      e.preventDefault(); e.stopImmediatePropagation();
      stepPhoto(e.key === "ArrowLeft" ? -1 : 1);
    }
  }, true);

  const isOpen = () => !!(root && root.classList.contains("open"));

  window.addEventListener("resize", () => { if (mode === "photo") fitPhoto(); });

  window.Viewer = { openPhoto, openText, close, isOpen };
})();
