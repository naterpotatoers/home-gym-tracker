import type { Page, Request, Response } from "@playwright/test";

/** A server action that writes set rows (updateSetLog / syncSetLogs): its
 *  arguments carry SetLog objects, which always have a `sessionId`. Reads
 *  like the swap/add pre-fill lookup don't. */
function isSetSave(request: Request): boolean {
  return (
    request.method() === "POST" &&
    !!request.headers()["next-action"] &&
    (request.postData() ?? "").includes('"sessionId"')
  );
}

/**
 * Hold every set save in flight (never answered) — what slow gym Wi-Fi plus
 * a reload or Safari tab eviction looks like. Held requests are never let
 * through: they die with the next navigation, exactly as on the iPad.
 * `stopHolding()` lets LATER saves through (e.g. the restore after reload).
 */
export async function holdSetSaves(page: Page) {
  let holding = true;
  let held = 0;
  await page.route("**/*", (route) => {
    if (!holding || !isSetSave(route.request())) return route.fallback();
    held++; // never answered
  });
  return {
    get count() {
      return held;
    },
    stopHolding: () => {
      holding = false;
    },
  };
}

/** Record the body size of every set-save response until `stop()`. */
export function watchSetSaveResponses(page: Page) {
  const sizes: Promise<number>[] = [];
  const onResponse = (response: Response) => {
    if (isSetSave(response.request())) sizes.push(response.body().then((body) => body.length));
  };
  page.on("response", onResponse);
  return {
    stop: () => {
      page.off("response", onResponse);
      return Promise.all(sizes);
    },
  };
}
