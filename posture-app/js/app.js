// ============================================================
// app.js — 화면 동작 (버튼, 측정 진행, 결과 표시)
// 핵심 계산은 angle.js(목 각도), quadfit.js(2차 곡선), stats.js(통계)에 있다.
// ============================================================

import { measureNeck, MovingAverage, median, SIDE_VIEW_LIMIT } from "./angle.js";
import { startTilt, currentTilt, tiltMessage } from "./tilt.js";
import { evalQuadratic } from "./quadfit.js";
import {
  summarize, AlertTracker, meanAbsError, analyzeStand, round1, LOW_TRUST_PCT,
  sessionCsv, sessionsSummaryCsv, verifyCsv, standCsv,
  referenceSummary, percentileRank, shareBelow, tiltLabel,
} from "./stats.js";
import { CVA_SITTING_EVALUATOR1, CVA_SITTING_EVALUATOR2, CVA_CUTOFFS, REFERENCE_SOURCE } from "./reference.js";
import * as store from "./storage.js";
import {
  loadPose, detect, startCamera, stopCamera, cameraIsOn, cameraErrorMessage, MODELS, loadedModel,
} from "./pose.js";

const $ = (id) => document.getElementById(id);

/** 요소 만들기 도우미. 글자는 항상 textContent로 넣는다(입력한 글자가 코드로 실행되지 않게) */
function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === "class") node.className = v;
    else if (k === "text") node.textContent = v;
    else if (k === "onclick") node.addEventListener("click", v);
    else node.setAttribute(k, v);
  }
  for (const child of [].concat(children)) if (child) node.append(child);
  return node;
}

// ---------------- 작은 도우미들 ----------------

const pad2 = (n) => String(n).padStart(2, "0");
const mmss = (sec) => `${pad2(Math.floor(sec / 60))}:${pad2(Math.floor(sec % 60))}`;
const deg = (v) => (v == null ? "–" : `${v}°`);
const pct = (v) => (v == null ? "–" : `${v}%`);

/** 지금 시각을 "2026-11-11 14:03:05" 꼴로 (이 기기의 시간대) */
function localStamp(d = new Date()) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
}

function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** CSV 글자를 파일로 내려받게 한다 */
function download(filename, text) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
  const a = el("a", { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

/** 파일 이름에 쓸 수 없는 글자를 뺀다 */
function fileSafe(...parts) {
  return parts
    .map((p) => String(p).trim().replace(/[\\/:*?"<>|\s]+/g, "-"))
    .filter(Boolean)
    .join("_");
}
const stampForFile = (stamp) => stamp.replace(/[-:]/g, "").replace(" ", "-").slice(0, 13);

function numberFrom(id) {
  const v = Number($(id).value);
  return Number.isFinite(v) ? v : NaN;
}

// ---------------- 저장된 것들 ----------------

const settings = { facing: "environment", tiltOn: true, model: "full", ...store.load("settings", {}) };
const getSessions = () => store.load("sessions", []);
const getStands = () => store.load("stands", []);
const getVerify = () => store.load("verify", []);

// ---------------- 화면 전환 ----------------

const video = $("cam");
const overlay = $("overlay");
const stage = $("stage");

/** 카메라가 필요한 화면 */
const CAMERA_SCREENS = new Set(["prep", "baseline", "measuring", "verify", "stand-comfort"]);
/** 참여자가 자기 모습을 보지 않도록 카메라 화면을 숨기는 화면 */
const HIDDEN_CAMERA = new Set(["baseline", "measuring"]);

let currentScreen = "home";
let cameraToken = 0;     // 화면이 바뀌면 늘어난다 → 늦게 끝난 카메라 준비를 무시하는 데 쓴다
let measuring = null;    // 측정 중이면 그 측정을 끝내는 함수들
let standRun = null;     // 독서대 추천 진행 상태

function show(name) {
  currentScreen = name;
  for (const sec of document.querySelectorAll("[data-screen]")) sec.hidden = sec.dataset.screen !== name;

  if (!CAMERA_SCREENS.has(name)) {
    cameraToken += 1;
    stopLoop();
    stopCamera(video);
    clearFreeze();
  }
  // 카메라 화면은 자세 잡기·검증에서만 보인다. 측정 중에는 숨긴다.
  stage.hidden = !CAMERA_SCREENS.has(name) || name === "stand-comfort";
  stage.classList.toggle("concealed", HIDDEN_CAMERA.has(name));
  stage.classList.toggle("mirror", settings.facing === "user");
  loopPaused = !(name === "prep" || name === "verify" || HIDDEN_CAMERA.has(name));
  if (!HIDDEN_CAMERA.has(name)) frameHandler = null;

  $("btn-home").hidden = name === "home" || HIDDEN_CAMERA.has(name);
  document.body.classList.toggle("is-measuring", HIDDEN_CAMERA.has(name));
  window.scrollTo(0, 0);
}

function goHome() {
  if (standRun && !window.confirm("독서대 추천 측정을 그만둘까요? 지금까지 잰 각도의 결과는 사라져요.")) return;
  standRun = null;
  show("home");
  $("storage-warning").hidden = store.isPersistent();
}

function go(name) {
  if (name === "home") return goHome();
  if (name === "verify") return openVerify();
  if (name === "history") return openHistory();
  show(name);
}

for (const btn of document.querySelectorAll("[data-go]")) {
  btn.addEventListener("click", () => {
    if (btn.dataset.go === "home") standRun = null; // 결과 화면의 "처음으로"는 묻지 않는다
    go(btn.dataset.go);
  });
}
$("btn-home").addEventListener("click", goHome);

// ---------------- 카메라 + 자세 인식 반복 ----------------

let loopOn = false;
let loopPaused = true;
let lastDetect = 0;
let frameHandler = null; // 프레임마다 불리는 함수 (측정 결과, 지금 시각 ms, 기울기 상태)

const DETECT_EVERY_MS = 100; // 1초에 약 10번 잰다 (배터리·발열을 줄이려고)

function startLoop() {
  if (loopOn) return;
  loopOn = true;
  requestAnimationFrame(loopTick);
}
function stopLoop() {
  loopOn = false;
  clearOverlay();
}

function loopTick() {
  if (!loopOn) return;
  requestAnimationFrame(loopTick);
  const now = performance.now();
  if (loopPaused || now - lastDetect < DETECT_EVERY_MS) return;
  if (video.readyState < 2 || !video.videoWidth) return;
  lastDetect = now;

  const t = readTilt();
  let m;
  try {
    m = measureNeck(detect(video), video.videoWidth, video.videoHeight, t.status === "on" ? t.tilt : null);
  } catch {
    m = { ok: false, reason: "인식 중 오류가 났어요" };
  }
  if (currentScreen === "prep" || currentScreen === "verify") drawOverlay(m);
  if (frameHandler) frameHandler(m, Date.now(), t);
}

/** 지금 카메라 기울기 (보정을 끄면 status "off") */
function readTilt() {
  return settings.tiltOn ? currentTilt(settings.facing) : { status: "off" };
}

// 자세 잡기·검증 화면의 안내 (기울기, 옆모습). 옆모습 값은 1초 평균으로 부드럽게 해서 깜빡이지 않게 한다
const sideAverage = new MovingAverage(1000);
function showSetupHints(m, t, tiltEl, sideEl) {
  const msg = tiltMessage(t, settings.tiltOn);
  tiltEl.textContent = msg.text;
  tiltEl.className = `status small${msg.warn ? " bad" : ""}`;
  const now = performance.now();
  if (m.ok && m.sideRatio != null) sideAverage.add(now, m.sideRatio);
  const ratio = sideAverage.value(now);
  const notSide = ratio != null && ratio > SIDE_VIEW_LIMIT;
  sideEl.hidden = !notSide;
  if (notSide) {
    sideEl.textContent = "양쪽 어깨가 떨어져 보여요. 카메라가 정면 쪽으로 돌아가 있으면 목 각도가 실제보다 작게 나와요. 카메라를 앉은 사람의 정확히 옆으로 옮겨 주세요.";
  }
}

/** 카메라 화면 위에 귀·어깨 점과 연결선만 그린다 (각도 숫자는 그리지 않는다) */
function drawOverlay(m) {
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (overlay.width !== w || overlay.height !== h) {
    overlay.width = w;
    overlay.height = h;
  }
  const ctx = overlay.getContext("2d");
  ctx.clearRect(0, 0, w, h);
  if (!m.ok) return;
  const s = Math.max(w, h) / 640;
  // 진짜 수직선 (기울기 보정을 하면 폰이 기운 만큼 기울어져 그려진다)
  const len = Math.hypot(m.ear.x - m.shoulder.x, m.ear.y - m.shoulder.y) * 1.2;
  ctx.lineWidth = 3 * s;
  ctx.setLineDash([10 * s, 7 * s]);
  ctx.strokeStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(m.shoulder.x, m.shoulder.y);
  ctx.lineTo(m.shoulder.x + m.up.x * len, m.shoulder.y + m.up.y * len);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineWidth = 4 * s;
  ctx.strokeStyle = "#ffd400";
  ctx.beginPath();
  ctx.moveTo(m.shoulder.x, m.shoulder.y);
  ctx.lineTo(m.ear.x, m.ear.y);
  ctx.stroke();
  for (const p of [m.ear, m.shoulder]) drawDot(ctx, p, 8 * s);
}

function drawDot(ctx, p, r) {
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fillStyle = "#ffd400";
  ctx.fill();
  ctx.lineWidth = r * 0.35;
  ctx.strokeStyle = "#000";
  ctx.stroke();
}

function clearOverlay() {
  overlay.getContext("2d").clearRect(0, 0, overlay.width, overlay.height);
}

/**
 * 카메라와 자세 인식을 준비한다.
 * @param {HTMLElement} statusEl 진행 상황을 적을 곳
 * @returns {Promise<boolean>} 준비됐으면 true
 */
async function ensureCamera(statusEl) {
  const token = cameraToken;
  const say = (text, cls = "") => {
    statusEl.textContent = text;
    statusEl.className = `status ${cls}`;
  };
  try {
    if (!cameraIsOn()) {
      say("카메라를 여는 중… (권한을 물으면 '허용'을 눌러 주세요)");
      await startCamera(video, settings.facing);
      if (token !== cameraToken) { stopCamera(video); return false; }
    }
  } catch (err) {
    if (token === cameraToken) say(cameraErrorMessage(err), "bad");
    return false;
  }
  try {
    if (loadedModel() !== settings.model) {
      say(settings.model === "heavy"
        ? "정밀 자세 인식 프로그램을 불러오는 중… (약 30MB, 처음에는 시간이 좀 걸려요)"
        : "자세 인식 프로그램을 불러오는 중… (처음에는 몇 초 걸려요)");
    }
    await loadPose(settings.model);
  } catch {
    if (token === cameraToken) {
      say("자세 인식 프로그램을 내려받지 못했어요. 인터넷 연결을 확인하고 페이지를 새로 고쳐 주세요.", "bad");
    }
    return false;
  }
  if (token !== cameraToken) return false;
  say("준비됐어요.");
  startLoop();
  return true;
}

/** 전면 ↔ 후면 카메라 바꾸기 */
async function flipCamera(statusEl, afterReady) {
  settings.facing = settings.facing === "user" ? "environment" : "user";
  store.save("settings", settings);
  syncFacingRadios();
  stopCamera(video);
  stage.classList.toggle("mirror", settings.facing === "user");
  if (await ensureCamera(statusEl)) afterReady?.();
}

function syncFacingRadios() {
  for (const r of document.querySelectorAll('input[name="facing"]')) r.checked = r.value === settings.facing;
}
for (const r of document.querySelectorAll('input[name="facing"]')) {
  r.addEventListener("change", () => {
    settings.facing = r.value;
    store.save("settings", settings);
  });
}
syncFacingRadios();

// 정확도 설정: 기울기 보정, 자세 인식 모델
$("opt-tilt").checked = settings.tiltOn;
$("opt-tilt").addEventListener("change", () => {
  settings.tiltOn = $("opt-tilt").checked;
  store.save("settings", settings);
  if (settings.tiltOn) startTilt(); // 아이폰은 이 순간(터치)에만 센서 권한을 물을 수 있다
});
for (const r of document.querySelectorAll('input[name="model"]')) {
  r.checked = r.value === settings.model;
  r.addEventListener("change", () => {
    settings.model = r.value;
    store.save("settings", settings);
  });
}

// 화면 꺼짐 방지 (Wake Lock). 지원하는 브라우저에서만 동작한다.
let wakeLock = null;
let wakeWanted = false;
async function wakeOn() {
  wakeWanted = true;
  try {
    if ("wakeLock" in navigator && !wakeLock) wakeLock = await navigator.wakeLock.request("screen");
  } catch {
    // 지원하지 않거나 거절됨 — 그냥 진행한다
  }
}
function wakeOff() {
  wakeWanted = false;
  wakeLock?.release().catch(() => {});
  wakeLock = null;
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  if (wakeWanted) wakeOn(); // 다른 앱에 다녀오면 풀리므로 다시 건다
  if (cameraIsOn()) video.play().catch(() => {});
});

// 알림 소리 (설정에서 켰을 때만)
let audioCtx = null;
function prepareSound() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    audioCtx.resume?.();
  } catch {
    audioCtx = null;
  }
}
function beep() {
  if (!audioCtx) return;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.value = 660;
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.35);
  } catch {
    // 소리를 못 내도 측정은 계속한다
  }
}

// ---------------- 자세 잡기 화면 (측정 직전) ----------------

let prepOnStart = null;

async function openPrep({ title, instruction, onStart }) {
  if (settings.tiltOn) startTilt(); // 버튼을 누른 순간에 불러야 아이폰이 권한을 물을 수 있다
  prepOnStart = onStart;
  $("prep-tilt").textContent = "";
  $("prep-side").hidden = true;
  $("prep-title").textContent = title;
  $("prep-instruction").textContent = instruction ?? "";
  $("prep-instruction").hidden = !instruction;
  $("prep-start").disabled = true;
  show("prep");
  if (await ensureCamera($("prep-status"))) watchPrep();
}

function watchPrep() {
  $("prep-start").disabled = false;
  const status = $("prep-status");
  frameHandler = (m, now, t) => {
    status.textContent = m.ok ? "귀와 어깨가 인식됐어요. 시작해도 좋아요." : `${m.reason}. 카메라 위치를 조정해 주세요.`;
    status.className = `status ${m.ok ? "ok" : "bad"}`;
    showSetupHints(m, t, $("prep-tilt"), $("prep-side"));
  };
}

$("prep-start").addEventListener("click", () => prepOnStart?.());
$("prep-flip").addEventListener("click", () => {
  $("prep-start").disabled = true;
  flipCamera($("prep-status"), watchPrep);
});

// ---------------- 측정 ----------------

/**
 * 측정을 진행한다. 세션 모드와 독서대 추천 모드가 같이 쓴다.
 * @param {{durationSec:number, threshold:number, alertOn:boolean, holdSec?:number, sound?:boolean, label:string}} opt
 * @returns {Promise<{records:Array, alertCount:number, startedAt:string, tiltMode:string, resolution:string, model:string}>}
 *   records의 한 줄 = [경과 시간(초), 목 각도 또는 null, 측정 가능 1/0, 알림 표시 1/0, 카메라 기울기 또는 null]
 */
function runMeasurement(opt) {
  return new Promise((resolve) => {
    const startedAt = localStamp();
    const startMs = Date.now();
    const records = [];
    const average = new MovingAverage(1000);                 // 최근 1초 평균
    const tracker = opt.alertOn ? new AlertTracker(opt.threshold, opt.holdSec) : null;
    const newBucket = () => ({ frames: 0, angles: [], tilts: [] });
    let bucket = newBucket();                                // 지금 1초 동안 모은 프레임
    const tiltSeen = {};                                     // 기울기 상태별 프레임 수 (보정을 했는지 기록용)

    $("m-label").textContent = opt.label;
    $("m-angle-box").hidden = !opt.alertOn; // 알림 OFF에서는 실시간 각도를 보여 주지 않는다
    $("m-angle").textContent = "–";
    $("m-threshold").textContent = opt.threshold;
    $("m-remaining").textContent = mmss(opt.durationSec);
    $("m-detect").textContent = "";
    setAlert(false);
    show("measuring");
    wakeOn();

    // 프레임마다(약 0.1초마다): 값 모으기 + 알림 판정
    frameHandler = (m, now, t) => {
      bucket.frames += 1;
      tiltSeen[t.status] = (tiltSeen[t.status] ?? 0) + 1;
      if (t.status === "on") bucket.tilts.push(t.tilt);
      if (m.ok) {
        bucket.angles.push(m.angle);
        average.add(now, m.angle);
      }
      const smooth = average.value(now); // 최근 1초에 잰 값이 하나도 없으면 null
      $("m-detect").textContent = m.ok ? "자세 인식 중" : `측정 불가 — ${m.reason}`;
      if (tracker) {
        const was = tracker.showing;
        const showing = tracker.update(now, smooth);
        if (showing !== was) setAlert(showing);
        if (showing && !was && opt.sound) beep();
        $("m-angle").textContent = smooth == null ? "–" : Math.round(smooth);
      }
    };

    // 1초가 지날 때마다 기록 한 줄을 남긴다
    function closeSecond() {
      // 그 1초 동안 본 프레임의 절반 이상에서 귀·어깨가 보였을 때만 "측정 가능"
      const validFrames = bucket.angles.length;
      const valid = validFrames > 0 && validFrames * 2 >= bucket.frames;
      // 그 1초의 대표값 = 중앙값 (팔이 얼굴을 지나가는 순간처럼 한두 번 튄 값에 흔들리지 않게)
      const angle = valid ? round1(median(bucket.angles)) : null;
      const tilt = bucket.tilts.length ? round1(median(bucket.tilts)) : null;
      records.push([records.length + 1, angle, valid ? 1 : 0, tracker?.showing ? 1 : 0, tilt]);
      bucket = newBucket();
    }

    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startMs) / 1000);
      while (records.length < Math.min(elapsed, opt.durationSec)) closeSecond();
      $("m-remaining").textContent = mmss(Math.max(0, opt.durationSec - records.length));
      if (records.length >= opt.durationSec) finish(); // 정해진 시간이 되면 자동 종료
    }, 200);

    function finish() {
      clearInterval(timer);
      frameHandler = null;
      measuring = null;
      setAlert(false);
      wakeOff();
      resolve({
        records,
        alertCount: tracker?.count ?? 0,
        startedAt,
        tiltMode: tiltModeOf(tiltSeen),
        resolution: `${video.videoWidth}×${video.videoHeight}`,
        model: MODELS[loadedModel()]?.label ?? "",
      });
    }
    measuring = { finish };
  });
}

/** 측정 동안 기울기 보정을 어떻게 했는지 한 단어로 (CSV 기록용) */
function tiltModeOf(seen) {
  const kinds = Object.keys(seen);
  if (!kinds.length) return settings.tiltOn ? "none" : "off";
  if (kinds.length === 1) return kinds[0] === "waiting" ? "none" : kinds[0];
  return seen.on ? "mixed" : kinds.sort((a, b) => seen[b] - seen[a])[0];
}

// ---------------- 기준 자세 재기 (10초) ----------------

const BASELINE_SEC = 10;
let baselineControl = null; // 실패 화면의 "다시 재기"/"건너뛰기" 버튼이 부를 함수들

/**
 * 똑바로 앉은 자세를 10초 동안 재서 그 중앙값을 돌려준다.
 * 귀·어깨가 잘 안 보여 실패하면 다시 재거나 건너뛸 수 있다.
 * @returns {Promise<number|null>} 기준 자세 목 각도. 건너뛰면 null
 */
function runBaseline() {
  return new Promise((resolve) => {
    let timer = null;
    const begin = () => {
      const angles = [];
      let frames = 0;
      const startMs = Date.now();
      $("b-fail").hidden = true;
      $("b-remaining").textContent = BASELINE_SEC;
      $("b-detect").textContent = "";
      frameHandler = (m) => {
        frames += 1;
        if (m.ok) angles.push(m.angle);
        $("b-detect").textContent = m.ok ? "자세 인식 중" : `측정 불가 — ${m.reason}`;
      };
      timer = setInterval(() => {
        const elapsed = (Date.now() - startMs) / 1000;
        $("b-remaining").textContent = Math.max(0, Math.ceil(BASELINE_SEC - elapsed));
        if (elapsed < BASELINE_SEC) return;
        clearInterval(timer);
        frameHandler = null;
        // 프레임의 절반 이상에서 보였고, 10프레임(약 1초) 이상 모였을 때만 믿는다
        if (angles.length >= 10 && angles.length * 2 >= frames) {
          baselineControl = null;
          resolve(round1(median(angles)));
        } else {
          const seen = frames ? Math.round((angles.length / frames) * 100) : 0;
          $("b-fail-text").textContent = `귀와 어깨가 잘 보이지 않아서(측정 가능 ${seen}%) 기준 자세를 재지 못했어요. 카메라 위치를 확인하고 다시 재 주세요.`;
          $("b-fail").hidden = false;
        }
      }, 200);
    };
    baselineControl = {
      retry: begin,
      skip: () => {
        clearInterval(timer);
        frameHandler = null;
        baselineControl = null;
        resolve(null);
      },
    };
    show("baseline");
    wakeOn();
    begin();
  });
}
$("b-retry").addEventListener("click", () => baselineControl?.retry());
$("b-skip").addEventListener("click", () => baselineControl?.skip());

function setAlert(on) {
  document.body.classList.toggle("alerting", on);
  $("m-alert").hidden = !on;
}

$("m-stop").addEventListener("click", () => {
  if (measuring && window.confirm("측정을 지금 끝낼까요? 지금까지의 기록은 저장돼요.")) measuring?.finish();
});

/** records([t, angle, valid, alert, tilt] 배열)를 summarize가 읽는 모양으로 바꾼다 */
const asObjects = (records) =>
  records.map(([t, angle, valid, alert, tilt]) => ({ t, angle, valid: !!valid, alert: !!alert, tilt: tilt ?? null }));

/** 세션을 목록 맨 앞에 저장한다. @returns {boolean} 브라우저에 저장됐는가 */
function saveSession(session) {
  return store.save("sessions", [session, ...getSessions()]);
}

// ---------------- 측정 세션 ----------------

const MODE_HINT = {
  OFF: "참여자에게 피드백이 가지 않도록 실시간 각도를 보여 주지 않아요. '측정 중' 표시와 남은 시간만 보여요.",
  ON: "기준 각도 이상이 이어지면 화면 테두리 색이 바뀌고 '고개를 들어 보세요'가 떠요. 자세가 돌아오면 사라져요.",
};
function syncModeOptions() {
  const mode = document.querySelector('input[name="s-mode"]:checked').value;
  $("s-on-options").hidden = mode !== "ON";
  $("s-mode-hint").textContent = MODE_HINT[mode];
}
for (const r of document.querySelectorAll('input[name="s-mode"]')) r.addEventListener("change", syncModeOptions);
syncModeOptions();

$("form-session").addEventListener("submit", (e) => {
  e.preventDefault();
  const mode = document.querySelector('input[name="s-mode"]:checked').value;
  const cfg = {
    code: $("s-code").value.trim(),
    condition: $("s-condition").value.trim(),
    mode,
    threshold: numberFrom("s-threshold"),
    holdSec: numberFrom("s-hold"),
    plannedSec: Math.max(1, Math.round(numberFrom("s-minutes") * 60)),
    sound: mode === "ON" && $("s-sound").checked,
    baseline: $("s-baseline").checked,
  };
  openPrep({
    title: "카메라 맞추기",
    instruction: null,
    onStart: () => runSession(cfg),
  });
});

async function runSession(cfg) {
  if (cfg.sound) prepareSound();
  const baseline = cfg.baseline ? await runBaseline() : null;
  const result = await runMeasurement({
    durationSec: cfg.plannedSec,
    threshold: cfg.threshold,
    alertOn: cfg.mode === "ON",
    holdSec: cfg.holdSec,
    sound: cfg.sound,
    label: `${cfg.code} · ${cfg.condition} · 알림 ${cfg.mode}${baseline == null ? "" : " · 기준 자세 저장됨"}`,
  });
  if (!result.records.length) return show("home"); // 1초도 안 돼 끝냈으면 저장하지 않는다

  const session = {
    id: newId(),
    kind: "session",
    startedAt: result.startedAt,
    code: cfg.code,
    condition: cfg.condition,
    mode: cfg.mode,
    threshold: cfg.threshold,
    holdSec: cfg.holdSec,
    plannedSec: cfg.plannedSec,
    ...measureInfo(result),
    summary: summarize(asObjects(result.records), cfg.threshold, result.alertCount, baseline),
    records: result.records,
  };
  const saved = saveSession(session);
  showSummary(session, saved);
}

/** 측정 방법 정보 (CSV에 남겨서 나중에 어떻게 쟀는지 알 수 있게) */
function measureInfo(result) {
  return { tiltMode: result.tiltMode, model: result.model, resolution: result.resolution, secondStat: "median" };
}

/** "+3.2" / "−1.5" 처럼 부호를 붙인다 */
const signed = (v) => (v == null ? "–" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v)}`);

function tile(label, value, unit = "", sub = "") {
  const valueEl = el("div", { class: "value", text: value });
  if (unit) valueEl.append(el("small", { text: unit }));
  return el("div", { class: "tile" }, [
    el("div", { class: "label", text: label }),
    valueEl,
    sub ? el("div", { class: "sub", text: sub }) : null,
  ]);
}

let summarySession = null;
function showSummary(session, saved) {
  summarySession = session;
  const m = session.summary;
  $("sum-title").textContent =
    `${session.code} · ${session.condition} · 알림 ${session.mode} · ${session.startedAt}` +
    (session.tiltMode ? ` · 기울기 보정: ${tiltLabel(session.tiltMode)}` : "");
  $("sum-tiles").replaceChildren(
    tile("평균 목 각도", m.meanAngle ?? "–", m.meanAngle == null ? "" : "°"),
    tile(`기준(${session.threshold}°) 이상 시간`, m.overPct ?? "–", m.overPct == null ? "" : "%"),
    tile("알림 횟수", session.mode === "ON" ? m.alertCount : "–", session.mode === "ON" ? "회" : "(알림 OFF)"),
    tile("전체 측정 시간", mmss(m.totalSec)),
    tile("유효 데이터 비율", m.validPct, "%"),
    m.baseline == null
      ? tile("기준 자세 대비", "–", "", "기준 자세를 재지 않았어요")
      : tile("기준 자세 대비", signed(m.meanDelta), m.meanDelta == null ? "" : "°", `기준 자세 ${m.baseline}°보다 평균 이만큼 더 숙임`),
  );
  const notes = [];
  if (m.validPct < LOW_TRUST_PCT) {
    notes.push(`유효 데이터 비율이 ${LOW_TRUST_PCT}%보다 낮아요. 귀와 어깨가 잘 보이게 카메라 위치를 바꿔 다시 측정하는 것을 권해요.`);
  }
  if (!saved) notes.push("이 브라우저에 기록을 저장하지 못했어요. 지금 CSV를 내려받아 주세요.");
  $("sum-note").textContent = notes.join(" ");
  $("sum-note").hidden = !notes.length;
  show("summary");
}

function downloadSession(s) {
  download(`자세_${fileSafe(s.code, s.condition)}_${stampForFile(s.startedAt)}.csv`, sessionCsv(s));
}
$("sum-csv").addEventListener("click", () => summarySession && downloadSession(summarySession));

// ---------------- 정확도 검증 ----------------

const freeze = $("freeze");

function clearFreeze() {
  // 멈춘 화면(사진)은 메모리에만 있다가 여기서 지워진다
  freeze.width = 0;
  freeze.height = 0;
  freeze.hidden = true;
  $("v-resume").hidden = true;
}

async function openVerify() {
  if (settings.tiltOn) startTilt(); // 버튼을 누른 순간에 불러야 아이폰이 권한을 물을 수 있다
  $("v-tilt").textContent = "";
  $("v-side").hidden = true;
  show("verify");
  renderVerify();
  $("v-shot").disabled = true;
  if (await ensureCamera($("v-status"))) watchVerify();
}

function watchVerify() {
  $("v-shot").disabled = false;
  const status = $("v-status");
  frameHandler = (m, now, t) => {
    status.textContent = m.ok ? "귀와 어깨가 보여요. 버튼을 눌러 재 보세요." : `${m.reason}. 카메라 위치를 조정해 주세요.`;
    status.className = `status ${m.ok ? "ok" : "bad"}`;
    showSetupHints(m, t, $("v-tilt"), $("v-side"));
  };
}

$("v-flip").addEventListener("click", () => {
  resumeVerify();
  $("v-shot").disabled = true;
  flipCamera($("v-status"), watchVerify);
});

$("v-shot").addEventListener("click", () => {
  if (video.readyState < 2 || !video.videoWidth) return;
  loopPaused = true;
  frameHandler = null;
  const w = video.videoWidth;
  const h = video.videoHeight;

  // 1) 지금 장면을 그대로 복사해 둔다 (이 사진으로 각도를 잰다 → 그림과 숫자가 정확히 같은 순간)
  const shot = document.createElement("canvas");
  shot.width = w;
  shot.height = h;
  shot.getContext("2d").drawImage(video, 0, 0, w, h);

  const t = readTilt();
  const tilt = t.status === "on" ? t.tilt : null;
  let m;
  try {
    m = measureNeck(detect(shot), w, h, tilt);
  } catch {
    m = { ok: false, reason: "인식 중 오류가 났어요" };
  }

  // 2) 멈춘 화면에 그린다. 전면 카메라는 미리보기처럼 좌우를 뒤집어 보여 준다(각도는 그대로다).
  const mirror = settings.facing === "user";
  const flipX = (p) => (mirror ? { x: w - p.x, y: p.y } : p);
  const flipDir = (d) => (mirror ? { x: -d.x, y: d.y } : d);
  freeze.width = w;
  freeze.height = h;
  const ctx = freeze.getContext("2d");
  ctx.save();
  if (mirror) {
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(shot, 0, 0);
  ctx.restore();

  const status = $("v-status");
  if (m.ok) {
    const angle = round1(m.angle);
    drawVerifyMarks(ctx, flipX(m.ear), flipX(m.shoulder), flipDir(m.up), angle, w, h);
    const entries = [
      ...getVerify(),
      { id: newId(), time: localStamp(), appAngle: angle, manual: null, cva: null, tilt: round1(tilt) },
    ];
    store.save("verify", entries);
    renderVerify();
    status.textContent = `앱이 잰 각도: ${angle}° — 각도기로 잰 값을 아래 ${entries.length}번 칸에 적어 주세요.`;
    status.className = "status ok";
  } else {
    status.textContent = `측정 불가 — ${m.reason}. '다시 찍기'를 눌러 주세요.`;
    status.className = "status bad";
  }

  stage.hidden = true;
  freeze.hidden = false;
  $("v-resume").hidden = false;
  $("v-shot").disabled = true;
});

/**
 * 멈춘 화면에 귀·어깨 점, 연결선, 수직 기준선, 각도 호, 각도 값을 그린다
 * @param {{x:number,y:number}} upDir 진짜 위쪽 방향 (기울기 보정을 하면 기울어져 있다)
 */
function drawVerifyMarks(ctx, ear, shoulder, upDir, angle, w, h) {
  const s = Math.max(w, h) / 640;
  const len = Math.hypot(ear.x - shoulder.x, ear.y - shoulder.y);
  const reach = Math.max(len * 1.25, 60 * s);

  // 수직 기준선: 어깨에서 진짜 위쪽으로 (흰 점선)
  ctx.lineWidth = 3 * s;
  ctx.setLineDash([10 * s, 7 * s]);
  ctx.strokeStyle = "#ffffff";
  ctx.beginPath();
  ctx.moveTo(shoulder.x, shoulder.y);
  ctx.lineTo(shoulder.x + upDir.x * reach, shoulder.y + upDir.y * reach);
  ctx.stroke();
  ctx.setLineDash([]);

  // 어깨 → 귀 선 (노란 실선, 조금 더 길게 그려 각도기를 대기 쉽게)
  const ux = (ear.x - shoulder.x) / (len || 1);
  const uy = (ear.y - shoulder.y) / (len || 1);
  ctx.strokeStyle = "#ffd400";
  ctx.lineWidth = 4 * s;
  ctx.beginPath();
  ctx.moveTo(shoulder.x, shoulder.y);
  ctx.lineTo(shoulder.x + ux * reach, shoulder.y + uy * reach);
  ctx.stroke();

  // 두 선 사이의 각도 호
  const up = Math.atan2(upDir.y, upDir.x);
  const toEar = Math.atan2(uy, ux);
  // 두 방향 사이의 짧은 쪽으로 호를 그린다
  const turn = Math.atan2(Math.sin(toEar - up), Math.cos(toEar - up));
  ctx.lineWidth = 3 * s;
  ctx.strokeStyle = "#ff5a36";
  ctx.beginPath();
  ctx.arc(shoulder.x, shoulder.y, len * 0.45, up, toEar, turn < 0);
  ctx.stroke();

  drawDot(ctx, ear, 7 * s);
  drawDot(ctx, shoulder, 7 * s);

  // 글자 (검은 바탕에 흰 글씨)
  const label = (text, x, y, size) => {
    ctx.font = `700 ${size}px system-ui, sans-serif`;
    const tw = ctx.measureText(text).width;
    const bx = Math.min(Math.max(x, 4), w - tw - 16 * s);
    ctx.fillStyle = "rgba(0,0,0,0.72)";
    ctx.fillRect(bx, y - size, tw + 12 * s, size * 1.4);
    ctx.fillStyle = "#fff";
    ctx.fillText(text, bx + 6 * s, y);
  };
  label("귀", ear.x + 12 * s, ear.y - 8 * s, 16 * s);
  label("어깨", shoulder.x + 12 * s, shoulder.y + 22 * s, 16 * s);
  label(`앱이 잰 목 각도 ${angle}°`, 8 * s, 34 * s, 24 * s);
}

function resumeVerify() {
  if (freeze.hidden) return;
  clearFreeze();
  stage.hidden = false;
  loopPaused = false;
  if (cameraIsOn()) watchVerify();
}
$("v-resume").addEventListener("click", resumeVerify);

function updateVerifyMae() {
  const entries = getVerify();
  const mae = meanAbsError(entries);
  const filled = entries.filter((e) => e.manual != null).length;
  $("v-mae").textContent =
    mae == null
      ? "각도기로 잰 값을 넣으면 평균 오차가 계산돼요."
      : `평균 오차: ${round1(mae)}° (각도기 값을 넣은 ${filled}개의 |앱 − 각도기| 평균)`;
  renderReference(entries, mae);
}

// 실제 사람 92명의 CVA 데이터 (js/reference.js) — 한 번만 요약해 둔다
const REF = referenceSummary(CVA_SITTING_EVALUATOR1, CVA_SITTING_EVALUATOR2);
const RATER_DIFF = REF.raterDiff.toFixed(1); // 화면에 "1.0"처럼 보이게

/** 검증 기록을 실제 사람 데이터와 비교한 문장들 */
function renderReference(entries, mae) {
  const lines = [];
  const p = (text, cls = "") => lines.push(el("p", { class: cls, text }));

  // 1) 측정 오차 비교: 사람 평가자 두 명이 같은 사진을 재도 생기는 차이
  if (mae == null) {
    p(`참고: 사람 평가자 두 명이 같은 사진을 각도기(프로그램)로 따로 재도 평균 ${RATER_DIFF}° 차이가 났어요. 각도기 값을 넣으면 앱의 오차와 비교해 줘요.`);
  } else {
    const m = round1(mae);
    const verdict =
      m <= REF.raterDiff
        ? "사람 두 명이 서로 다르게 재는 정도와 비슷하거나 작아요."
        : m <= REF.raterDiff * 3
          ? "사람끼리의 차이보다는 크지만, 몇 도 안쪽이에요. 카메라 위치(정확히 옆, 기울지 않게)를 확인해 보세요."
          : "사람끼리의 차이보다 꽤 커요. 카메라가 정확히 옆에 있는지, 귀가 가려지지 않았는지 확인해 보세요.";
    p(`앱의 평균 오차 ${m}° ↔ 사람 평가자 두 명 사이의 평균 차이 ${RATER_DIFF}°. ${verdict}`);
  }

  // 2) CVA를 적었다면 92명 중 어디쯤인지
  const cvas = entries.map((e) => e.cva).filter((v) => v != null && Number.isFinite(v));
  if (cvas.length) {
    const avg = round1(cvas.reduce((s, v) => s + v, 0) / cvas.length);
    const pr = Math.round(percentileRank(REF.values, avg));
    p(`적은 CVA 평균 ${avg}° (${cvas.length}개) → 참고 집단 92명 중 CVA가 이보다 작은(더 거북목인) 사람은 약 ${pr}%예요. 참고 집단 평균은 ${REF.mean}° ± ${REF.sd}°(범위 ${REF.min}~${REF.max}°)이고, 작을수록 거북목이에요.`, "status");
    const below = CVA_CUTOFFS.filter((c) => avg < c);
    const cut = `${CVA_CUTOFFS.join("°·")}°`;
    const share48 = Math.round(shareBelow(REF.values, 48));
    const where =
      below.length === CVA_CUTOFFS.length ? `연구마다 다른 거북목 기준선(${cut}) 모두보다 작아요.`
        : below.length ? `거북목 기준선(${cut}) 중 ${below.join("°·")}°보다 작아요. 어느 기준을 쓰느냐에 따라 판정이 달라지는 구간이에요.`
          : `거북목 기준선(${cut}) 모두보다 커요.`;
    p(`${where} (참고 집단에서 48° 미만은 ${share48}%)`);
  } else {
    p(`참고 집단(성인 92명, 앉은 자세)의 CVA는 평균 ${REF.mean}° ± ${REF.sd}°이고, ${Math.round(shareBelow(REF.values, 48))}%가 48° 미만(거북목 기준 중 하나)이었어요. CVA 칸을 채우면 비교해 줘요.`);
  }
  p("앱의 목 각도와 CVA는 기준점이 달라서 서로 바꿔 계산할 수 없어요. (90 − CVA ≠ 앱 각도)", "hint");
  $("v-reference").replaceChildren(...lines);
  $("v-reference-source").textContent = `참고 데이터: ${REFERENCE_SOURCE}`;
}

function renderVerify() {
  const body = $("v-table").querySelector("tbody");
  const entries = getVerify();
  body.replaceChildren(
    ...entries.map((entry, i) => {
      const errCell = el("td");
      const showErr = () => {
        errCell.textContent = entry.manual == null ? "–" : `${round1(entry.appAngle - entry.manual) > 0 ? "+" : ""}${round1(entry.appAngle - entry.manual)}`;
      };
      showErr();
      const input = el("input", {
        type: "number", inputmode: "decimal", step: "any", min: "0", max: "180",
        "aria-label": `${i + 1}번 각도기로 잰 각도`,
      });
      if (entry.manual != null) input.value = entry.manual;
      input.addEventListener("input", () => {
        const v = input.value === "" ? null : Number(input.value);
        entry.manual = v != null && Number.isFinite(v) ? v : null;
        store.save("verify", entries);
        showErr();
        updateVerifyMae();
      });
      const cvaInput = el("input", {
        type: "number", inputmode: "decimal", step: "any", min: "0", max: "90",
        "aria-label": `${i + 1}번 각도기로 잰 CVA (선택)`,
      });
      if (entry.cva != null) cvaInput.value = entry.cva;
      cvaInput.addEventListener("input", () => {
        const v = cvaInput.value === "" ? null : Number(cvaInput.value);
        entry.cva = v != null && Number.isFinite(v) ? v : null;
        store.save("verify", entries);
        updateVerifyMae();
      });
      const del = el("button", {
        class: "x", type: "button", text: "✕", "aria-label": `${i + 1}번 기록 지우기`,
        onclick: () => {
          store.save("verify", entries.filter((e) => e !== entry));
          renderVerify();
        },
      });
      return el("tr", {}, [
        el("td", { text: i + 1 }),
        el("td", { text: entry.appAngle }),
        el("td", {}, input),
        errCell,
        el("td", {}, cvaInput),
        el("td", {}, del),
      ]);
    }),
  );
  if (!entries.length) {
    body.append(el("tr", {}, el("td", { colspan: "6", text: "아직 기록이 없어요.", style: "text-align:center" })));
  }
  updateVerifyMae();
}

$("v-csv").addEventListener("click", () => {
  download(`자세_정확도검증_${stampForFile(localStamp())}.csv`, verifyCsv(getVerify()));
});
$("v-clear").addEventListener("click", () => {
  if (!getVerify().length || !window.confirm("검증 기록을 모두 지울까요?")) return;
  store.save("verify", []);
  renderVerify();
});

// ---------------- 추천 독서대 각도 찾기 ----------------

let standAngles = [30, 45, 60];

function renderStandAngles() {
  $("t-angles").replaceChildren(
    ...standAngles.map((a) =>
      el("span", { class: "chip" }, [
        `${a}°`,
        el("button", {
          type: "button", text: "✕", "aria-label": `${a}도 빼기`,
          onclick: () => {
            standAngles = standAngles.filter((x) => x !== a);
            renderStandAngles();
          },
        }),
      ]),
    ),
  );
}
renderStandAngles();

function standError(text) {
  $("t-error").textContent = text;
  $("t-error").hidden = !text;
}

function addStandAngle() {
  const v = numberFrom("t-new");
  if ($("t-new").value === "" || Number.isNaN(v) || v < 0 || v > 90) return standError("0~90 사이의 각도를 넣어 주세요.");
  if (standAngles.includes(v)) return standError("이미 있는 각도예요.");
  standAngles = [...standAngles, v].sort((p, q) => p - q);
  $("t-new").value = "";
  standError("");
  renderStandAngles();
}
$("t-add").addEventListener("click", addStandAngle);
$("t-new").addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault(); // 엔터로 폼이 제출되지 않게
    addStandAngle();
  }
});

/** 순서 섞기 (피셔–예이츠 방법: 뒤에서부터 아무 칸과 자리를 바꾼다) */
function shuffled(list) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

$("form-stand").addEventListener("submit", (e) => {
  e.preventDefault();
  if (standAngles.length < 3) return standError("독서대 각도를 3개 이상 넣어 주세요.");
  standError("");
  const doShuffle = $("t-shuffle").checked;
  standRun = {
    code: $("t-code").value.trim(),
    threshold: numberFrom("t-threshold"),
    perSec: Math.max(1, Math.round(numberFrom("t-minutes") * 60)),
    shuffled: doShuffle,
    order: doShuffle ? shuffled(standAngles) : [...standAngles],
    index: 0,
    results: [],
    pending: null,
    wantBaseline: $("t-baseline").checked,
    baseline: undefined, // 첫 측정 전에 한 번 잰다 (null = 건너뜀)
  };
  standStep();
});

/** 지금 순서의 독서대 각도를 안내하고 측정한다 */
function standStep() {
  const run = standRun;
  const angle = run.order[run.index];
  const position = `${run.index + 1}/${run.order.length}`;
  openPrep({
    title: `${position}번째 측정`,
    instruction: `독서대를 ${angle}°로 맞추고 시작을 누르세요`,
    onStart: async () => {
      // 기준 자세는 첫 측정 전에 한 번만 잰다 (같은 학생·같은 카메라 자리이므로 모든 각도에 같이 쓴다)
      if (run.baseline === undefined) run.baseline = run.wantBaseline ? await runBaseline() : null;
      if (standRun !== run) return;
      const result = await runMeasurement({
        durationSec: run.perSec,
        threshold: run.threshold,
        alertOn: false, // 이 모드는 측정만 한다
        label: `${run.code} · 독서대 ${angle}° (${position})`,
      });
      if (standRun !== run) return;
      if (!result.records.length) return standStep();

      const summary = summarize(asObjects(result.records), run.threshold, 0, run.baseline);
      // 1초별 원자료도 "지난 기록"에서 내려받을 수 있게 세션으로 남긴다
      saveSession({
        id: newId(), kind: "stand", startedAt: result.startedAt, code: run.code,
        condition: `독서대 ${angle}도 (추천 모드)`, mode: "OFF", threshold: run.threshold,
        holdSec: null, plannedSec: run.perSec, ...measureInfo(result), summary, records: result.records,
      });
      run.model = result.model;
      run.pending = {
        standAngle: angle, order: run.index + 1, meanAngle: summary.meanAngle,
        overPct: summary.overPct, validPct: summary.validPct, comfort: null,
      };
      showComfort();
    },
  });
}

function showComfort() {
  const p = standRun.pending;
  $("c-title").textContent = `독서대 ${p.standAngle}° 측정 끝`;
  for (const b of $("c-scores").querySelectorAll("button")) b.setAttribute("aria-checked", "false");
  $("c-next").disabled = true;
  $("c-next").textContent = standRun.index + 1 < standRun.order.length ? "다음 각도로" : "결과 보기";
  const low = p.validPct < LOW_TRUST_PCT;
  $("c-lowtrust").textContent = low
    ? `유효 데이터 비율이 ${p.validPct}%로 낮아요(신뢰 낮음). 귀와 어깨가 잘 보이게 카메라를 맞추고 이 각도를 다시 측정하는 것을 권해요.`
    : "";
  $("c-lowtrust").hidden = !low;
  show("stand-comfort");
}

for (const b of $("c-scores").querySelectorAll("button")) {
  b.setAttribute("role", "radio");
  b.setAttribute("aria-checked", "false");
  b.addEventListener("click", () => {
    if (!standRun?.pending) return;
    standRun.pending.comfort = Number(b.dataset.score);
    for (const other of $("c-scores").querySelectorAll("button")) other.setAttribute("aria-checked", String(other === b));
    $("c-next").disabled = false;
  });
}

$("c-redo").addEventListener("click", () => {
  if (!standRun) return;
  standRun.pending = null;
  standStep();
});

$("c-next").addEventListener("click", () => {
  const run = standRun;
  if (!run?.pending || run.pending.comfort == null) return;
  run.results.push(run.pending);
  run.pending = null;
  run.index += 1;
  if (run.index < run.order.length) return standStep();

  // 모든 각도를 다 쟀다 → 추천을 계산하고 저장한다
  const record = {
    id: newId(),
    date: localStamp(),
    code: run.code,
    threshold: run.threshold,
    perSec: run.perSec,
    shuffled: run.shuffled,
    baseline: run.baseline ?? null,
    model: run.model ?? "",
    results: run.results,
    analysis: analyzeStand(run.results, meanAbsError(getVerify())),
  };
  const saved = store.save("stands", [record, ...getStands()]);
  standRun = null;
  showStandResult(record, saved);
});

let shownStand = null;

function showStandResult(run, saved = true) {
  shownStand = run;
  const a = run.analysis;
  $("r-title").textContent =
    `${run.code} · ${run.date} · 기준 각도 ${run.threshold}° · 각도마다 ${mmss(run.perSec)}` +
    (run.baseline == null ? "" : ` · 기준 자세 ${run.baseline}°`);

  $("r-tiles").replaceChildren(
    tile("측정한 각도 중 추천", a.best ? a.best.standAngle : "–", a.best ? "°" : "", a.best ? `평균 목 각도 ${a.best.meanAngle}°` : ""),
    tile("추정 최적 각도", a.fit.x ?? "추정 안 함", a.fit.x == null ? "" : "°", "2차 곡선의 가장 낮은 지점"),
  );

  // 안내 문구들
  const msgs = [];
  const warn = (text) => msgs.push(el("p", { class: "warn", text }));
  const info = (text) => msgs.push(el("p", { class: "info", text }));
  if (!a.best) warn("측정 가능한 데이터가 없어서 추천하지 못했어요. 카메라 위치를 확인하고 다시 측정해 주세요.");
  if (a.fit.status === "below-range") info("2차 곡선의 가장 낮은 지점이 측정한 범위 안에 없어서 최적 각도를 추정하지 않았어요. 더 낮은 각도도 측정해 보세요.");
  if (a.fit.status === "above-range") info("2차 곡선의 가장 낮은 지점이 측정한 범위 안에 없어서 최적 각도를 추정하지 않았어요. 더 높은 각도도 측정해 보세요.");
  if (a.fit.status === "too-few") info("평균 목 각도가 나온 측정이 3개보다 적어서 최적 각도를 추정하지 못했어요.");
  if (a.best && a.second) {
    if (a.verifyError == null) {
      info("정확도 검증 기록(각도기로 잰 값)이 없어서, 각도 사이의 차이가 측정 오차보다 큰지 판단하지 못했어요. '정확도 검증'을 먼저 해 두면 다음 측정부터 비교해 줘요.");
    } else if (a.withinError) {
      warn(`1등(${a.best.standAngle}°)과 2등(${a.second.standAngle}°)의 평균 목 각도 차이는 ${a.gap}°인데, 검증에서 구한 평균 오차는 ${a.verifyError}°예요. 차이가 측정 오차 안이라 어느 쪽이 낫다고 하기 어렵습니다.`);
    } else {
      info(`1등(${a.best.standAngle}°)과 2등(${a.second.standAngle}°)의 평균 목 각도 차이는 ${a.gap}°로, 검증에서 구한 평균 오차(${a.verifyError}°)보다 커요.`);
    }
  }
  if (a.comfortWarning) {
    warn(`목 각도로는 ${a.best.standAngle}°를 추천했지만, 편안함 점수는 ${a.best.comfort}점으로 ${a.comfortWarning.standAngle}°(${a.comfortWarning.comfort}점)보다 2점 이상 낮아요. 편안함도 함께 생각해 보세요.`);
  }
  if (a.lowTrust.length) {
    warn(`${a.lowTrust.map((x) => `${x}°`).join(", ")} 측정은 유효 데이터 비율이 ${LOW_TRUST_PCT}%보다 낮아 '신뢰 낮음'이에요. 다시 측정하는 것을 권해요.`);
  }
  if (!saved) warn("이 브라우저에 결과를 저장하지 못했어요. 지금 CSV를 내려받아 주세요.");
  $("r-messages").replaceChildren(...msgs);

  // 표
  const sorted = [...run.results].sort((p, q) => p.standAngle - q.standAngle);
  $("r-table").querySelector("tbody").replaceChildren(
    ...sorted.map((r) => {
      const first = el("td", { text: r.standAngle });
      if (a.best && r.standAngle === a.best.standAngle) first.append(el("span", { class: "tag best", text: "추천" }));
      const validCell = el("td", { text: r.validPct });
      if (r.validPct < LOW_TRUST_PCT) validCell.append(el("span", { class: "tag", text: "신뢰 낮음" }));
      return el("tr", {}, [
        first,
        el("td", { text: r.order }),
        el("td", { text: r.meanAngle ?? "–" }),
        el("td", { text: r.overPct ?? "–" }),
        el("td", { text: r.comfort ?? "–" }),
        validCell,
      ]);
    }),
  );

  show("stand-result");
  drawStandChart(run);
}

$("r-csv").addEventListener("click", () => {
  if (shownStand) download(`자세_독서대추천_${fileSafe(shownStand.code)}_${stampForFile(shownStand.date)}.csv`, standCsv(shownStand));
});

// ---------------- 그래프 (SVG) ----------------

const SVG_NS = "http://www.w3.org/2000/svg";
function svg(tag, attrs = {}, text) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text != null) node.textContent = text;
  return node;
}

/** 눈금 간격을 1, 2, 5, 10 … 중에서 보기 좋게 고른다 */
function niceStep(span, target = 4) {
  const raw = span / target;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const unit = raw / pow;
  return (unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 5 ? 5 : 10) * pow;
}

function drawStandChart(run) {
  const box = $("r-chart");
  const tip = $("r-tooltip");
  tip.hidden = true;
  const a = run.analysis;
  const pts = run.results.filter((r) => r.meanAngle != null).sort((p, q) => p.standAngle - q.standAngle);
  if (!pts.length) {
    box.replaceChildren(el("p", { class: "hint", text: "그릴 데이터가 없어요." }));
    return;
  }

  const W = 360, H = 250, L = 38, R = 16, T = 34, B = 40;
  const xs = pts.map((p) => p.standAngle);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const padX = Math.max((maxX - minX) * 0.08, 2);
  const coef = a.fit.coef;

  // 곡선은 측정한 범위 안에서만 그린다 (범위 밖은 믿을 수 없으므로)
  const curve = [];
  if (coef && maxX > minX) {
    for (let i = 0; i <= 60; i++) {
      const x = minX + ((maxX - minX) * i) / 60;
      curve.push({ x, y: evalQuadratic(coef, x) });
    }
  }
  const ys = [...pts.map((p) => p.meanAngle), ...curve.map((c) => c.y)];
  let lo = Math.min(...ys), hi = Math.max(...ys);
  if (hi - lo < 4) { lo -= 2; hi += 2; }
  const step = niceStep(hi - lo);
  lo = Math.floor((lo - step * 0.2) / step) * step;
  hi = Math.ceil((hi + step * 0.2) / step) * step;

  const sx = (x) => L + ((x - (minX - padX)) / (maxX - minX + 2 * padX)) * (W - L - R);
  const sy = (y) => T + (1 - (y - lo) / (hi - lo)) * (H - T - B);

  const root = svg("svg", {
    viewBox: `0 0 ${W} ${H}`, role: "img",
    "aria-label": "독서대 각도별 평균 목 각도 그래프. 같은 값이 아래 표에 있습니다.",
  });

  // 가로 눈금선과 세로축 숫자
  for (let y = lo; y <= hi + 1e-9; y += step) {
    root.append(svg("line", { class: "grid", x1: L, x2: W - R, y1: sy(y), y2: sy(y) }));
    root.append(svg("text", { x: L - 6, y: sy(y) + 4, "text-anchor": "end" }, `${round1(y)}`));
  }
  root.append(svg("text", { x: 4, y: 14, class: "title-text" }, "평균 목 각도(°)"));
  // 가로축: 실제로 측정한 독서대 각도에 눈금
  for (const x of xs) root.append(svg("text", { x: sx(x), y: H - B + 16, "text-anchor": "middle" }, `${x}°`));
  root.append(svg("text", { x: (L + W - R) / 2, y: H - 6, "text-anchor": "middle", class: "title-text" }, "독서대 각도(°)"));

  // 2차 곡선
  if (curve.length) {
    const d = curve.map((c, i) => `${i ? "L" : "M"}${sx(c.x).toFixed(1)},${sy(c.y).toFixed(1)}`).join(" ");
    root.append(svg("path", { class: "curve", d }));
  }

  // 추정 최적 각도: 세로 점선 + 마름모
  if (a.fit.status === "ok") {
    const ox = sx(a.fit.x), oy = sy(a.fit.y);
    root.append(svg("line", { class: "opt-line", x1: ox, x2: ox, y1: T - 6, y2: H - B }));
    root.append(svg("path", { class: "opt", d: `M${ox},${oy - 7} L${ox + 7},${oy} L${ox},${oy + 7} L${ox - 7},${oy} Z` }));
    const leftHalf = ox < (L + W - R) / 2;
    root.append(svg("text", {
      x: ox + (leftHalf ? 6 : -6), y: T - 10, "text-anchor": leftHalf ? "start" : "end", class: "title-text",
    }, `추정 최적 ${a.fit.x}°`));
  }

  // 측정한 점
  const card = box.closest(".chart-card");
  for (const p of pts) {
    const cx = sx(p.standAngle), cy = sy(p.meanAngle);
    const isBest = a.best && p.standAngle === a.best.standAngle;
    const low = p.validPct < LOW_TRUST_PCT;
    root.append(svg("circle", { class: `pt${low ? " low" : ""}${isBest ? " best" : ""}`, cx, cy, r: isBest ? 7 : 6 }));
    if (isBest) {
      // 추정 최적 마름모와 글자가 겹치지 않게 반대쪽 옆에 적는다
      const right = a.fit.status === "ok" ? a.fit.x <= p.standAngle : cx < W / 2;
      const fits = right ? cx + 40 < W : cx - 40 > L;
      const side = fits ? right : !right;
      root.append(svg("text", { x: cx + (side ? 12 : -12), y: cy - 9, "text-anchor": side ? "start" : "end", class: "title-text" }, "추천"));
    }
    // 손가락으로 누르기 쉽게 점보다 큰 투명한 원을 겹쳐 둔다
    const hit = svg("circle", { class: "hit", cx, cy, r: 20, tabindex: "0" });
    const text = `독서대 ${p.standAngle}° · 평균 목 각도 ${p.meanAngle}° · 편안함 ${p.comfort ?? "–"}점 · 유효 ${p.validPct}%${low ? " (신뢰 낮음)" : ""}`;
    hit.append(svg("title", {}, text));
    const showTip = () => {
      const c = card.getBoundingClientRect();
      const h = hit.getBoundingClientRect();
      tip.textContent = text;
      tip.hidden = false;
      const half = tip.offsetWidth / 2;
      const x = Math.min(Math.max(h.left + h.width / 2 - c.left, half + 4), c.width - half - 4);
      tip.style.left = `${x}px`;
      tip.style.top = `${h.top - c.top + 8}px`;
    };
    hit.addEventListener("pointerenter", showTip);
    hit.addEventListener("focus", showTip);
    hit.addEventListener("click", showTip);
    hit.addEventListener("pointerleave", () => { tip.hidden = true; });
    hit.addEventListener("blur", () => { tip.hidden = true; });
    root.append(hit);
  }

  // 범례
  const legend = el("div", { class: "legend" });
  const item = (shape, text) => {
    const icon = svg("svg", { viewBox: "0 0 22 12", "aria-hidden": "true" });
    icon.append(shape);
    legend.append(el("span", {}, [icon, text]));
  };
  item(svg("circle", { class: "pt", cx: 11, cy: 6, r: 4.5 }), "측정한 평균 목 각도");
  if (pts.some((p) => p.validPct < LOW_TRUST_PCT)) item(svg("circle", { class: "pt low", cx: 11, cy: 6, r: 4.5 }), "신뢰 낮음");
  if (curve.length) item(svg("path", { class: "curve", d: "M1,6 L21,6" }), "2차 곡선");
  if (a.fit.status === "ok") item(svg("path", { class: "opt", d: "M11,1 L16,6 L11,11 L6,6 Z" }), "추정 최적 각도");

  box.replaceChildren(root, legend);
}

// ---------------- 지난 기록 ----------------

function openHistory() {
  show("history");
  const sessions = getSessions();
  $("h-sessions").replaceChildren(
    ...sessions.map((s) =>
      el("li", {}, [
        el("div", { text: `${s.code} · ${s.condition} · 알림 ${s.mode}` }),
        el("div", {
          class: "meta",
          text: `${s.startedAt} · ${mmss(s.summary.totalSec)} · 평균 ${deg(s.summary.meanAngle)} · 유효 ${pct(s.summary.validPct)}`,
        }),
        el("div", { class: "row" }, [
          el("button", { class: "btn small", type: "button", text: "CSV", onclick: () => downloadSession(s) }),
          el("button", {
            class: "btn small danger", type: "button", text: "지우기",
            onclick: () => {
              if (!window.confirm("이 기록을 지울까요?")) return;
              store.save("sessions", getSessions().filter((x) => x.id !== s.id));
              openHistory();
            },
          }),
        ]),
      ]),
    ),
  );
  if (!sessions.length) $("h-sessions").append(el("li", { class: "empty", text: "아직 측정한 세션이 없어요." }));

  const stands = getStands();
  $("h-stands").replaceChildren(
    ...stands.map((r) =>
      el("li", {}, [
        el("div", { text: `${r.code} · ${[...r.results].map((x) => x.standAngle).sort((p, q) => p - q).map((x) => `${x}°`).join(", ")}` }),
        el("div", {
          class: "meta",
          text: `${r.date} · 추천 ${deg(r.analysis.best?.standAngle ?? null)} · 추정 최적 ${r.analysis.fit.x == null ? "없음" : `${r.analysis.fit.x}°`}`,
        }),
        el("div", { class: "row" }, [
          el("button", { class: "btn small", type: "button", text: "결과 보기", onclick: () => showStandResult(r) }),
          el("button", {
            class: "btn small", type: "button", text: "CSV",
            onclick: () => download(`자세_독서대추천_${fileSafe(r.code)}_${stampForFile(r.date)}.csv`, standCsv(r)),
          }),
          el("button", {
            class: "btn small danger", type: "button", text: "지우기",
            onclick: () => {
              if (!window.confirm("이 결과를 지울까요?")) return;
              store.save("stands", getStands().filter((x) => x.id !== r.id));
              openHistory();
            },
          }),
        ]),
      ]),
    ),
  );
  if (!stands.length) $("h-stands").append(el("li", { class: "empty", text: "아직 추천 결과가 없어요." }));
}

$("h-summary-csv").addEventListener("click", () => {
  const sessions = getSessions();
  if (!sessions.length) return window.alert("아직 측정한 세션이 없어요.");
  download(`자세_세션요약_${stampForFile(localStamp())}.csv`, sessionsSummaryCsv([...sessions].reverse()));
});
$("h-clear").addEventListener("click", () => {
  if (!window.confirm("측정 세션과 독서대 추천 결과를 모두 지울까요? (되돌릴 수 없어요)")) return;
  store.save("sessions", []);
  store.save("stands", []);
  openHistory();
});

// ---------------- 시작 ----------------

show("home");
$("storage-warning").hidden = store.isPersistent();
