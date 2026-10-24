/* =========================================================
   오시온의 휴대폰 — 뮤직 플레이어 (소리 없는 재생 시뮬레이션)

   - 곡 정보는 js/music.js 에 있어요.
   - 실제 음원·외부 사이트 연결 없이, 재생 버튼을 누르면
     재생바와 시간만 진짜 플레이어처럼 흘러가요.
   - 재생 중에 이전/다음 곡으로 넘기면 그 곡이 이어서 재생되고,
     멈춰 있을 땐 곡만 바뀌어요. 곡이 끝나면 멈추고 처음으로 돌아가요.
   ========================================================= */
(function () {
  "use strict";

  /* ---------- 곡 목록 정리 ---------- */
  function toSec(len) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(len || "").trim());
    return m ? +m[1] * 60 + +m[2] : 240;                         // 없으면 4분
  }
  const SONGS = (typeof MUSIC !== "undefined" ? MUSIC : []).map((s, i) => ({
    no: i + 1, title: s.title || "제목 없음", artist: s.artist || "", dur: toSec(s.length),
  }));

  /* ---------- 상태 ----------
     status: idle(정지) | playing(재생 중) | paused(일시정지) | ended(재생 완료) */
  const st = { index: -1, status: "idle", pos: 0 };   // pos = 멈춰 있을 때의 재생 위치(초)
  let startedAt = 0;                                    // 재생을 시작한 순간 (재생 중일 때만)
  const listeners = [];
  const emit = () => listeners.forEach((fn) => { try { fn(); } catch (e) {} });
  const cur = () => SONGS[st.index];
  const nowSec = () => performance.now() / 1000;

  function position() {
    const s = cur();
    if (!s) return 0;
    const p = st.status === "playing" ? st.pos + (nowSec() - startedAt) : st.pos;
    return Math.min(p, s.dur);
  }

  /* 곡 고르기: 재생 중이었다면 새 곡을 이어서 재생, 아니면 정지 상태로 준비 */
  function select(i, keepPlaying) {
    if (!SONGS[i]) return;
    const wasPlaying = st.status === "playing";
    st.index = i; st.pos = 0;
    if (keepPlaying && wasPlaying) { st.status = "playing"; startedAt = nowSec(); }
    else st.status = "idle";
    emit();
  }

  function play() {
    if (!cur() || st.status === "playing") return;
    if (st.status === "ended") st.pos = 0;
    st.status = "playing";
    startedAt = nowSec();
    emit();
  }
  function pause() {
    if (st.status !== "playing") return;
    st.pos = position();
    st.status = "paused";
    emit();
  }
  const toggle = () => (st.status === "playing" ? pause() : play());
  function stop() {
    if (!cur()) return;
    st.pos = 0; st.status = "idle";
    emit();
  }
  /* 재생바에서 원하는 위치로 이동 (초) */
  function seek(sec) {
    const s = cur();
    if (!s) return;
    st.pos = Math.max(0, Math.min(s.dur - 0.01, sec));
    if (st.status === "playing") startedAt = nowSec();
    else if (st.status === "ended") st.status = "paused";
    emit();
  }

  // 곡이 끝났는지 살펴보기 → 멈추고 재생바를 처음으로
  setInterval(() => {
    const s = cur();
    if (s && st.status === "playing" && position() >= s.dur) {
      st.pos = 0;
      st.status = "ended";
      emit();
    }
  }, 200);

  window.MusicPlayer = {
    songs: SONGS,
    get index() { return st.index; },
    get status() { return st.status; },
    isPlaying: () => st.status === "playing",
    select, play, pause, toggle, stop, seek,
    progress: () => ({ t: position(), d: cur() ? cur().dur : 0 }),
    onChange: (fn) => listeners.push(fn),
  };
})();
