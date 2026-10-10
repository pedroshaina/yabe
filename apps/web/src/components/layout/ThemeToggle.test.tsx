import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { mockSystemTheme } from "@/testing/match-media";

describe("ThemeToggle", () => {
  it("offers the opposite of the stored theme", () => {
    render(<ThemeToggle initialTheme="dark" />);
    expect(screen.getByRole("button", { name: "Switch to light theme" })).toBeInTheDocument();
  });

  it("follows the system theme when nothing is stored", () => {
    mockSystemTheme(true);
    render(<ThemeToggle />);
    expect(screen.getByRole("button", { name: "Switch to light theme" })).toBeInTheDocument();
  });

  it("switches the page theme, stores it in a cookie and relabels itself", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle initialTheme="light" />);

    await user.click(screen.getByRole("button", { name: "Switch to dark theme" }));

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.cookie).toContain("yabe-theme=dark");
    expect(screen.getByRole("button", { name: "Switch to light theme" })).toBeInTheDocument();
  });

  it("switches back", async () => {
    const user = userEvent.setup();
    render(<ThemeToggle initialTheme="light" />);
    const button = screen.getByRole("button");

    await user.click(button);
    await user.click(button);

    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.cookie).toContain("yabe-theme=light");
  });
});
