import { expect, test } from "@playwright/test";

test("the theme toggle survives a reload, and the server renders it (no flash)", async ({
  page,
}) => {
  await page.goto("/");
  const html = page.locator("html");
  // No cookie yet: the page follows the system theme, light in Playwright's default context.
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await expect(html).toHaveAttribute("data-theme", "dark");

  const response = await page.reload();
  expect(await response?.text()).toMatch(/<html[^>]*data-theme="dark"/);
  await expect(html).toHaveAttribute("data-theme", "dark");
  await expect(page.getByRole("button", { name: "Switch to light theme" })).toBeVisible();
});
