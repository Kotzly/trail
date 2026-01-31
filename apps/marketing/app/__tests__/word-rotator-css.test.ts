import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("word rotator styles", () => {
  it("keeps slot height aligned with line height to prevent clipping", () => {
    const cssPath = resolve(process.cwd(), "app", "globals.css");
    const css = readFileSync(cssPath, "utf8");
    const rotatorBlock = css.match(/\.word-rotator\s*\{[^}]*\}/);
    const trackSpanBlock = css.match(/\.word-rotator-track\s*span\s*\{[^}]*\}/);

    expect(rotatorBlock).not.toBeNull();
    expect(trackSpanBlock).not.toBeNull();
    expect(rotatorBlock?.[0]).toMatch(/height:\s*1\.25em/);
    expect(rotatorBlock?.[0]).toMatch(/line-height:\s*1\.25em/);
    expect(trackSpanBlock?.[0]).toMatch(/height:\s*1\.25em/);
    expect(trackSpanBlock?.[0]).toMatch(/line-height:\s*1\.25em/);
  });
});
