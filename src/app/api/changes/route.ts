import {
  apiError,
  checkOrigin,
  identity,
  submitChange,
  rateLimit,
} from "@/lib/server";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const who = await identity();
    rateLimit("change:" + who.id);
    return Response.json(await submitChange(who, await request.json()), {
      status: 201,
    });
  } catch (e) {
    return apiError(e);
  }
}
