// ============================================================
// storage.js — 브라우저에 기록 남기기 (localStorage)
// 사생활 보호 모드처럼 저장이 막힌 환경에서도 앱이 멈추지 않도록,
// 실패하면 조용히 메모리에만 들고 있는다. (이 경우 창을 닫으면 사라진다)
// 저장하는 것은 숫자 기록뿐이다. 영상·사진은 어디에도 저장하지 않는다.
// ============================================================

const PREFIX = "posture-app.";
const memory = new Map();
let persistent = true;

/** 저장이 실제로 되는 환경인가 (false면 창을 닫을 때 기록이 사라진다) */
export function isPersistent() {
  return persistent;
}

export function load(key, fallback) {
  if (memory.has(key)) return memory.get(key);
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    const value = raw == null ? fallback : JSON.parse(raw);
    memory.set(key, value);
    return value;
  } catch {
    persistent = false;
    memory.set(key, fallback);
    return fallback;
  }
}

/** @returns {boolean} 브라우저에 저장됐으면 true */
export function save(key, value) {
  memory.set(key, value);
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    // 저장 공간이 가득 찼거나 저장이 막혀 있다
    persistent = false;
    return false;
  }
}
