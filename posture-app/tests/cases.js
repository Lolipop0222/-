// ============================================================
// 테스트 모음 — 답을 이미 아는 값으로 계산 함수가 맞는지 확인한다.
// 실행: (1) 컴퓨터에 Node.js가 있으면  node tests/run-tests.mjs
//       (2) 브라우저에서 tests/tests.html 열기
// ============================================================

import { neckAngleDeg, measureNeck, pickSide, MovingAverage } from "../js/angle.js";
import { fitQuadratic, quadraticMinimum, estimateBestAngle, evalQuadratic } from "../js/quadfit.js";
import { summarize, AlertTracker, analyzeStand, meanAbsError, toCsv, sessionCsv, standCsv } from "../js/stats.js";

/** 두 수가 거의 같은지 (컴퓨터 계산의 아주 작은 오차는 봐준다) */
function near(actual, expected, tolerance = 1e-6, what = "값") {
  if (!(Math.abs(actual - expected) <= tolerance)) {
    throw new Error(`${what}: ${expected}이어야 하는데 ${actual}이 나왔어요`);
  }
}
function same(actual, expected, what = "값") {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${what}: ${JSON.stringify(expected)}이어야 하는데 ${JSON.stringify(actual)}이 나왔어요`);
  }
}

/** 랜드마크 33개를 만든다. 지정한 번호만 값을 넣고 나머지는 안 보이는 것으로 둔다 */
function landmarks(spec) {
  const list = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0 }));
  for (const [index, value] of Object.entries(spec)) list[index] = value;
  return list;
}

export const cases = [
  // ---------- 목 각도 ----------
  ["목 각도: 귀가 어깨 바로 위면 0°", () => {
    near(neckAngleDeg({ x: 100, y: 50 }, { x: 100, y: 150 }), 0);
  }],
  ["목 각도: 귀가 오른쪽 위 45° 방향이면 45°", () => {
    near(neckAngleDeg({ x: 200, y: 50 }, { x: 100, y: 150 }), 45);
  }],
  ["목 각도: 왼쪽을 보고 앉아도(귀가 왼쪽 위 45°) 45°", () => {
    near(neckAngleDeg({ x: 0, y: 50 }, { x: 100, y: 150 }), 45);
  }],
  ["목 각도: 가로 1, 세로 √3 이면 30°", () => {
    near(neckAngleDeg({ x: 101, y: 150 - Math.sqrt(3) }, { x: 100, y: 150 }), 30);
  }],
  ["목 각도: 귀가 어깨와 같은 높이면 90°", () => {
    near(neckAngleDeg({ x: 200, y: 150 }, { x: 100, y: 150 }), 90);
  }],
  ["목 각도: 귀가 어깨보다 아래 45°면 135° (y축이 아래로 커지는 것 확인)", () => {
    near(neckAngleDeg({ x: 200, y: 250 }, { x: 100, y: 150 }), 135);
  }],
  ["프레임 측정: 0~1 비율 좌표를 픽셀로 바꿔서 계산한다 (640×480 화면)", () => {
    // 가로 0.1 × 640 = 64픽셀, 세로 (64/480) × 480 = 64픽셀 → 45°
    const lm = landmarks({
      7: { x: 0.6, y: 0.5 - 64 / 480, visibility: 0.9 },
      11: { x: 0.5, y: 0.5, visibility: 0.9 },
    });
    const m = measureNeck(lm, 640, 480);
    same(m.ok, true, "측정 가능");
    near(m.angle, 45, 1e-6, "각도");
    same(m.side, "left", "고른 쪽");
  }],
  ["프레임 측정: 더 잘 보이는 쪽(오른쪽)을 고른다", () => {
    const lm = landmarks({
      7: { x: 0.1, y: 0.1, visibility: 0.2 },
      11: { x: 0.1, y: 0.4, visibility: 0.3 },
      8: { x: 0.5, y: 0.2, visibility: 0.95 },
      12: { x: 0.5, y: 0.6, visibility: 0.9 },
    });
    same(pickSide(lm).side, "right", "고른 쪽");
    near(measureNeck(lm, 640, 480).angle, 0, 1e-6, "각도");
  }],
  ["프레임 측정: 귀 visibility가 0.5 미만이면 측정 불가", () => {
    const lm = landmarks({
      7: { x: 0.6, y: 0.3, visibility: 0.49 },
      11: { x: 0.5, y: 0.5, visibility: 0.99 },
    });
    same(measureNeck(lm, 640, 480).ok, false);
  }],
  ["프레임 측정: 어깨 visibility가 0.5 미만이면 측정 불가", () => {
    const lm = landmarks({
      7: { x: 0.6, y: 0.3, visibility: 0.99 },
      11: { x: 0.5, y: 0.5, visibility: 0.3 },
    });
    same(measureNeck(lm, 640, 480).ok, false);
  }],
  ["프레임 측정: 사람이 없으면 측정 불가", () => {
    same(measureNeck(null, 640, 480).ok, false);
  }],
  ["이동평균: 최근 1초 값만 평균한다", () => {
    const avg = new MovingAverage(1000);
    same(avg.value(0), null, "처음");
    avg.add(0, 10);
    avg.add(500, 20);
    near(avg.value(500), 15, 1e-9, "두 값 평균");
    avg.add(1200, 40); // 0ms의 값(10)은 1초가 지나 빠진다
    near(avg.value(1200), 30, 1e-9, "오래된 값 제외");
    same(avg.value(5000), null, "모두 오래됨");
  }],

  // ---------- 2차 곡선 ----------
  ["2차 곡선: 30°→25, 45°→15, 60°→25 이면 최저점은 45°", () => {
    const best = estimateBestAngle([{ x: 30, y: 25 }, { x: 45, y: 15 }, { x: 60, y: 25 }]);
    same(best.status, "ok", "상태");
    near(best.x, 45, 1e-6, "최저점 위치");
    near(best.y, 15, 1e-6, "최저점 높이");
  }],
  ["2차 곡선: y = 2x² − 3x + 1 위의 점을 주면 계수 2, −3, 1을 찾는다", () => {
    const f = (x) => 2 * x * x - 3 * x + 1;
    const coef = fitQuadratic([-1, 0, 1, 2, 5].map((x) => ({ x, y: f(x) })));
    near(coef.a, 2, 1e-8, "a");
    near(coef.b, -3, 1e-8, "b");
    near(coef.c, 1, 1e-8, "c");
    near(quadraticMinimum(coef).x, 0.75, 1e-8, "꼭짓점");
  }],
  ["2차 곡선: 점이 곡선에서 조금씩 벗어나도(4개) 최저점 근처를 찾는다", () => {
    // y = 0.04(x−50)² + 12 에 ±0.5의 흔들림
    const pts = [[30, 28.5], [40, 15.5], [50, 12.5], [60, 15.5]].map(([x, y]) => ({ x, y }));
    const best = estimateBestAngle(pts);
    same(best.status, "ok", "상태");
    near(best.x, 50, 2, "최저점 위치");
    // 최소제곱: 곡선이 점들의 한가운데를 지나므로 오차의 합이 0에 가깝다
    const sum = pts.reduce((s, p) => s + (p.y - evalQuadratic(best.coef, p.x)), 0);
    near(sum, 0, 1e-6, "오차의 합");
  }],
  ["2차 곡선: 최저점이 측정 범위보다 아래면 추정하지 않고 '더 낮은 각도'", () => {
    same(estimateBestAngle([{ x: 30, y: 10 }, { x: 45, y: 15 }, { x: 60, y: 25 }]).status, "below-range");
  }],
  ["2차 곡선: 최저점이 측정 범위보다 위면 추정하지 않고 '더 높은 각도'", () => {
    same(estimateBestAngle([{ x: 30, y: 25 }, { x: 45, y: 15 }, { x: 60, y: 10 }]).status, "above-range");
  }],
  ["2차 곡선: ∩ 모양이면 최저점이 없다 → 더 낮은 쪽 끝 방향을 안내", () => {
    same(quadraticMinimum({ a: -1, b: 0, c: 0 }), null, "최저점");
    same(estimateBestAngle([{ x: 30, y: 10 }, { x: 45, y: 20 }, { x: 60, y: 15 }]).status, "below-range");
    same(estimateBestAngle([{ x: 30, y: 15 }, { x: 45, y: 20 }, { x: 60, y: 10 }]).status, "above-range");
  }],
  ["2차 곡선: 점이 3개보다 적으면 맞추지 않는다", () => {
    same(fitQuadratic([{ x: 30, y: 10 }, { x: 45, y: 20 }]), null);
    same(estimateBestAngle([{ x: 30, y: 10 }, { x: 45, y: 20 }]).status, "too-few");
  }],

  // ---------- 요약 통계 ----------
  ["요약: 평균, 기준 이상 비율, 유효 비율 (측정 불가는 뺀다)", () => {
    const records = [
      { t: 1, angle: 10, valid: true, alert: false },
      { t: 2, angle: 20, valid: true, alert: false },
      { t: 3, angle: null, valid: false, alert: false },
      { t: 4, angle: 30, valid: true, alert: true },
      { t: 5, angle: 40, valid: true, alert: true },
    ];
    const s = summarize(records, 20, 1);
    same(s.totalSec, 5, "전체 시간");
    near(s.meanAngle, 25, 1e-9, "평균");
    near(s.overPct, 75, 1e-9, "기준 이상 비율"); // 20, 30, 40 → 4개 중 3개
    near(s.validPct, 80, 1e-9, "유효 비율");
    same(s.alertCount, 1, "알림 횟수");
  }],
  ["요약: 측정 가능한 초가 없으면 평균은 없음(null)", () => {
    const s = summarize([{ t: 1, angle: null, valid: false, alert: false }], 20, 0);
    same(s.meanAngle, null);
    same(s.overPct, null);
    same(s.validPct, 0);
  }],
  ["알림: 기준 이상이 5초 이어져야 켜지고, 돌아오면 꺼진다", () => {
    const tr = new AlertTracker(20, 5);
    same(tr.update(0, 25), false, "0초");
    same(tr.update(4900, 25), false, "4.9초");
    same(tr.update(5000, 25), true, "5초");
    same(tr.update(6000, 30), true, "6초");
    same(tr.count, 1, "횟수");
    same(tr.update(7000, 15), false, "자세가 돌아옴");
    same(tr.update(8000, 25), false, "다시 숙임 — 처음부터 다시 센다");
    same(tr.update(13000, 25), true, "다시 5초");
    same(tr.count, 2, "횟수");
  }],
  ["알림: 중간에 기준 아래로 내려가거나 측정 불가가 되면 처음부터 다시 센다", () => {
    const tr = new AlertTracker(20, 5);
    tr.update(0, 25);
    tr.update(3000, 19);
    same(tr.update(6000, 25), false, "끊겼으므로 아직");
    tr.update(8000, null);
    same(tr.update(12000, 25), false, "측정 불가로 끊김");
    same(tr.count, 0, "횟수");
  }],

  // ---------- 독서대 추천 판단 ----------
  ["추천: 평균 목 각도가 가장 작은 각도 + 추정 최적 각도", () => {
    const a = analyzeStand([
      { standAngle: 30, order: 2, meanAngle: 25, overPct: 80, validPct: 95, comfort: 3 },
      { standAngle: 45, order: 1, meanAngle: 15, overPct: 20, validPct: 95, comfort: 4 },
      { standAngle: 60, order: 3, meanAngle: 25, overPct: 70, validPct: 95, comfort: 3 },
    ], null);
    same(a.best.standAngle, 45, "추천");
    same(a.fit.status, "ok", "추정 상태");
    near(a.fit.x, 45, 0.05, "추정 최적");
    same(a.verifyError, null, "검증 기록 없음");
    same(a.withinError, false, "오차 판단");
    same(a.comfortWarning, null, "편안함 경고");
    same(a.lowTrust, [], "신뢰 낮음");
  }],
  ["추천: 1등과 2등 차이가 검증 오차보다 작으면 표시한다", () => {
    const rows = [
      { standAngle: 30, order: 1, meanAngle: 16, overPct: 0, validPct: 95, comfort: 3 },
      { standAngle: 45, order: 2, meanAngle: 15, overPct: 0, validPct: 95, comfort: 3 },
      { standAngle: 60, order: 3, meanAngle: 25, overPct: 0, validPct: 95, comfort: 3 },
    ];
    same(analyzeStand(rows, 2.5).withinError, true, "오차 2.5°");
    same(analyzeStand(rows, 0.5).withinError, false, "오차 0.5°");
  }],
  ["추천: 추천 각도의 편안함이 다른 각도보다 2점 이상 낮으면 경고", () => {
    const a = analyzeStand([
      { standAngle: 30, order: 1, meanAngle: 20, overPct: 0, validPct: 95, comfort: 5 },
      { standAngle: 45, order: 2, meanAngle: 15, overPct: 0, validPct: 95, comfort: 3 },
      { standAngle: 60, order: 3, meanAngle: 25, overPct: 0, validPct: 95, comfort: 4 },
    ], null);
    same(a.comfortWarning, { standAngle: 30, comfort: 5 });
  }],
  ["추천: 유효 데이터 70% 미만은 '신뢰 낮음', 평균이 없는 측정은 순위에서 뺀다", () => {
    const a = analyzeStand([
      { standAngle: 30, order: 1, meanAngle: null, overPct: null, validPct: 0, comfort: 3 },
      { standAngle: 45, order: 2, meanAngle: 15, overPct: 0, validPct: 69.9, comfort: 3 },
      { standAngle: 60, order: 3, meanAngle: 25, overPct: 0, validPct: 70, comfort: 3 },
    ], null);
    same(a.lowTrust, [30, 45], "신뢰 낮음");
    same(a.best.standAngle, 45, "추천");
    same(a.fit.status, "too-few", "점이 2개뿐");
  }],
  ["검증: 평균 오차는 |앱 − 각도기|의 평균, 값을 안 넣은 줄은 뺀다", () => {
    near(meanAbsError([
      { appAngle: 20, manual: 22 },
      { appAngle: 30, manual: 29 },
      { appAngle: 40, manual: null },
    ]), 1.5, 1e-9);
    same(meanAbsError([{ appAngle: 20, manual: null }]), null, "기록 없음");
  }],

  // ---------- CSV ----------
  ["CSV: 쉼표·따옴표가 든 칸은 따옴표로 감싼다", () => {
    same(toCsv([["a,b", 'c"d', 1, null]]), '﻿"a,b","c""d",1,\r\n');
  }],
  ["CSV: 세션 파일에 요약과 1초별 기록이 들어간다", () => {
    const csv = sessionCsv({
      code: "A", condition: "평평", mode: "ON", startedAt: "2026-11-11 14:00:00",
      threshold: 20, holdSec: 5, plannedSec: 2,
      summary: { totalSec: 2, validPct: 50, meanAngle: 21.5, overPct: 100, alertCount: 0 },
      records: [[1, 21.5, 1, 0], [2, null, 0, 0]],
    });
    const lines = csv.replace("﻿", "").trim().split("\r\n");
    same(lines[1], "참여자 코드,A");
    same(lines.includes("평균 목 각도(도),21.5"), true, "요약");
    same(lines.at(-3), "경과 시간(초),목 각도(도),측정 가능(1/0),알림 표시(1/0)");
    same(lines.at(-2), "1,21.5,1,0");
    same(lines.at(-1), "2,,0,0");
  }],
  ["CSV: 독서대 추천 파일의 열", () => {
    const csv = standCsv({
      code: "B",
      results: [{ standAngle: 45, order: 1, meanAngle: 15, overPct: 20, validPct: 95, comfort: 4 }],
      analysis: { fit: { x: 44.8 } },
    });
    const lines = csv.replace("﻿", "").trim().split("\r\n");
    same(lines[0].split(",").length, 8, "열 개수");
    same(lines[1], "B,45,1,15,20,4,95,44.8");
  }],
];

/** 모든 테스트를 돌리고 결과 목록을 돌려준다 */
export function runAll() {
  return cases.map(([name, fn]) => {
    try {
      fn();
      return { name, ok: true };
    } catch (err) {
      return { name, ok: false, message: err.message };
    }
  });
}
