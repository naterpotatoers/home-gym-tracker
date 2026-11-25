import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * Page objects for a live session — the ONLY place that knows the markup.
 * Everything is found by role and accessible name (the same names a screen
 * reader announces), scoped to the session's root: the whole page for the
 * solo runner, one person's `region` on the group board. When the UI
 * changes, fix it here; specs talk in intent ("log the current set").
 */

export type BikeReadout = {
  avgWatts?: number;
  maxWatts?: number;
  avgRpm?: number;
  distanceMi?: number;
  calories?: number;
  effort?: number;
};

/** One exercise block in the list. */
export class Block {
  constructor(
    private readonly page: Page,
    readonly root: Locator,
  ) {}

  /** The editable weight on the active row (exact/approximate loads). */
  get weight() {
    return this.root.getByRole("spinbutton", { name: "weight", exact: true });
  }

  get reps() {
    return this.root.getByRole("spinbutton", { name: "reps", exact: true });
  }

  get targetWatts() {
    return this.root.getByRole("spinbutton", { name: "target watts", exact: true });
  }

  readout(caption: "avg watts" | "max watts" | "avg cadence" | "distance mi" | "calories") {
    return this.root.getByRole("group", { name: "Console readout" }).getByLabel(caption, { exact: true });
  }

  /** A bike piece's row while it isn't the open one, by its number. */
  piece(number: number) {
    return this.root.getByRole("button", { name: new RegExp(`^Edit piece ${number}:`) });
  }

  async addPiece() {
    await test.step("add a bike piece", async () => {
      await this.root.getByRole("button", { name: "Add piece" }).click();
    });
  }

  /** Switch the open bike piece to a custom interval. */
  async customInterval({ rounds, work, rest }: { rounds: number; work: number; rest: number }) {
    await test.step(`set the piece to ${rounds} × ${work}/${rest}`, async () => {
      await this.root.getByRole("combobox", { name: "Piece" }).selectOption({ label: "Custom…" });
      const fields = [
        ["rounds", rounds],
        ["work seconds", work],
        ["rest seconds", rest],
      ] as const;
      for (const [name, value] of fields) {
        await this.root.getByRole("spinbutton", { name, exact: true }).fill(String(value));
      }
    });
  }

  /** Tap a collapsed exercise to jump the cursor to it. */
  async open() {
    await this.root.getByRole("button").first().click();
  }

  async log() {
    await test.step("log the active set", async () => {
      const button = this.root.getByRole("button", { name: "LOG", exact: true });
      await expect(button).toBeEnabled();
      await button.click();
    });
  }

  async skip() {
    await test.step("skip this exercise", async () => {
      await this.root.getByRole("button", { name: /^Skip/ }).click();
    });
  }

  async fillBike(readout: BikeReadout) {
    await test.step("type the bike console readout", async () => {
      const fields = [
        ["avg watts", readout.avgWatts],
        ["max watts", readout.maxWatts],
        ["avg cadence", readout.avgRpm],
        ["distance mi", readout.distanceMi],
        ["calories", readout.calories],
      ] as const;
      // Everything but the average sits behind "More numbers".
      const extras = fields.some(([caption, value]) => caption !== "avg watts" && value !== undefined);
      const more = this.root.getByRole("button", { name: /^More numbers/ });
      if (extras && (await more.getAttribute("aria-expanded")) !== "true") await more.click();
      for (const [caption, value] of fields) {
        if (value !== undefined) await this.readout(caption).fill(String(value));
      }
      if (readout.effort !== undefined) {
        await this.root
          .getByRole("group", { name: "Piece effort" })
          .getByRole("button", { name: `Piece effort ${readout.effort} of 10` })
          .click();
      }
    });
  }

  private async menu(item: "Swap exercise" | "Remove from session") {
    await this.root.getByRole("button", { name: / actions$/ }).first().click();
    await this.page.getByRole("menuitem", { name: item }).click();
  }

  async swapTo(exerciseName: string) {
    await test.step(`swap to ${exerciseName}`, async () => {
      await this.menu("Swap exercise");
      await pickExercise(this.page, exerciseName);
    });
  }

  async remove() {
    await test.step("remove the exercise", async () => {
      await this.menu("Remove from session");
      await this.page.getByRole("dialog").getByRole("button", { name: "Remove", exact: true }).click();
    });
  }
}

/** Choose a variant in the exercise picker dialog. */
async function pickExercise(page: Page, exerciseName: string) {
  const dialog = page.getByRole("dialog", { name: "Pick an exercise" });
  await dialog.getByPlaceholder(/search/i).fill(exerciseName);
  await dialog.getByRole("button", { name: new RegExp(`^${escape(exerciseName)}\\b`) }).first().click();
  await expect(dialog).toBeHidden();
}

function escape(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** A session's exercise list + actions: the solo runner or one board card. */
export class SessionView {
  constructor(
    readonly page: Page,
    readonly root: Locator,
  ) {}

  /** The exercise being worked on now (`aria-current="step"`). */
  get current() {
    return new Block(this.page, this.root.locator('[aria-current="step"]'));
  }

  /** An exercise block by its display name. */
  block(name: string) {
    return new Block(this.page, this.root.getByRole("listitem", { name, exact: true }));
  }

  async expectCurrent(name: string) {
    await expect(this.current.root).toHaveAccessibleName(name);
  }

  async addExercise(exerciseName: string) {
    await test.step(`add ${exerciseName}`, async () => {
      await this.root.getByRole("button", { name: "Add exercise" }).click();
      await pickExercise(this.page, exerciseName);
    });
  }

  /** Log the current set `times` times, moving with the cursor. */
  async logCurrent(times = 1) {
    for (let i = 0; i < times; i++) await this.current.log();
  }
}

/** The solo runner at /workout/session/[id]. */
export class SoloRunner extends SessionView {
  constructor(page: Page) {
    super(page, page.locator("body"));
  }

  async finish({ rpe }: { rpe: number }) {
    await test.step(`finish the session at RPE ${rpe}`, async () => {
      const endEarly = this.page.getByRole("button", { name: "End early" });
      if (await endEarly.isVisible()) await endEarly.click();
      await chooseEffort(this.page, rpe);
      await this.page.getByRole("button", { name: "Finish session" }).click();
    });
  }

  /** Discard via the runner's confirm prompt (a native dialog). */
  async discard() {
    await test.step("discard the session", async () => {
      this.page.once("dialog", (dialog) => void dialog.accept());
      await this.page.getByRole("button", { name: "Discard" }).click();
    });
  }
}

/** One person's card on the group board. */
export class PersonCard extends SessionView {
  constructor(
    page: Page,
    readonly firstName: string,
  ) {
    super(page, page.getByRole("region", { name: `${firstName}'s workout` }));
  }

  async finish({ rpe }: { rpe: number }) {
    await test.step(`finish ${this.firstName} at RPE ${rpe}`, async () => {
      await this.root.getByRole("button", { name: /^Finish/ }).first().click();
      await chooseEffort(this.page, rpe, this.root);
      await this.root.getByRole("button", { name: `Finish ${this.firstName}` }).click();
    });
  }

  /** The finished card's recap link — present only once the session is saved. */
  get recapLink() {
    return this.root.getByRole("link", { name: "recap" });
  }
}

async function chooseEffort(page: Page, rpe: number, scope: Locator = page.locator("body")) {
  await scope
    .getByRole("group", { name: "Session effort" })
    .getByRole("button", { name: `Session effort ${rpe} of 10` })
    .click();
}
