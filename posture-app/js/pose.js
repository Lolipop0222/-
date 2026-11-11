// ============================================================
// pose.js — 카메라 열기 + MediaPipe PoseLandmarker(자세 인식) 불러오기
// 영상은 이 기기 안에서만 처리한다. 어디로도 보내거나 저장하지 않는다.
// ============================================================

// MediaPipe Tasks Vision (구글이 만든 자세 인식 라이브러리). 버전을 고정해 둔다.
const MP_VERSION = "0.10.14";
const MP_BUNDLE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/vision_bundle.mjs`;
const MP_WASM = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}/wasm`;
// 자세 인식 모델 2가지
//   full  : 보통 (약 9MB). 폰에서도 부드럽게 돈다
//   heavy : 정밀 (약 30MB). 점이 덜 흔들리지만 느려서 노트북에 알맞다
const MODEL_BASE = "https://storage.googleapis.com/mediapipe-models/pose_landmarker";
export const MODELS = {
  full: { label: "보통 (full)", url: `${MODEL_BASE}/pose_landmarker_full/float16/1/pose_landmarker_full.task` },
  heavy: { label: "정밀 (heavy)", url: `${MODEL_BASE}/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task` },
};

let landmarker = null;
let landmarkerKind = null;
let loading = null;
let loadingKind = null;
let lastTimestamp = 0;

/** 지금 쓰고 있는 모델 이름 ("full" / "heavy") */
export function loadedModel() {
  return landmarkerKind;
}

/**
 * 자세 인식 모델을 불러온다 (처음 한 번만 내려받는다. 몇 초 걸릴 수 있다)
 * @param {"full"|"heavy"} kind
 */
export function loadPose(kind = "full") {
  if (!MODELS[kind]) kind = "full";
  if (landmarker && landmarkerKind === kind) return Promise.resolve(landmarker);
  if (!loading || loadingKind !== kind) {
    loadingKind = kind;
    const MP_MODEL = MODELS[kind].url;
    loading = (async () => {
      const { FilesetResolver, PoseLandmarker } = await import(MP_BUNDLE);
      const fileset = await FilesetResolver.forVisionTasks(MP_WASM);
      const make = (delegate) =>
        PoseLandmarker.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MP_MODEL, delegate },
          runningMode: "VIDEO",
          numPoses: 1,
        });
      let made;
      try {
        made = await make("GPU"); // 그래픽 장치를 쓰면 빠르다
      } catch {
        made = await make("CPU"); // 안 되는 기기에서는 CPU로
      }
      if (loadingKind !== kind) {
        made.close?.(); // 그사이 다른 모델을 고르면 이것은 버린다
        return loadPose(loadingKind);
      }
      landmarker?.close?.();
      landmarker = made;
      landmarkerKind = kind;
      return landmarker;
    })().catch((err) => {
      loading = null; // 다음에 다시 시도할 수 있게
      throw err;
    });
  }
  return loading;
}

/**
 * 영상(또는 캔버스)의 지금 장면에서 랜드마크 33개를 찾는다.
 * @returns {Array<{x:number,y:number,visibility:number}>|null} 사람이 없으면 null
 */
export function detect(source) {
  if (!landmarker) return null;
  // MediaPipe는 시각이 항상 앞으로만 가야 한다
  const now = Math.max(performance.now(), lastTimestamp + 1);
  lastTimestamp = now;
  const result = landmarker.detectForVideo(source, now);
  return result?.landmarks?.[0] ?? null;
}

// ---------------- 카메라 ----------------

let stream = null;

/**
 * 카메라를 연다.
 * @param {HTMLVideoElement} video
 * @param {"user"|"environment"} facing 전면("user") / 후면("environment")
 */
export async function startCamera(video, facing) {
  stopCamera(video);
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("NO_CAMERA_API");
  }
  stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    // 화질이 높을수록 귀·어깨 점이 덜 흔들린다 (안 되는 기기는 알아서 낮춘다)
    video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
  });
  video.srcObject = stream;
  await video.play();
}

export function stopCamera(video) {
  if (stream) {
    for (const track of stream.getTracks()) track.stop();
    stream = null;
  }
  if (video) video.srcObject = null;
}

export function cameraIsOn() {
  return stream != null;
}

/** 카메라 오류를 학생이 읽을 수 있는 문장으로 바꾼다 */
export function cameraErrorMessage(err) {
  const name = err?.name ?? "";
  if (err?.message === "NO_CAMERA_API" || !window.isSecureContext) {
    return "이 주소에서는 카메라를 열 수 없어요. 주소가 https:// 로 시작하거나 localhost 여야 해요. (README의 실행 방법을 확인해 주세요)";
  }
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "카메라 사용이 허용되지 않았어요. 주소창 왼쪽의 자물쇠(또는 설정) 아이콘에서 카메라를 '허용'으로 바꾼 뒤 다시 시도해 주세요.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "카메라를 찾지 못했어요. 다른 카메라(전면/후면)를 골라 보세요.";
  }
  if (name === "NotReadableError") {
    return "다른 앱이 카메라를 쓰고 있는 것 같아요. 다른 앱을 닫고 다시 시도해 주세요.";
  }
  return "카메라를 열지 못했어요. 페이지를 새로 고친 뒤 다시 시도해 주세요.";
}
