import { sweepLeftovers } from "./support/world";

/** Before a run: remove e2e worlds a crashed or killed run left behind. */
export default async function globalSetup() {
  const removed = await sweepLeftovers();
  if (removed > 0) console.log(`e2e: swept ${removed} leftover test rows`);
}
