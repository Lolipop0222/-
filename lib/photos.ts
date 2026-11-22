"use client";

import { supabase } from "@/lib/supabase";

/**
 * 프로필 사진 (Supabase Storage 'avatars' 버킷, 공개).
 * 올리기 전에 브라우저에서 가운데를 정사각형으로 잘라 320px로 줄인다 → 용량이 작아지고,
 * 캔버스로 다시 그리므로 사진 속 위치(GPS)·기기 정보가 사라진다.
 * 경로는 '<내 user id>/<무작위 16자>.webp' — DB와 저장소 규칙이 내 폴더만 허용한다.
 */

const BUCKET = "avatars";
const SIZE = 320;
export const PHOTO_PREFIX = "photo:";

/** 'photo:<경로>' → 경로 (사진이 아니면 null) */
export function photoPath(avatar: string | null | undefined): string | null {
  if (!avatar?.startsWith(PHOTO_PREFIX)) return null;
  const path = avatar.slice(PHOTO_PREFIX.length);
  return /^[0-9a-f-]{36}\/[0-9a-f]{16}\.(webp|jpg)$/.test(path) ? path : null;
}

export function photoUrl(path: string): string {
  return supabase().storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

function randomHex(bytes: number) {
  const a = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(a, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** 고른 사진 → 320×320 정사각형 (webp, 안 되는 브라우저는 jpg) */
export async function squarePhoto(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error("사진 파일만 쓸 수 있어요");
  if (file.size > 20 * 1024 * 1024) throw new Error("20MB보다 작은 사진을 골라 주세요");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("이 사진은 열 수 없어요. 다른 사진을 골라 주세요");
  }
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("사진을 줄이지 못했어요");
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
  bitmap.close();
  const toBlob = (type: string, q: number) => new Promise<Blob | null>((ok) => canvas.toBlob(ok, type, q));
  const webp = await toBlob("image/webp", 0.85);
  if (webp && webp.type === "image/webp") return webp;
  const jpg = await toBlob("image/jpeg", 0.85);
  if (!jpg) throw new Error("사진을 줄이지 못했어요");
  return jpg;
}

/** 줄인 사진을 올리고 avatar 값('photo:…')을 돌려준다 */
export async function uploadPhoto(userId: string, blob: Blob): Promise<string> {
  const ext = blob.type === "image/webp" ? "webp" : "jpg";
  const path = `${userId}/${randomHex(8)}.${ext}`;
  const { error } = await supabase().storage.from(BUCKET).upload(path, blob, { contentType: blob.type, upsert: false, cacheControl: "31536000" });
  if (error) throw error;
  return PHOTO_PREFIX + path;
}

/** 저장소에서 사진 파일 지우기 (실패해도 앱은 계속 — 화면에는 이미 안 쓰임) */
export async function removePhotoFile(path: string | null): Promise<void> {
  if (!path) return;
  try {
    await supabase().storage.from(BUCKET).remove([path]);
  } catch {
    // 무시
  }
}

/** 내 폴더의 사진을 모두 지운다 (계정 삭제 전) */
export async function removeAllMyPhotos(userId: string): Promise<void> {
  try {
    const { data } = await supabase().storage.from(BUCKET).list(userId, { limit: 100 });
    const paths = (data ?? []).map((f) => `${userId}/${f.name}`);
    if (paths.length) await supabase().storage.from(BUCKET).remove(paths);
  } catch {
    // 무시
  }
}

// ───────────────────────── 문의 첨부 사진 (2026-11-22) ─────────────────────────
// 비공개 'inquiry' 버킷, 경로 '<내 user id>/<무작위 16자>.webp|jpg'. 나와 관리자만 서명 주소로 본다.
// 인증 사진(능화반 명단 등)은 글자가 보여야 하므로 정사각형으로 자르지 않고 긴 쪽 1600px까지만 줄인다.

const INQUIRY_BUCKET = "inquiry";
export const INQUIRY_PHOTO_MAX = 5;

/** 고른 사진 → 긴 쪽 1600px 이하 (webp, 안 되면 jpg). 캔버스로 다시 그려 사진 정보(위치 등)를 지운다 */
export async function shrinkPhoto(file: File, maxSide = 1600): Promise<Blob> {
  if (!file.type.startsWith("image/")) throw new Error("사진 파일만 첨부할 수 있어요");
  if (file.size > 25 * 1024 * 1024) throw new Error("25MB보다 작은 사진을 골라 주세요");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("이 사진은 열 수 없어요. 다른 사진을 골라 주세요");
  }
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("사진을 줄이지 못했어요");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const toBlob = (type: string, q: number) => new Promise<Blob | null>((ok) => canvas.toBlob(ok, type, q));
  const webp = await toBlob("image/webp", 0.85);
  if (webp && webp.type === "image/webp") return webp;
  const jpg = await toBlob("image/jpeg", 0.85);
  if (!jpg) throw new Error("사진을 줄이지 못했어요");
  return jpg;
}

/** 문의 사진 올리기 → 저장 경로 */
export async function uploadInquiryPhoto(userId: string, blob: Blob): Promise<string> {
  const ext = blob.type === "image/webp" ? "webp" : "jpg";
  const path = `${userId}/${randomHex(8)}.${ext}`;
  const { error } = await supabase().storage.from(INQUIRY_BUCKET).upload(path, blob, { contentType: blob.type, upsert: false });
  if (error) throw error;
  return path;
}

/** 문의 사진 서명 주소 (1시간). 못 만든 것은 빠진다 */
export async function inquiryPhotoUrls(paths: string[]): Promise<Record<string, string>> {
  if (!paths.length) return {};
  const { data, error } = await supabase().storage.from(INQUIRY_BUCKET).createSignedUrls(paths, 3600);
  if (error || !data) return {};
  return Object.fromEntries(data.filter((d) => d.signedUrl && d.path).map((d) => [d.path as string, d.signedUrl as string]));
}

export async function removeInquiryPhotos(paths: string[]): Promise<void> {
  if (!paths.length) return;
  try {
    await supabase().storage.from(INQUIRY_BUCKET).remove(paths);
  } catch {
    // 무시
  }
}

/** 내 문의 사진을 모두 지운다 (계정 삭제 전) */
export async function removeAllMyInquiryPhotos(userId: string): Promise<void> {
  try {
    const { data } = await supabase().storage.from(INQUIRY_BUCKET).list(userId, { limit: 100 });
    const paths = (data ?? []).map((f) => `${userId}/${f.name}`);
    if (paths.length) await supabase().storage.from(INQUIRY_BUCKET).remove(paths);
  } catch {
    // 무시
  }
}
