import { apiError, checkOrigin, identity, verifyListing } from "@/lib/server";
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    return Response.json(
      await verifyListing(await identity(), await request.json()),
    );
  } catch (e) {
    return apiError(e);
  }
}
