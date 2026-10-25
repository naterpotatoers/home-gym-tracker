"use server";

import { supabase } from "../db/client";
import { weighInToRow } from "../db/mappers";
import { newId } from "../ids";
import { revalidateAll, run } from "./_helpers";
import { assertClientId } from "./clients";
import { isIsoDate } from "../validate";
import type { FormResult } from "../form-result";

export async function createWeighIn(
  clientId: string,
  formData: FormData,
): Promise<FormResult> {
  await assertClientId(clientId);
  const date = String(formData.get("date") ?? "");
  const rawWeight = String(formData.get("bodyweightLbs") ?? "").trim();
  const bodyweightLbs = Number(rawWeight);
  if (!isIsoDate(date)) return { error: "Pick a valid date." };
  if (
    rawWeight === "" ||
    !Number.isFinite(bodyweightLbs) ||
    bodyweightLbs < 50 ||
    bodyweightLbs > 1000
  ) {
    return { error: "Body weight must be between 50 and 1000 lb." };
  }
  await run(
    "logging weigh-in",
    supabase
      .from("weigh_ins")
      .insert(weighInToRow({ id: newId("wi"), clientId, date, bodyweightLbs })),
  );
  revalidateAll();
  return null;
}

export async function deleteWeighIn(id: string): Promise<void> {
  await run("deleting weigh-in", supabase.from("weigh_ins").delete().eq("id", id));
  revalidateAll();
}
