"use client";

import { supabase } from "@/lib/supabase";

/**
 * 프린트 아카이브 — 관리자가 올린 수행평가 자료·학습지.
 * 목록은 prints 테이블(가입한 학생만 읽기), 파일은 Storage 'prints' 버킷(비공개 → 잠깐 쓰는 서명 주소로 연다).
 * 올리기·고치기·지우기는 관리자만 (DB 정책이 막는다).
 */

const BUCKET = "prints";

export const PRINT_CATEGORIES = ["수행평가", "학습지", "시험 대비", "기타"] as const;
export type PrintCategory = (typeof PRINT_CATEGORIES)[number];
export const PRINT_SUBJECTS = ["국어", "영어", "수학", "과학", "사회", "한국사", "기타"] as const;
export type PrintSubject = (typeof PRINT_SUBJECTS)[number];

export type Print = {
  id: string;
  title: string;
  category: PrintCategory;
  subject: PrintSubject | null;
  grade: number | null;
  memo: string | null;
  file_path: string;
  file_name: string;
  file_size: number;
  mime: string | null;
  created_at: string;
};

export async function loadPrints(): Promise<Print[]> {
  const { data, error } = await supabase()
    .from("prints")
    .select("id, title, category, subject, grade, memo, file_path, file_name, file_size, mime, created_at")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return data as Print[];
}

/** 파일 종류 (아이콘·열기 방식) */
export function fileKind(p: Pick<Print, "file_name" | "mime">): "pdf" | "image" | "hwp" | "doc" | "other" {
  const ext = p.file_name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf" || p.mime === "application/pdf") return "pdf";
  if (["png", "jpg", "jpeg", "webp", "gif", "heic"].includes(ext) || p.mime?.startsWith("image/")) return "image";
  if (["hwp", "hwpx"].includes(ext)) return "hwp";
  if (["doc", "docx", "ppt", "pptx", "xls", "xlsx"].includes(ext)) return "doc";
  return "other";
}

export function sizeText(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

const GUESS_MIME: Record<string, string> = {
  pdf: "application/pdf",
  hwp: "application/x-hwp",
  hwpx: "application/hwp+zip",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  zip: "application/zip",
};

/** 파일 이름에서 확장자를 뺀 제목 ("1학기 수행평가 안내.pdf" → "1학기 수행평가 안내") */
export function titleFromFileName(name: string): string {
  return name.replace(/\.[^.]+$/, "").replace(/[_]+/g, " ").trim().slice(0, 80) || "프린트";
}

export const MAX_PRINT_BYTES = 50 * 1024 * 1024;

/** 관리자: 파일 하나 올리고 목록에 추가 */
export async function uploadPrint(
  file: File,
  meta: { title: string; category: PrintCategory; subject: PrintSubject | null; grade: number | null; memo: string | null },
): Promise<void> {
  if (file.size > MAX_PRINT_BYTES) throw new Error(`${file.name}: 50MB보다 큰 파일은 올릴 수 없어요`);
  const sb = supabase();
  const ext = (file.name.split(".").pop() ?? "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "bin";
  const path = `${crypto.randomUUID()}.${ext}`;
  const mime = file.type || GUESS_MIME[ext] || "application/octet-stream";
  const { error: upErr } = await sb.storage.from(BUCKET).upload(path, file, { contentType: mime, upsert: false });
  if (upErr) throw upErr;
  const { error } = await sb.from("prints").insert({
    title: meta.title.trim().slice(0, 80) || titleFromFileName(file.name),
    category: meta.category,
    subject: meta.subject,
    grade: meta.grade,
    memo: meta.memo?.trim() || null,
    file_path: path,
    file_name: file.name.slice(0, 200),
    file_size: file.size,
    mime,
  });
  if (error) {
    await sb.storage.from(BUCKET).remove([path]); // 목록에 못 넣었으면 파일도 정리
    throw error;
  }
}

/** 관리자: 지우기 (목록 + 파일) */
export async function deletePrint(p: Print): Promise<void> {
  const sb = supabase();
  const { error } = await sb.from("prints").delete().eq("id", p.id);
  if (error) throw error;
  await sb.storage.from(BUCKET).remove([p.file_path]);
}

/** 관리자: 제목·분류 고치기 */
export async function updatePrint(id: string, patch: Partial<Pick<Print, "title" | "category" | "subject" | "grade" | "memo">>): Promise<void> {
  const { error } = await supabase().from("prints").update(patch).eq("id", id);
  if (error) throw error;
}

/**
 * 파일 열기. 비공개 버킷이라 10분짜리 서명 주소를 받아 새 창으로 연다.
 * PDF·사진은 브라우저에서 바로 보이고, 한글(hwp) 등은 내려받는다.
 * (아이폰 사파리는 await 뒤에 연 창을 막으므로 빈 창을 먼저 연다)
 */
export async function openPrint(p: Print, download = false): Promise<void> {
  const kind = fileKind(p);
  const asDownload = download || (kind !== "pdf" && kind !== "image");
  const win = window.open("", "_blank");
  try {
    const { data, error } = await supabase()
      .storage.from(BUCKET)
      .createSignedUrl(p.file_path, 600, asDownload ? { download: p.file_name } : undefined);
    if (error || !data) throw error ?? new Error("파일 주소를 받지 못했어요");
    if (win) win.location.href = data.signedUrl;
    else window.location.href = data.signedUrl;
  } catch (e) {
    win?.close();
    throw e;
  }
}
