import { expect, test } from "@playwright/test";

test("página pública de transparência abre sem login e o menu leva até ela", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Transparência" }).click();

  await expect(page).toHaveURL(/\/transparencia$/);
  await expect(page.getByRole("heading", { name: "Transparência", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ranking de órgãos" })).toBeVisible();
});
