import { NextResponse } from "next/server";
import { apiError, checkOrigin } from "@/lib/server";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const response = NextResponse.json({ ok: true });
    response.cookies.set("pantryfit-session", "", {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });
    return response;
  } catch (e) {
    return apiError(e);
  }
}
