import { apiError, identity, isDemo, dashboard } from "@/lib/server";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const who = await identity();
    const { token: _, ...safe } = who;
    return Response.json(
      { ...safe, demo: isDemo, ...(await dashboard(who)) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return apiError(e);
  }
}
