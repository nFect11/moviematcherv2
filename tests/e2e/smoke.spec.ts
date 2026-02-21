import { test, expect } from "@playwright/test";

test("landing page renders app shell", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Create a room")).toBeVisible();
  await expect(page.getByText("Join room")).toBeVisible();
});
