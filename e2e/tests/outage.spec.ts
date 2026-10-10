import { expect, test } from "@playwright/test";
import { compose, waitFor } from "../stack/compose.ts";
import { API_URL } from "../stack/urls.ts";
import { expectNoA11yViolations } from "./axe.ts";
import { grouped, seed } from "./seed.ts";

const apiReady = () => waitFor("the API", async () => (await fetch(`${API_URL}/ready`)).ok);

// Whatever happens below, leave the API running for the next run on a kept-up stack.
test.afterAll(async () => {
  compose("start", "yabe-api");
  await apiReady();
});

test("an API outage shows the still skeleton and a toast; Retry recovers", async ({ page }) => {
  test.setTimeout(240_000);
  compose("stop", "yabe-api");

  await page.goto(`/block/${seed.bigBlock.height}`);
  const toast = page.locator("[data-sonner-toast]", {
    hasText: "Can't reach the chain data right now",
  });
  await expect(toast).toBeVisible();
  // Axe blends colours mid-animation: check contrast once the toast has faded in.
  await expect(toast).toHaveCSS("opacity", "1");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Block unavailable");
  await expectNoA11yViolations(page);

  compose("start", "yabe-api");
  await apiReady();
  await toast.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(grouped(seed.bigBlock.height));
});
