import { expect, test, type Page } from "@playwright/test";
import type { Person } from "../support/world";

/**
 * The home launcher. Real people can be pre-checked (anyone with a program
 * day today), so starting a test workout first un-checks everyone who isn't
 * in the test — and asserts that before pressing Start, so a test can never
 * open a session for a real person.
 */
export class Launcher {
  constructor(private readonly page: Page) {}

  async start(people: Person[], { routine, warmup }: { routine: string; warmup: boolean }) {
    await test.step(`start ${routine} for ${people.map((p) => p.firstName).join(", ")}`, async () => {
      await this.page.goto("/");
      const wanted = new Set(people.map((p) => p.firstName));
      const roster = this.page.getByRole("listitem").filter({
        has: this.page.getByRole("combobox", { name: /'s plan$/ }),
      });
      await expect(roster.first()).toBeVisible();

      for (const row of await roster.all()) {
        const plan = row.getByRole("combobox", { name: /'s plan$/ });
        const name = ((await plan.getAttribute("aria-label")) ?? "").replace(/'s plan$/, "");
        const box = row.getByRole("checkbox");
        if (wanted.has(name)) {
          await plan.selectOption({ label: routine });
          await expect(box).toBeChecked(); // picking a plan checks the person
        } else if (await box.isChecked()) {
          await row.getByText(name, { exact: true }).click(); // the label toggles it
          await expect(box).not.toBeChecked();
        }
      }

      const warmupBox = this.page.getByRole("checkbox", { name: /Bike warm-up/ });
      if ((await warmupBox.isChecked()) !== warmup) await this.page.getByText("Bike warm-up").click();
      await expect(warmupBox).toBeChecked({ checked: warmup });

      // Safety: exactly the test people are about to start.
      await expect(this.page.getByRole("checkbox", { checked: true, name: /^(?!Bike warm-up)/ })).toHaveCount(
        people.length,
      );
      const label = people.length === 1 ? /^Start .*workout/ : `Start group workout (${people.length})`;
      await this.page.getByRole("button", { name: label }).click();
      // Start writes every session + its sets before redirecting — allow for a
      // slow runner rather than flaking.
      await expect(this.page).toHaveURL(people.length === 1 ? /\/workout\/session\// : /\/workout\/group\/board/, {
        timeout: 30_000,
      });
    });
  }
}
