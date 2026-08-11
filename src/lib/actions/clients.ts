"use server";

import { redirect } from "next/navigation";
import { CLIENT_COLORS, clients as seedClients } from "../data/clients";
import { supabase } from "../db/client";
import type { ClientRow } from "../db/mappers";
import { slugId } from "../ids";
import { localTodayIso } from "../periods";
import { isExperienceLevel, isGoal, isIsoDate } from "../validate";
import { assertNoRefs, revalidateAll, run } from "./_helpers";

const COLORS = new Set<string>(CLIENT_COLORS.map((c) => c.hex));

/** Client ids used to be a compile-time union; now they're rows, so actions
 *  that take one verify it exists before writing. Falls back to the TS seed
 *  roster while the clients table doesn't exist (PGRST205), mirroring
 *  assertExerciseIds and the read-side fallback. */
export async function assertClientId(id: string): Promise<void> {
  const { data, error } = await supabase
    .from("clients")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (error?.code === "PGRST205") {
    if (!seedClients.some((c) => c.id === id)) throw new Error(`bad client id ${id}`);
    return;
  }
  if (error) throw new Error(`checking client: ${error.message}`);
  if (!data) throw new Error(`bad client id ${id}`);
}

/** The editable profile columns, typed against ClientRow so the snake_case
 *  keys can't drift from the mapper/schema. */
type ProfileRow = Pick<
  ClientRow,
  | "first_name"
  | "date_of_birth"
  | "height_inches"
  | "experience_level"
  | "goal"
  | "color"
  | "notes"
>;

function parseProfile(formData: FormData): ProfileRow {
  const firstName = String(formData.get("firstName") ?? "").trim();
  const dateOfBirth = String(formData.get("dateOfBirth") ?? "");
  const heightInches = Number(formData.get("heightInches") ?? 0);
  const experienceLevel = String(formData.get("experienceLevel") ?? "");
  const goal = String(formData.get("goal") ?? "");
  const color = String(formData.get("color") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();

  if (!firstName) throw new Error("A client needs a name.");
  if (!isIsoDate(dateOfBirth)) throw new Error("Pick a date of birth.");
  if (!Number.isFinite(heightInches) || heightInches < 24 || heightInches > 96) {
    throw new Error("Height must be between 24 and 96 inches.");
  }
  if (!isExperienceLevel(experienceLevel)) throw new Error(`bad level ${experienceLevel}`);
  if (!isGoal(goal)) throw new Error(`bad goal ${goal}`);
  if (color !== "" && !COLORS.has(color)) throw new Error(`bad color ${color}`);

  return {
    first_name: firstName,
    date_of_birth: dateOfBirth,
    height_inches: heightInches,
    experience_level: experienceLevel,
    goal,
    color: color || null,
    notes,
  };
}

export async function createClient(formData: FormData): Promise<void> {
  const profile = parseProfile(formData);
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
}

export async function updateClient(
  clientId: string,
  formData: FormData,
): Promise<void> {
  const profile = parseProfile(formData);
  await run(
    "updating client",
    supabase.from("clients").update(profile).eq("id", clientId),
  );
  revalidateAll();
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
  await run("deleting client", supabase.from("clients").delete().eq("id", clientId));
  revalidateAll();
  redirect("/users");
}
