import { describe, expect, it } from "vitest";
import { otherTheme, parseTheme } from "@/lib/theme";

describe("parseTheme", () => {
  it.each([
    ["light", "light"],
    ["dark", "dark"],
  ])("accepts %s", (value, expected) => {
    expect(parseTheme(value)).toBe(expected);
  });

  it.each([[undefined], [""], ["purple"], ["Dark"], ["dark "]])(
    "treats %j as no choice",
    (value) => {
      expect(parseTheme(value)).toBeUndefined();
    },
  );
});

describe("otherTheme", () => {
  it("flips the theme", () => {
    expect(otherTheme("light")).toBe("dark");
    expect(otherTheme("dark")).toBe("light");
  });
});
