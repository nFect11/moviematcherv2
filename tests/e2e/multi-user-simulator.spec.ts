import { test, expect, type BrowserContext, type Page } from "@playwright/test";

const shouldRunSimulator = process.env.RUN_MULTI_USER_SIM === "1";
const userCount = Math.max(2, Number(process.env.SIM_USER_COUNT ?? 3));
const decisionRounds = Math.max(2, Number(process.env.SIM_DECISIONS ?? 6));

test.describe("multi-user simulator", () => {
  test.skip(!shouldRunSimulator, "Set RUN_MULTI_USER_SIM=1 to run this simulator");

  test("host and joiners can sync lobby/start and interact in active room", async ({ browser, baseURL }) => {
    const contexts: BrowserContext[] = [];
    const pages: Page[] = [];

    try {
      for (let index = 0; index < userCount; index += 1) {
        const context = await browser.newContext();
        const page = await context.newPage();
        contexts.push(context);
        pages.push(page);

        const sessionId = `sim_user_${index + 1}`;
        await page.goto(`${baseURL}/?dev_session=${sessionId}`);
      }

      const hostPage = pages[0];
      const hostName = "SimHost";
      await createRoomAsHost(hostPage, hostName);

      const roomCode = await extractRoomCode(hostPage);
      expect(roomCode).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);

      for (let index = 1; index < pages.length; index += 1) {
        const joinerName = `SimUser${index + 1}`;
        await joinRoomAsMember(pages[index], joinerName, roomCode);
      }

      for (let index = 1; index < pages.length; index += 1) {
        await expect(hostPage.getByText(`SimUser${index + 1}`)).toBeVisible({ timeout: 20_000 });
      }

      await hostPage.getByRole("button", { name: "Start room" }).click();

      for (const page of pages) {
        await expect(page.getByRole("button", { name: "Like" })).toBeVisible({ timeout: 20_000 });
      }

      for (let round = 0; round < decisionRounds; round += 1) {
        for (let index = 0; index < pages.length; index += 1) {
          const page = pages[index];

          if (await isResultsVisible(page)) {
            continue;
          }

          if (await isFinalVotingVisible(page)) {
            const submitButton = page.getByRole("button", { name: "Submit Secret Vote" });
            const isEnabled = await submitButton.isEnabled().catch(() => false);

            if (isEnabled) {
              const selectButton = page.getByRole("button", { name: "Select" }).first();
              await expect(selectButton).toBeVisible({ timeout: 5_000 });
              await selectButton.click();
              await submitButton.click();
            }

            continue;
          }

          const buttonName = (round + index) % 2 === 0 ? "Like" : "Dislike";
          const targetButton = page.getByRole("button", { name: buttonName });

          await expect(targetButton).toBeVisible({ timeout: 10_000 });
          await expect(targetButton).toBeEnabled({ timeout: 10_000 });
          await targetButton.click();
          await page.waitForTimeout(420);
        }
      }

      for (const page of pages) {
        const hasResults = await isResultsVisible(page);
        const hasLikeButton = await page
          .getByRole("button", { name: "Like" })
          .isVisible()
          .catch(() => false);
        const hasFinalVoting = await isFinalVotingVisible(page);

        expect(hasResults || hasLikeButton || hasFinalVoting).toBeTruthy();
      }
    } finally {
      for (const context of contexts) {
        await context.close();
      }
    }
  });
});

async function createRoomAsHost(page: Page, nickname: string) {
  await page.getByLabel("Nickname").fill(nickname);
  await page.getByRole("button", { name: "Create room" }).click();

  await completePreferences(page, "create");
  await expect(page.getByRole("heading", { name: "Lobby" })).toBeVisible({ timeout: 20_000 });
}

async function joinRoomAsMember(page: Page, nickname: string, roomCode: string) {
  await page.getByLabel("Nickname").fill(nickname);
  await page.getByLabel("Room code").fill(roomCode);
  await page.getByRole("button", { name: /^Join room$/ }).first().click();

  await completePreferences(page, "join");
  await expect(page.getByRole("heading", { name: "Lobby" })).toBeVisible({ timeout: 20_000 });
}

async function completePreferences(page: Page, mode: "create" | "join") {
  await expect(page.getByRole("heading", { name: "Select genres you like" })).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "Action" }).click();
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByRole("heading", { name: "Select genres you don't like" })).toBeVisible({ timeout: 10_000 });
  await page.getByRole("button", { name: "Horror" }).click();

  if (mode === "create") {
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { name: "Select streaming providers you have" })).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: "Netflix" }).click();
    await page.getByRole("button", { name: "Create room" }).click();
    return;
  }

  await page.getByRole("button", { name: /^Join room$/ }).click();
}

async function extractRoomCode(page: Page) {
  const text = await page.locator("body").innerText();
  const match = text.match(/\b[A-HJ-NP-Z2-9]{6}\b/);
  if (!match) {
    throw new Error("Could not find room code on host page");
  }

  return match[0];
}

async function isResultsVisible(page: Page) {
  return page
    .getByRole("heading", { name: "Results" })
    .isVisible()
    .catch(() => false);
}

async function isFinalVotingVisible(page: Page) {
  return page
    .getByRole("heading", { name: "Final Showdown" })
    .isVisible()
    .catch(() => false);
}
