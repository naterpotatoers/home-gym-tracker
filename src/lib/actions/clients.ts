"use server";

import { redirect } from "next/navigation";
import { CLIENT_COLORS } from "../data/clients";
import { supabase } from "../db/client";
import { slugId } from "../ids";
import { localTodayIso } from "../periods";
import { assertNoRefs, revalidateAll, run } from "./_helpers";

const LEVELS = new Set(["beginner", "intermediate", "advanced"]);
const GOALS = new Set(["general-fitness", "strength", "hypertrophy", "fat-loss"]);
const COLORS = new Set<string>(CLIENT_COLORS.map((c) => c.hex));

/** Client ids used to be a compile-time union; now they're rows, so actions
 *  that take one verify it exists before writing. */
export async function assertClientId(id: string): Promise<void> {
  const data = await run(
    "checking client",
    supabase.from("clients").select("id").eq("id", id).maybeSingle(),
  );
  if (!data) throw new Error(`bad client id ${id}`);
}

function parseProfile(formData: FormData) {
  const firstName = String(formData.get("firstName") ?? "").trim();
  const dateOfBirth = String(formData.get("dateOfBirth") ?? "");
  const heightInches = Number(formData.get("heightInches") ?? 0);
  const experienceLevel = String(formData.get("experienceLevel") ?? "");
  const goal = String(formData.get("goal") ?? "");
  const color = String(formData.get("color") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();

  if (!firstName) throw new Error("A client needs a name.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth)) throw new Error("Pick a date of birth.");
  if (!Number.isFinite(heightInches) || heightInches < 24 || heightInches > 96) {
    throw new Error("Height must be between 24 and 96 inches.");
  }
  if (!LEVELS.has(experienceLevel)) throw new Error(`bad level ${experienceLevel}`);
  if (!GOALS.has(goal)) throw new Error(`bad goal ${goal}`);
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
  await run(
    "adding client",
    supabase.from("clients").insert({
      id: slugId("c", profile.first_name),
      ...profile,
      last_name: "",
      status: "active",
      join_date: localTodayIso(),
      is_trainer: false,
    }),
  );
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
