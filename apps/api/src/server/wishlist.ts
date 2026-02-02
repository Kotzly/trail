import { db } from "@trail/db";

type WishlistSource = "MARKETING" | "ACCOUNT" | "EXTENSION";

type WishlistLeadInput = {
  email: string;
  source: WishlistSource;
  userId?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  utmTerm?: string | null;
  referrer?: string | null;
  pagePath?: string | null;
  userAgent?: string | null;
  ip?: string | null;
  country?: string | null;
};

function mergeSources(existing: WishlistSource[] | null | undefined, next: WishlistSource) {
  const list = existing ? [...existing] : [];
  if (!list.includes(next)) {
    list.push(next);
  }
  return list;
}

export async function upsertWishlistLead(input: WishlistLeadInput) {
  const email = input.email.trim();
  const existing = await db.wishlistLead.findUnique({ where: { email } });
  if (!existing) {
    return db.wishlistLead.create({
      data: {
        email,
        sources: [input.source],
        userId: input.userId ?? null,
        utmSource: input.utmSource ?? null,
        utmMedium: input.utmMedium ?? null,
        utmCampaign: input.utmCampaign ?? null,
        utmContent: input.utmContent ?? null,
        utmTerm: input.utmTerm ?? null,
        referrer: input.referrer ?? null,
        pagePath: input.pagePath ?? null,
        userAgent: input.userAgent ?? null,
        ip: input.ip ?? null,
        country: input.country ?? null
      }
    });
  }

  const data: Record<string, unknown> = {
    sources: mergeSources(existing.sources ?? [], input.source)
  };

  if (input.userId !== undefined) data.userId = input.userId;
  if (input.utmSource !== undefined) data.utmSource = input.utmSource;
  if (input.utmMedium !== undefined) data.utmMedium = input.utmMedium;
  if (input.utmCampaign !== undefined) data.utmCampaign = input.utmCampaign;
  if (input.utmContent !== undefined) data.utmContent = input.utmContent;
  if (input.utmTerm !== undefined) data.utmTerm = input.utmTerm;
  if (input.referrer !== undefined) data.referrer = input.referrer;
  if (input.pagePath !== undefined) data.pagePath = input.pagePath;
  if (input.userAgent !== undefined) data.userAgent = input.userAgent;
  if (input.ip !== undefined) data.ip = input.ip;
  if (input.country !== undefined) data.country = input.country;

  return db.wishlistLead.update({
    where: { id: existing.id },
    data
  });
}

export type { WishlistLeadInput, WishlistSource };
