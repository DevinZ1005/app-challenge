import {
  apiError,
  isDemo,
  listProviders,
  identity,
  checkOrigin,
  createListing,
  readJson,
} from "@/lib/server";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const providers = await listProviders();
    return Response.json(
      {
        providers,
        demo:
          isDemo || (providers.length > 0 && providers.every((p) => p.demo)),
        demoAuth: isDemo,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return apiError(e);
  }
}

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    return Response.json(
      await createListing(await identity(), await readJson(request)),
      { status: 201 },
    );
  } catch (e) {
    return apiError(e);
  }
}
