// ============================================================
// angle.js — 목 각도 계산 (이 앱에서 가장 중요한 파일)
// ============================================================
//
// [목 각도의 정의]
//   옆모습에서 "어깨 → 귀"로 그은 선이 "똑바로 위쪽(수직선)"과 이루는 각도.
//
//            위(수직선)
//              |      ● 귀
//              |     /
//              |    /
//              | θ /        θ = 목 각도
//              |  /
//              | /
//              ● 어깨
//
//   - 귀가 어깨 바로 위에 있으면 0°
//   - 고개를 앞으로 숙일수록 귀가 앞으로 나가므로 각도가 커진다
//   - 귀가 어깨와 같은 높이까지 내려오면 90°
//
// [계산 원리]
//   어깨에서 귀로 가는 벡터를 (가로 이동, 세로 이동)으로 나눈다.
//     가로 = 귀x - 어깨x
//     위로 = 어깨y - 귀y   ← 주의! 사진 좌표는 y가 "아래로" 갈수록 커진다.
//                            그래서 "위로 얼마나 갔는지"는 (어깨y - 귀y)로 뒤집어 구한다.
//   직각삼각형에서  tan θ = 가로 / 위로  이므로
//     θ = atan2(|가로|, 위로)
//   atan2는 "위로"가 0이거나 음수(귀가 어깨보다 아래)여도 0°~180° 사이 값을 준다.
//   가로에 절댓값을 씌우는 이유: 왼쪽을 보고 앉든 오른쪽을 보고 앉든 같은 값이 나오게 하려고.

/** MediaPipe Pose가 정한 랜드마크 번호 */
export const LM = {
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
};

/** 귀·어깨가 이 값보다 덜 보이면(visibility) "측정 불가"로 본다 */
export const MIN_VISIBILITY = 0.5;

/**
 * 목 각도(도)를 구한다.
 * @param {{x:number, y:number}} ear      귀의 위치 (픽셀 좌표, y는 아래로 갈수록 큼)
 * @param {{x:number, y:number}} shoulder 어깨의 위치 (픽셀 좌표)
 * @returns {number} 0 ~ 180 사이의 각도. 0 = 귀가 어깨 바로 위.
 */
export function neckAngleDeg(ear, shoulder) {
  const sideways = Math.abs(ear.x - shoulder.x); // 가로로 벗어난 거리
  const upward = shoulder.y - ear.y;             // 위로 올라간 거리 (y축 뒤집기)
  const radians = Math.atan2(sideways, upward);  // 수직선과 이루는 각 (라디안)
  return (radians * 180) / Math.PI;              // 라디안 → 도
}

/**
 * 카메라 쪽에 보이는 면(왼쪽/오른쪽)을 고른다.
 * 옆에서 찍으면 한쪽 귀·어깨만 잘 보이므로, 귀와 어깨의 visibility 합이 더 큰 쪽을 쓴다.
 * @param {Array<{x:number,y:number,visibility?:number}>} landmarks 랜드마크 33개
 */
export function pickSide(landmarks) {
  const vis = (i) => landmarks[i]?.visibility ?? 0;
  const left = vis(LM.LEFT_EAR) + vis(LM.LEFT_SHOULDER);
  const right = vis(LM.RIGHT_EAR) + vis(LM.RIGHT_SHOULDER);
  return left >= right
    ? { side: "left", ear: landmarks[LM.LEFT_EAR], shoulder: landmarks[LM.LEFT_SHOULDER] }
    : { side: "right", ear: landmarks[LM.RIGHT_EAR], shoulder: landmarks[LM.RIGHT_SHOULDER] };
}

/**
 * 한 장의 프레임에서 목 각도를 잰다.
 *
 * MediaPipe는 좌표를 0~1 비율로 준다(x는 가로 길이, y는 세로 길이에 대한 비율).
 * 화면이 정사각형이 아니면 x 1칸과 y 1칸의 실제 길이가 달라서 각도가 틀어진다.
 * 그래서 각도를 구하기 전에 반드시 픽셀 단위로 바꾼다 (x × 가로, y × 세로).
 *
 * @param {Array|null|undefined} landmarks 랜드마크 33개 (사람을 못 찾았으면 null)
 * @param {number} width  영상 가로 픽셀
 * @param {number} height 영상 세로 픽셀
 * @returns {{ok:false, reason:string} | {ok:true, angle:number, side:string,
 *            ear:{x:number,y:number}, shoulder:{x:number,y:number}}}
 */
export function measureNeck(landmarks, width, height) {
  if (!landmarks || landmarks.length < 13) return { ok: false, reason: "사람이 보이지 않아요" };
  const { side, ear, shoulder } = pickSide(landmarks);
  if (!ear || !shoulder) return { ok: false, reason: "사람이 보이지 않아요" };
  if ((ear.visibility ?? 0) < MIN_VISIBILITY) return { ok: false, reason: "귀가 잘 보이지 않아요" };
  if ((shoulder.visibility ?? 0) < MIN_VISIBILITY) return { ok: false, reason: "어깨가 잘 보이지 않아요" };

  const earPx = { x: ear.x * width, y: ear.y * height };
  const shoulderPx = { x: shoulder.x * width, y: shoulder.y * height };
  return { ok: true, angle: neckAngleDeg(earPx, shoulderPx), side, ear: earPx, shoulder: shoulderPx };
}

/**
 * 이동평균: 최근 windowMs(기본 1초) 동안 들어온 값들의 평균.
 * 한 프레임 한 프레임의 값은 조금씩 떨리기 때문에, 화면에 보여 주거나
 * 알림을 판단할 때는 최근 1초 평균을 써서 부드럽게 만든다.
 */
export class MovingAverage {
  constructor(windowMs = 1000) {
    this.windowMs = windowMs;
    this.items = []; // {t: 시각(ms), v: 값}
  }
  /** 새 값을 넣는다 */
  add(t, v) {
    this.items.push({ t, v });
    this.trim(t);
  }
  /** now 기준으로 windowMs보다 오래된 값은 버린다 */
  trim(now) {
    while (this.items.length && now - this.items[0].t > this.windowMs) this.items.shift();
  }
  /** 최근 값들의 평균. 값이 하나도 없으면 null */
  value(now) {
    this.trim(now);
    if (!this.items.length) return null;
    let sum = 0;
    for (const it of this.items) sum += it.v;
    return sum / this.items.length;
  }
  clear() {
    this.items = [];
  }
}
