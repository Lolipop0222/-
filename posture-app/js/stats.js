// ============================================================
// stats.js — 요약 통계, 알림 판정, 독서대 추천 판단, CSV 만들기
// (카메라·화면과 상관없는 순수 계산만 모아 둔 파일. 테스트하기 쉽다)
// ============================================================

import { estimateBestAngle } from "./quadfit.js";

/** 유효 데이터 비율이 이 값(%)보다 낮으면 "신뢰 낮음" */
export const LOW_TRUST_PCT = 70;

/** 소수 첫째 자리까지 반올림 (null이면 null) */
export function round1(v) {
  return v == null || !Number.isFinite(v) ? null : Math.round(v * 10) / 10;
}

/**
 * 1초별 기록으로 세션 요약을 만든다.
 * @param {Array<{t:number, angle:number|null, valid:boolean, alert:boolean}>} records
 * @param {number} threshold  기준 각도(도)
 * @param {number} alertCount 알림이 뜬 횟수
 */
export function summarize(records, threshold, alertCount = 0) {
  const totalSec = records.length;
  const valid = records.filter((r) => r.valid && r.angle != null);
  const validSec = valid.length;

  // 평균 목 각도 = 측정 가능했던 초들의 각도 평균
  const meanAngle = validSec ? valid.reduce((s, r) => s + r.angle, 0) / validSec : null;

  // 기준 각도 이상 비율 = (기준 이상이었던 초) ÷ (측정 가능했던 초) × 100
  // 측정 불가였던 초는 어떤 자세였는지 모르므로 분모에서도 뺀다.
  const overSec = valid.filter((r) => r.angle >= threshold).length;
  const overPct = validSec ? (overSec / validSec) * 100 : null;

  // 유효 데이터 비율 = (측정 가능했던 초) ÷ (전체 초) × 100
  const validPct = totalSec ? (validSec / totalSec) * 100 : 0;

  return {
    totalSec,
    validSec,
    validPct: round1(validPct),
    meanAngle: round1(meanAngle),
    overPct: round1(overPct),
    alertCount,
  };
}

/**
 * 알림 판정기.
 * "기준 각도 이상"이 holdSec초 동안 끊기지 않고 이어지면 알림을 켠다.
 * 각도가 기준 아래로 돌아오면 바로 끈다. 측정 불가가 되어도 끄고 처음부터 다시 센다.
 */
export class AlertTracker {
  constructor(threshold, holdSec) {
    this.threshold = threshold;
    this.holdMs = holdSec * 1000;
    this.overSince = null; // 기준 이상이 시작된 시각 (ms). 아니면 null
    this.showing = false;  // 지금 알림이 떠 있는가
    this.count = 0;        // 알림이 뜬 횟수
  }
  /**
   * @param {number} now 지금 시각(ms)
   * @param {number|null} angle 1초 이동평균 목 각도 (측정 불가면 null)
   * @returns {boolean} 알림을 보여 줘야 하면 true
   */
  update(now, angle) {
    if (angle == null || angle < this.threshold) {
      this.overSince = null;
      this.showing = false;
      return false;
    }
    if (this.overSince == null) this.overSince = now;
    if (!this.showing && now - this.overSince >= this.holdMs) {
      this.showing = true;
      this.count += 1;
    }
    return this.showing;
  }
}

/** 검증 기록에서 평균 오차(절댓값 평균)를 구한다. 각도기 값을 넣은 기록이 없으면 null */
export function meanAbsError(verifyEntries) {
  const done = verifyEntries.filter((e) => e.manual != null && Number.isFinite(e.manual));
  if (!done.length) return null;
  return done.reduce((s, e) => s + Math.abs(e.appAngle - e.manual), 0) / done.length;
}

/**
 * 독서대 각도별 결과를 보고 추천을 정한다.
 * @param {Array<{standAngle:number, order:number, meanAngle:number|null, overPct:number|null,
 *                validPct:number, comfort:number|null}>} results
 * @param {number|null} verifyError 정확도 검증에서 구한 평균 오차(도). 검증 기록이 없으면 null
 */
export function analyzeStand(results, verifyError) {
  // 평균 목 각도가 있는 측정만 순위를 매긴다 (작을수록 좋음)
  const usable = results.filter((r) => r.meanAngle != null);
  const ranked = [...usable].sort((p, q) => p.meanAngle - q.meanAngle);
  const best = ranked[0] ?? null;
  const second = ranked[1] ?? null;

  // 2차 곡선으로 추정한 최적 각도
  const fit = estimateBestAngle(usable.map((r) => ({ x: r.standAngle, y: r.meanAngle })));

  // 1등과 2등의 차이가 측정 오차보다 작은가?
  const gap = best && second ? second.meanAngle - best.meanAngle : null;
  const withinError = gap != null && verifyError != null && gap < verifyError;

  // 추천한 각도의 편안함 점수가 다른 각도보다 2점 이상 낮은가?
  let comfortWarning = null;
  if (best && best.comfort != null) {
    const comfier = usable
      .filter((r) => r !== best && r.comfort != null && r.comfort - best.comfort >= 2)
      .sort((p, q) => q.comfort - p.comfort)[0];
    if (comfier) comfortWarning = { standAngle: comfier.standAngle, comfort: comfier.comfort };
  }

  const lowTrust = results.filter((r) => r.validPct < LOW_TRUST_PCT).map((r) => r.standAngle);

  return {
    best: best ? { standAngle: best.standAngle, meanAngle: best.meanAngle, comfort: best.comfort } : null,
    second: second ? { standAngle: second.standAngle, meanAngle: second.meanAngle } : null,
    gap: round1(gap),
    verifyError: round1(verifyError),
    withinError,
    comfortWarning,
    lowTrust,
    fit: {
      status: fit.status,
      x: fit.status === "ok" ? round1(fit.x) : null,
      y: fit.status === "ok" ? round1(fit.y) : null,
      coef: fit.coef ?? null,
    },
  };
}

// ---------------- CSV ----------------

/** 칸 하나를 CSV 규칙에 맞게 바꾼다 (쉼표·따옴표·줄바꿈이 있으면 따옴표로 감싼다) */
function cell(v) {
  if (v == null) return "";
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** 2차원 배열 → CSV 글자. 맨 앞 ﻿는 엑셀에서 한글이 깨지지 않게 하는 표시(BOM) */
export function toCsv(rows) {
  return "﻿" + rows.map((row) => row.map(cell).join(",")).join("\r\n") + "\r\n";
}

const modeLabel = (s) => (s.mode === "ON" ? "알림 ON" : "알림 OFF");

/** 세션 하나: 위쪽에 세션 정보·요약, 한 줄 띄우고 1초별 기록 */
export function sessionCsv(s) {
  const m = s.summary;
  const rows = [
    ["항목", "값"],
    ["참여자 코드", s.code],
    ["조건", s.condition],
    ["모드", modeLabel(s)],
    ["시작 시각", s.startedAt],
    ["기준 각도(도)", s.threshold],
    ["알림까지 걸리는 시간(초)", s.mode === "ON" ? s.holdSec : ""],
    ["계획한 측정 시간(초)", s.plannedSec],
    ["전체 측정 시간(초)", m.totalSec],
    ["유효 데이터 비율(%)", m.validPct],
    ["평균 목 각도(도)", m.meanAngle],
    ["기준 각도 이상 시간 비율(%)", m.overPct],
    ["알림 횟수", m.alertCount],
    [],
    ["경과 시간(초)", "목 각도(도)", "측정 가능(1/0)", "알림 표시(1/0)"],
  ];
  for (const [t, angle, valid, alert] of s.records) rows.push([t, angle, valid, alert]);
  return toCsv(rows);
}

/** 여러 세션의 요약만 한 줄씩 (세션끼리 비교할 때) */
export function sessionsSummaryCsv(sessions) {
  const rows = [[
    "시작 시각", "참여자 코드", "조건", "모드", "기준 각도(도)", "전체 측정 시간(초)",
    "유효 데이터 비율(%)", "평균 목 각도(도)", "기준 각도 이상 시간 비율(%)", "알림 횟수",
  ]];
  for (const s of sessions) {
    const m = s.summary;
    rows.push([
      s.startedAt, s.code, s.condition, modeLabel(s), s.threshold, m.totalSec,
      m.validPct, m.meanAngle, m.overPct, m.alertCount,
    ]);
  }
  return toCsv(rows);
}

/** 정확도 검증 목록 */
export function verifyCsv(entries) {
  const rows = [["번호", "시각", "앱이 잰 각도(도)", "각도기로 잰 각도(도)", "오차(앱-각도기)", "오차 절댓값"]];
  entries.forEach((e, i) => {
    const has = e.manual != null && Number.isFinite(e.manual);
    const err = has ? round1(e.appAngle - e.manual) : "";
    rows.push([i + 1, e.time, e.appAngle, has ? e.manual : "", err, has ? Math.abs(err) : ""]);
  });
  const mae = meanAbsError(entries);
  rows.push([]);
  rows.push(["평균 오차(절댓값 평균)", mae == null ? "" : round1(mae)]);
  return toCsv(rows);
}

/** 독서대 추천 결과 */
export function standCsv(run) {
  const best = run.analysis.fit.x;
  const rows = [[
    "학생 코드", "독서대 각도(도)", "측정 순서", "평균 목 각도(도)", "기준 각도 이상 비율(%)",
    "편안함 점수(1~5)", "유효 데이터 비율(%)", "추정 최적 각도(도)",
  ]];
  const sorted = [...run.results].sort((p, q) => p.standAngle - q.standAngle);
  for (const r of sorted) {
    rows.push([
      run.code, r.standAngle, r.order, r.meanAngle, r.overPct, r.comfort, r.validPct,
      best == null ? "추정 안 함" : best,
    ]);
  }
  return toCsv(rows);
}
