import { revalidateTag } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";
import { env } from "../../../lib/env";

export async function POST(req: NextRequest) {
  try {
    const secret = req.nextUrl.searchParams.get("secret");

    if (!env.SANITY_REVALIDATE_SECRET || secret !== env.SANITY_REVALIDATE_SECRET) {
      return NextResponse.json(
        { message: "Invalid secret" },
        { status: 401 },
      );
    }

    const body = (await req.json()) as {
      _type?: string;
      slug?: { current?: string };
    };

    if (!body?._type) {
      return NextResponse.json({ message: "Bad request" }, { status: 400 });
    }

    const tags: string[] = ["sanity"];

    if (body._type === "page" || body._type === "landingPage") {
      tags.push("sanity:page");
      if (body.slug?.current) {
        tags.push(`sanity:page:${body.slug.current}`);
      }
    }

    if (body._type === "siteSettings") {
      tags.push("sanity:siteSettings");
    }

    if (body._type === "supportPage") {
      tags.push("sanity:supportPage");
    }

    for (const tag of tags) {
      revalidateTag(tag, "default");
    }

    return NextResponse.json({
      revalidated: true,
      tags,
      now: Date.now(),
    });
  } catch (err) {
    console.error("Revalidation error:", err);
    return NextResponse.json(
      { message: "Error revalidating" },
      { status: 500 },
    );
  }
}
