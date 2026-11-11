// ============================================================
// tilt.js — 폰 기울기 센서로 카메라 기울기 알아내기
// ============================================================
//
// [원리]
//   폰 안의 가속도 센서는 가만히 있을 때 "중력의 반대 방향(진짜 위쪽)"을 가리키는 값을 준다.
//   (브라우저의 devicemotion 이벤트 → accelerationIncludingGravity의 x, y, z)
//     x: 폰 화면의 오른쪽 방향, y: 폰 화면의 위쪽 방향, z: 화면에서 나오는 방향
//   폰을 똑바로 세우면 위쪽 값이 y에만 있다(x = 0). 폰을 옆으로 기울이면 x에도 값이 생긴다.
//   그래서 기울기 = atan2(x, y) 로 구할 수 있다. (목 각도 계산과 같은 atan2 원리)
//
// [주의할 것 3가지]
//   1) 폰을 가로로 돌리면 화면도 돌아간다 → screen.orientation.angle 만큼 벡터를 돌려서
//      "화면 기준" 방향으로 바꾼다. (카메라 영상도 화면 방향에 맞춰 돌아서 나오기 때문)
//   2) 전면 카메라의 원본 영상은 좌우가 뒤집혀 있다 → 가로 방향(x)의 부호를 바꾼다.
//   3) 일부 기기(예전 아이폰 등)는 값의 부호를 반대로 준다 → 위쪽이 사진 아래로 나오면
//      부호가 뒤집힌 것으로 보고 되돌린다. (폰을 거꾸로 세워 찍지는 않는다고 가정)

/** 폰이 이보다 더 눕혀지면(세운 상태에서 60° 넘게 뒤로 젖힘) 기울기를 믿지 않는다 */
const MIN_UPRIGHT = 0.5; // 세로 성분이 중력의 50% 이상이어야 함 (cos 60° = 0.5)

/** 이보다 많이 기울면 "카메라를 똑바로 세워 주세요" 경고 */
export const TILT_WARN_DEG = 10;

/**
 * 센서 값으로 사진 안에서의 카메라 기울기(도)를 구한다. (순수 계산 — 테스트 가능)
 * @param {number} ax 센서 x (폰 화면 오른쪽 방향)
 * @param {number} ay 센서 y (폰 화면 위쪽 방향)
 * @param {number} az 센서 z (화면에서 나오는 방향)
 * @param {number} screenAngle 화면 회전 각도 (0, 90, 180, 270) = screen.orientation.angle
 * @param {"user"|"environment"} facing 전면 / 후면 카메라
 * @returns {{tilt:number} | {flat:true}} tilt > 0 이면 진짜 위쪽이 사진에서 오른쪽으로 기울어 보인다
 */
export function tiltFromGravity(ax, ay, az, screenAngle, facing) {
  const g = Math.hypot(ax, ay, az);
  const inPlane = Math.hypot(ax, ay); // 화면과 나란한 방향의 크기
  if (!(g > 0) || inPlane < MIN_UPRIGHT * g) return { flat: true };

  // 1) 폰 기준 → 화면 기준으로 돌리기 (화면이 돌아간 만큼)
  const a = (screenAngle * Math.PI) / 180;
  const sx = ax * Math.cos(a) - ay * Math.sin(a); // 화면 오른쪽 방향 성분
  const sUp = ax * Math.sin(a) + ay * Math.cos(a); // 화면 위쪽 방향 성분

  // 사진 좌표(y는 아래로 커짐)로 바꾼다
  let ix = sx;
  let iy = -sUp;
  // 2) 전면 카메라 원본 영상은 좌우가 뒤집혀 있다
  if (facing === "user") ix = -ix;
  // 3) 위쪽이 사진 아래로 나오면 부호가 반대인 기기 → 되돌린다
  if (iy > 0) {
    ix = -ix;
    iy = -iy;
  }
  // 사진의 바로 위쪽(0, −1)에서 시계 방향으로 몇 도 돌았나
  return { tilt: (Math.atan2(ix, -iy) * 180) / Math.PI };
}

// ---------------- 센서 읽기 (브라우저) ----------------

let state = "off"; // off → waiting → on / none(센서 없음) / denied(권한 거절)
let gravity = null; // 부드럽게 만든 센서 값 {x, y, z}
let listening = false;
let waitTimer = null;

function onMotion(e) {
  const g = e.accelerationIncludingGravity;
  if (!g || g.x == null || g.y == null || g.z == null) return;
  // 손떨림·진동을 줄이려고 새 값은 20%만 반영한다 (저역 통과 필터)
  gravity = gravity
    ? { x: gravity.x * 0.8 + g.x * 0.2, y: gravity.y * 0.8 + g.y * 0.2, z: gravity.z * 0.8 + g.z * 0.2 }
    : { x: g.x, y: g.y, z: g.z };
  if (state !== "on") {
    state = "on";
    clearTimeout(waitTimer);
  }
}

function listen() {
  if (listening) return;
  listening = true;
  state = "waiting";
  window.addEventListener("devicemotion", onMotion);
  // 1.5초 안에 값이 안 오면 센서가 없는 기기(노트북 등)로 본다. 나중에 값이 오면 다시 "on"이 된다
  waitTimer = setTimeout(() => {
    if (state === "waiting") state = "none";
  }, 1500);
}

/**
 * 센서 읽기를 시작한다. 아이폰은 버튼을 누른 순간에만 권한을 물을 수 있으므로,
 * 반드시 버튼 클릭 처리 안에서 (await 전에) 부른다.
 */
export function startTilt() {
  if (listening || state === "denied") return;
  if (typeof window.DeviceMotionEvent === "undefined") {
    state = "none";
    return;
  }
  const ask = window.DeviceMotionEvent.requestPermission;
  if (typeof ask === "function") {
    ask.call(window.DeviceMotionEvent)
      .then((answer) => (answer === "granted" ? listen() : (state = "denied")))
      .catch(() => (state = "denied"));
  } else {
    listen();
  }
}

function screenAngle() {
  const a = window.screen?.orientation?.angle ?? window.orientation ?? 0;
  return ((Number(a) % 360) + 360) % 360;
}

/**
 * 지금 카메라 기울기.
 * @returns {{status:"on", tilt:number} | {status:"flat"|"waiting"|"none"|"denied"|"off"}}
 */
export function currentTilt(facing) {
  if (state !== "on" || !gravity) return { status: state === "on" ? "waiting" : state };
  const r = tiltFromGravity(gravity.x, gravity.y, gravity.z, screenAngle(), facing);
  return r.flat ? { status: "flat" } : { status: "on", tilt: r.tilt };
}

/** 화면에 보여 줄 기울기 상태 문장 */
export function tiltMessage(t, enabled) {
  if (!enabled) return { text: "기울기 보정 꺼짐 — 카메라를 수평으로 세워 주세요.", warn: false };
  switch (t.status) {
    case "on": {
      const d = Math.abs(t.tilt).toFixed(1); // 화면에 보이는 값과 경고 기준을 같은 값으로 비교한다
      return Number(d) > TILT_WARN_DEG
        ? { text: `카메라가 ${d}° 기울었어요. 자동으로 보정하지만, 똑바로 세우면 더 정확해요.`, warn: true }
        : { text: `카메라 기울기 ${d}° — 자동 보정 중`, warn: false };
    }
    case "flat":
      return { text: "폰이 너무 눕혀져 있어요. 폰을 세워 주세요. (지금은 기울기 보정을 하지 않아요)", warn: true };
    case "denied":
      return { text: "기울기 센서 권한이 없어 보정하지 않아요. 카메라를 수평으로 세워 주세요.", warn: true };
    case "none":
      return { text: "기울기 센서가 없는 기기예요(노트북 등). 카메라를 수평으로 맞춰 주세요.", warn: false };
    default:
      return { text: "기울기 센서 확인 중…", warn: false };
  }
}
