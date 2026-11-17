"use server";

import { redirect } from "next/navigation";
import { supabase } from "../db/client";
import type { ClientRow } from "../db/mappers";
import { slugId } from "../ids";
import { localTodayIso } from "../periods";
import { parseProfile } from "../validate";
import type { FormResult } from "../form-result";
import { assertNoRefs, revalidateAll, run, runMatched } from "./_helpers";

/** Add a person, then land on their Progress tab. */
export async function createClient(formData: FormData): Promise<FormResult> {
  const profile = parseProfile(formData);
  if ("error" in profile) return profile;
  const row: ClientRow = {
    id: slugId("c", profile.first_name),
    ...profile,
    last_name: "",
    status: "active",
    join_date: localTodayIso(),
    is_trainer: false,
  };
  await run("adding client", supabase.from("clients").insert(row));
  revalidateAll();
  redirect(`/users?client=${encodeURIComponent(row.id)}`);
}

export async function updateClient(
  clientId: string,
  formData: FormData,
): Promise<FormResult> {
  // The color the person already has stays valid even if it's no longer a
  // preset — re-saving a profile must never be what wipes it.
  const current = await run(
    "loading client",
    supabase.from("clients").select("color").eq("id", clientId).maybeSingle(),
  );
  const profile = parseProfile(formData, (current as { color: string | null } | null)?.color);
  if ("error" in profile) return profile;
  await runMatched(
    "updating client",
    supabase.from("clients").update(profile).eq("id", clientId).select("id"),
  );
  revalidateAll();
  return null;
}

/** Remove a person with no history — the "throwaway test user" path. Anyone
 *  with logged data is refused; discard/delete that first (or keep them and
 *  set status inactive). */
export async function deleteClient(clientId: string): Promise<void> {
  await assertNoRefs(
    "sessions",
    "client_id",
    clientId,
    "This client has workout sessions — discard those first.",
  );
  await assertNoRefs(
    "assignments",
    "client_id",
    clientId,
    "This client has program assignments — remove those first.",
  );
  await assertNoRefs(
    "weigh_ins",
    "client_id",
    clientId,
    "This client has body weight entries — delete those first.",
  );
  await assertNoRefs(
    "food_logs",
    "client_id",
    clientId,
    "This client has food log entries — delete those first.",
    { optionalTable: true },
  );
  await assertNoRefs(
    "runs",
    "client_id",
    clientId,
    "This client has runs — delete those first.",
    { optionalTable: true },
  );
  await run("deleting client", supabase.from("clients").delete().eq("id", clientId));
  revalidateAll();
  redirect("/users");
}
