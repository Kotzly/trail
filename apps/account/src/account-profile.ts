const INVALID_PHOTO_URL_ERROR = "photo must be a valid http(s) url";

const normalizeSpacing = (value: string): string =>
  value.trim().replace(/\s+/g, " ");

export function splitDisplayName(name: string): {
  firstName: string;
  lastName: string;
} {
  const normalized = normalizeSpacing(name);

  if (!normalized) {
    return { firstName: "", lastName: "" };
  }

  const [firstName = "", ...rest] = normalized.split(" ");

  return {
    firstName,
    lastName: rest.join(" "),
  };
}

export function buildDisplayName(firstName: string, lastName: string): string {
  const normalizedFirstName = normalizeSpacing(firstName);
  const normalizedLastName = normalizeSpacing(lastName);

  return [normalizedFirstName, normalizedLastName].filter(Boolean).join(" ");
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizeImageUrl(imageUrl: string): string | null {
  const normalized = imageUrl.trim();

  if (!normalized) {
    return null;
  }

  let url: URL;

  try {
    url = new URL(normalized);
  } catch {
    throw new Error(INVALID_PHOTO_URL_ERROR);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(INVALID_PHOTO_URL_ERROR);
  }

  return url.toString();
}
