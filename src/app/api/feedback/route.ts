import { z } from "zod";
import {
  apiError,
  checkOrigin,
  rateLimit,
  submitFeedback,
  readJson,
} from "@/lib/server";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    rateLimit("feedback-global");
    const v = z
      .object({ message: z.string().min(5).max(1000) })
      .parse(await readJson(request));
    return Response.json(await submitFeedback(v.message), { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}
