import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const routePath = path.resolve(__dirname, "../../../app/api/trpc/[trpc]/route.ts");

describe("tRPC route imports", () => {
  it("avoids barrel imports for appRouter", () => {
    const contents = readFileSync(routePath, "utf8");
    expect(contents).not.toContain("from \"@trail/trpc\"");
  });
});
