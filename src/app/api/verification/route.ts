import {
  apiError,
  checkOrigin,
  identity,
  verifyListing,
  readJson,
} from "@/lib/server";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    return Response.json(
      await verifyListing(await identity(), await readJson(request)),
    );
  } catch (e) {
    return apiError(e);
  }
}
