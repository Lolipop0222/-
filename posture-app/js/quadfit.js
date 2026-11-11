// ============================================================
// quadfit.js — 2차 곡선 맞추기와 최저점 계산
// ============================================================
//
// [무엇을 하나]
//   (독서대 각도 x, 평균 목 각도 y) 점이 여러 개 있을 때,
//   그 점들에 가장 잘 맞는 2차 곡선  y = a·x² + b·x + c  를 찾고,
//   그 곡선이 가장 낮아지는 x(= 목을 가장 덜 숙이는 독서대 각도)를 구한다.
//
// [왜 2차 곡선인가]
//   독서대가 너무 낮으면 책을 내려다보느라 목을 숙이고,
//   너무 높으면 책이 서서 다시 불편해진다고 예상할 수 있다.
//   "내려갔다가 다시 올라가는" 모양을 가장 간단하게 나타내는 식이 2차식(∪ 모양)이다.
//
// [최소제곱법]
//   곡선과 각 점 사이의 세로 거리(오차)를 제곱해서 모두 더한 값
//       S = Σ (yᵢ − (a·xᵢ² + b·xᵢ + c))²
//   이 가장 작아지는 a, b, c를 고른다. S를 a, b, c로 각각 미분해 0으로 두면
//   아래의 연립방정식(정규방정식) 3개가 나온다.
//       a·Σx⁴ + b·Σx³ + c·Σx² = Σx²y
//       a·Σx³ + b·Σx² + c·Σx  = Σxy
//       a·Σx² + b·Σx  + c·n   = Σy
//   이 연립방정식을 풀면 a, b, c가 나온다. (점이 딱 3개면 곡선이 세 점을 정확히 지난다)
//
// [최저점]
//   y = a·x² + b·x + c 를 미분하면 y' = 2a·x + b. 이것이 0이 되는 곳이 꼭짓점:
//       x = −b / (2a)
//   a > 0 (∪ 모양)일 때만 꼭짓점이 "최저점"이다. a ≤ 0 이면 (∩ 모양 또는 직선) 최저점이 없다.

/**
 * 3원 1차 연립방정식 M·v = r 을 가우스 소거법으로 푼다.
 * 풀 수 없으면(해가 하나로 정해지지 않으면) null.
 */
function solve3(M, r) {
  // [M | r] 꼴의 3×4 표로 만들어 한 줄씩 정리한다
  const A = M.map((row, i) => [...row, r[i]]);
  for (let col = 0; col < 3; col++) {
    // 계산 오차를 줄이려고, 이 열에서 절댓값이 가장 큰 줄을 위로 올린다
    let pivot = col;
    for (let row = col + 1; row < 3; row++) {
      if (Math.abs(A[row][col]) > Math.abs(A[pivot][col])) pivot = row;
    }
    if (Math.abs(A[pivot][col]) < 1e-12) return null;
    [A[col], A[pivot]] = [A[pivot], A[col]];
    // 다른 줄에서 이 열의 값을 0으로 만든다
    for (let row = 0; row < 3; row++) {
      if (row === col) continue;
      const k = A[row][col] / A[col][col];
      for (let j = col; j < 4; j++) A[row][j] -= k * A[col][j];
    }
  }
  return [A[0][3] / A[0][0], A[1][3] / A[1][1], A[2][3] / A[2][2]];
}

/**
 * 점들에 2차 곡선 y = a·x² + b·x + c 를 최소제곱법으로 맞춘다.
 * @param {Array<{x:number, y:number}>} points 서로 다른 x가 3개 이상 있어야 한다
 * @returns {{a:number, b:number, c:number} | null} 맞출 수 없으면 null
 */
export function fitQuadratic(points) {
  const distinctX = new Set(points.map((p) => p.x));
  if (distinctX.size < 3) return null;

  // x를 평균만큼 옮겨서(u = x − 평균) 계산한다.
  // 45⁴ 같은 큰 수끼리 빼면 컴퓨터 계산 오차가 커지기 때문이다. 결과는 나중에 되돌린다.
  const n = points.length;
  const meanX = points.reduce((s, p) => s + p.x, 0) / n;

  let s1 = 0, s2 = 0, s3 = 0, s4 = 0, sy = 0, sxy = 0, sx2y = 0;
  for (const p of points) {
    const u = p.x - meanX;
    s1 += u;
    s2 += u * u;
    s3 += u * u * u;
    s4 += u * u * u * u;
    sy += p.y;
    sxy += u * p.y;
    sx2y += u * u * p.y;
  }

  // 정규방정식을 푼다 → u에 대한 곡선 y = A·u² + B·u + C
  const solved = solve3(
    [
      [s4, s3, s2],
      [s3, s2, s1],
      [s2, s1, n],
    ],
    [sx2y, sxy, sy],
  );
  if (!solved) return null;
  const [A, B, C] = solved;

  // u = x − 평균 을 다시 넣어 x에 대한 식으로 되돌린다
  //   A(x−m)² + B(x−m) + C = A·x² + (B − 2A·m)·x + (A·m² − B·m + C)
  return {
    a: A,
    b: B - 2 * A * meanX,
    c: A * meanX * meanX - B * meanX + C,
  };
}

/** 곡선의 x에서의 높이 y */
export function evalQuadratic(coef, x) {
  return coef.a * x * x + coef.b * x + coef.c;
}

/**
 * 2차 곡선의 최저점(꼭짓점)을 구한다.
 * @returns {{x:number, y:number} | null} ∪ 모양이 아니면(a ≤ 0) 최저점이 없으므로 null
 */
export function quadraticMinimum(coef) {
  if (!coef || !(coef.a > 1e-9)) return null;
  const x = -coef.b / (2 * coef.a);
  return { x, y: evalQuadratic(coef, x) };
}

/**
 * 측정한 점들로 "추정 최적 독서대 각도"를 구한다.
 * 최저점이 측정한 범위 밖이면 추정하지 않는다 — 측정하지 않은 구간까지
 * 곡선을 늘려서 믿는 것(외삽)은 위험하기 때문이다.
 *
 * @param {Array<{x:number, y:number}>} points
 * @returns {{status:"ok", x:number, y:number, coef:object}
 *         | {status:"too-few"}                 점이 3개 미만
 *         | {status:"below-range", coef:object} 더 낮은 각도를 측정해 봐야 함
 *         | {status:"above-range", coef:object} 더 높은 각도를 측정해 봐야 함}
 */
export function estimateBestAngle(points) {
  const coef = fitQuadratic(points);
  if (!coef) return { status: "too-few" };

  const xs = points.map((p) => p.x);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const vertex = quadraticMinimum(coef);

  if (vertex) {
    if (vertex.x < minX) return { status: "below-range", coef };
    if (vertex.x > maxX) return { status: "above-range", coef };
    return { status: "ok", x: vertex.x, y: vertex.y, coef };
  }
  // ∪ 모양이 아니다: 곡선이 범위의 어느 끝에서 더 낮은지 보고 그쪽을 더 측정하라고 안내한다
  return evalQuadratic(coef, minX) <= evalQuadratic(coef, maxX)
    ? { status: "below-range", coef }
    : { status: "above-range", coef };
}
