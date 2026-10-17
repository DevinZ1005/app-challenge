import { z } from "zod";
import { apiError, checkOrigin, identity, reviewChange } from "@/lib/server";
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    checkOrigin(request);
    const who = await identity();
    const v = z
      .object({
        status: z.enum(["approved", "rejected"]),
        note: z.string().min(5).max(1000),
      })
      .parse(await request.json());
    return Response.json(
      await reviewChange(who, (await params).id, v.status, v.note),
    );
  } catch (e) {
    return apiError(e);
  }
}
