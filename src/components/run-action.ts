"use client";

import { unstable_rethrow } from "next/navigation";
import { errorMessage } from "@/lib/format";

/**
 * Await a server action from an event handler. Next's redirect/notFound
 * signals pass through (many actions redirect on success — reporting that
 * throw would show a successful delete as "Delete failed."); any other
 * failure goes to `onError` as a message. Resolves true on a plain success.
 */
export async function runAction(
  action: () => Promise<unknown>,
  onError: (message: string) => void,
  fallback: string,
): Promise<boolean> {
  try {
    await action();
    return true;
  } catch (e) {
    unstable_rethrow(e);
    onError(errorMessage(e, fallback));
    return false;
  }
}
