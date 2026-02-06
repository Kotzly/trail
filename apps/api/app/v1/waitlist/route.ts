import { POST as wishlistPost } from "../wishlist/route";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return wishlistPost(request);
}
