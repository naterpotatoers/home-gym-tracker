"use server";

import { revalidatePath } from "next/cache";
import { CLIENT_COLORS } from "../data/clients";
import { supabase } from "../db/client";
import { slugId } from "../ids";
import { localTodayIso } from "../periods";

const LEVELS = new Set(["beginner", "intermediate", "advanced"]);
const GOALS = new Set(["general-fitness", "strength", "hypertrophy", "fat-loss"]);
const COLORS = new Set<string>(CLIENT_COLORS.map((c) => c.hex));

/** Client ids used to be a compile-time union; now they're rows, so actions
 *  that take one verify it exists before writing. */
export async function assertClientId(id: string): Promise<void> {
  const { data, error } = await supabase
    .from("clients")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`checking client: ${error.message}`);
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

  if (!firstName) throw new Error("A person needs a name.");
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
  const { error } = await supabase.from("clients").insert({
    id: slugId("c", profile.first_name),
    ...profile,
    last_name: "",
    status: "active",
    join_date: localTodayIso(),
    is_trainer: false,
  });
  if (error) throw new Error(`adding person: ${error.message}`);
  revalidatePath("/", "layout");
}

export async function updateClient(
  clientId: string,
  formData: FormData,
): Promise<void> {
  const profile = parseProfile(formData);
  const { error } = await supabase
    .from("clients")
    .update(profile)
    .eq("id", clientId);
  if (error) throw new Error(`updating person: ${error.message}`);
  revalidatePath("/", "layout");
}
