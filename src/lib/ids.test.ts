import { describe, expect, it } from "vitest";
import { newId, randomSuffix, slugId } from "./ids";

describe("randomSuffix", () => {
  it("returns the requested length from the allowed alphabet", () => {
    const s = randomSuffix(8);
    expect(s).toMatch(/^[a-z0-9]{8}$/);
  });
});

describe("newId", () => {
  it("prefixes with an underscore separator", () => {
    expect(newId("wi")).toMatch(/^wi_[a-z0-9]{8}$/);
  });
});

describe("slugId", () => {
  it("slugs the name and appends a short suffix", () => {
    expect(slugId("r", "Upper Body A")).toMatch(/^r_upper_body_a_[a-z0-9]{4}$/);
  });

  it("collapses runs of symbols and trims edge underscores", () => {
    expect(slugId("r", "  --Push!! Day--  ")).toMatch(/^r_push_day_[a-z0-9]{4}$/);
  });

  it("falls back to 'untitled' for an all-symbol name", () => {
    expect(slugId("r", "!!!")).toMatch(/^r_untitled_[a-z0-9]{4}$/);
  });

  it("clamps long names to 32 slug chars", () => {
    const id = slugId("r", "x".repeat(100));
    const slug = id.replace(/^r_/, "").replace(/_[a-z0-9]{4}$/, "");
    expect(slug.length).toBeLessThanOrEqual(32);
  });
});
