import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { User } from "@/db/schema";
import { Errors } from "./errors";
import { readSessionUser } from "./session";

/** ผู้ใช้ปัจจุบันจาก session (อ่านฐานข้อมูลครั้งเดียวต่อ request) */
export const getCurrentUser = cache(readSessionUser);

/** ใช้ในหน้าเว็บ: ถ้ายังไม่ล็อกอิน พาไปหน้าเข้าสู่ระบบแล้วกลับมาหน้าเดิม */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    const path = (await headers()).get("x-pathname") || "/";
    redirect(`/login?next=${encodeURIComponent(path)}`);
  }
  return user;
}

/** ใช้ใน Route Handler: ตรวจ session ทุกครั้งที่ server */
export async function requireApiUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw Errors.unauthenticated();
  return user;
}

export const isDevLoginEnabled = () =>
  process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test";
