"use server";

import { revalidatePath } from "next/cache";
import { supabase } from "../db/client";
import { weighInToRow } from "../db/mappers";
import { newId } from "../ids";
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
  const { error } = await supabase
    .from("weigh_ins")
    .insert(weighInToRow({ id: newId("wi"), clientId, date, bodyweightLbs }));
  if (error) throw new Error(`logging weigh-in: ${error.message}`);
  revalidatePath("/", "layout");
}

export async function deleteWeighIn(id: string): Promise<void> {
  const { error } = await supabase.from("weigh_ins").delete().eq("id", id);
  if (error) throw new Error(`deleting weigh-in: ${error.message}`);
  revalidatePath("/", "layout");
}
