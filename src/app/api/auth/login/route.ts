import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, checkOrigin, login, rateLimit } from "@/lib/server";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const v = z
      .object({
        email: z.email().max(200),
        password: z.string().min(1).max(200),
      })
      .parse(await request.json());
    rateLimit("login:" + v.email.toLowerCase());
    const token = await login(v.email.toLowerCase(), v.password);
    const response = NextResponse.json({ ok: true });
    response.cookies.set("pantryfit-session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 3600,
    });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (e) {
    return apiError(e);
  }
}
