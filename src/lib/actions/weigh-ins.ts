"use server";

import { supabase } from "../db/client";
import { weighInToRow } from "../db/mappers";
import { newId } from "../ids";
import { revalidateAll, run } from "./_helpers";
import { assertClientId } from "./clients";

export async function createWeighIn(
  clientId: string,
  formData: FormData,
): Promise<void> {
  await assertClientId(clientId);
  const date = String(formData.get("date") ?? "");
  const bodyweightLbs = Number(formData.get("bodyweightLbs"));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Pick a weigh-in date.");
  if (!Number.isFinite(bodyweightLbs) || bodyweightLbs < 50 || bodyweightLbs > 1000) {
    throw new Error("Bodyweight must be between 50 and 1000 lb.");
  }
  await run(
    "logging weigh-in",
    supabase
      .from("weigh_ins")
      .insert(weighInToRow({ id: newId("wi"), clientId, date, bodyweightLbs })),
  );
  revalidateAll();
}

export async function deleteWeighIn(id: string): Promise<void> {
  await run("deleting weigh-in", supabase.from("weigh_ins").delete().eq("id", id));
  revalidateAll();
}
