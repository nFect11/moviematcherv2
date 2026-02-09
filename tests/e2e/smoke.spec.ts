import { test, expect } from "@playwright/test";

test("landing page renders app shell", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "MovieMatcher" })).toBeVisible();
  await expect(page.getByText("Create room")).toBeVisible();
  await expect(page.getByText("Join room")).toBeVisible();
});
