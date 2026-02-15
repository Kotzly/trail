import { Prisma } from "@trail/db/src/generated/client";

export type JsonValue = Prisma.JsonValue;
export type JsonInputValue = Prisma.InputJsonValue | Prisma.JsonNullValueInput;

const isPlainObject = (value: object) =>
  Object.getPrototypeOf(value) === Object.prototype;

export function isJsonValue(value: unknown): value is JsonValue {
  if (value === null) return true;
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return true;
  }
  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }
  if (typeof value === "object") {
    if (!isPlainObject(value)) return false;
    return Object.values(value as Record<string, unknown>).every(isJsonValue);
  }
  return false;
}

export function toPrismaJsonInput(value: JsonValue): JsonInputValue {
  return value === null ? Prisma.JsonNull : value;
}
