import type { Client, WeighIn } from "../types";

/**
 * `dateOfBirth` is stored rather than age so it never goes stale — derive age
 * at read time. Bodyweight is deliberately NOT here: it lives in `weighIns`
 * below, because storing "the most recent weigh-in" on the profile overwrites
 * history and makes both bodyweight trends and relative-strength stats
 * impossible.
 */
/** Preset card colors — curated so none collides with the status hues
 *  (success/warning/danger) that carry meaning elsewhere in the UI. */
export const CLIENT_COLORS = [
  { id: "red", hex: "#FF0000" },
  { id: "blue", hex: "#0000FF" },
  { id: "green", hex: "#00FF00" },
  { id: "purple", hex: "#B200ED" },
  { id: "yellow", hex: "#FFFF00" },
] as const;

/** Seed roster: the app falls back to this list read-only while the clients
 *  table doesn't exist; on a live database people are managed at /users. */
export const clients: readonly Client[] = [
  {
    id: "lidia",
    firstName: "Lidia",
    lastName: "",
    status: "active",
    joinDate: "2025-01-15",
    dateOfBirth: "1995-06-01",
    heightInches: 64,
    experienceLevel: "beginner",
    goal: "general-fitness",
    isTrainer: false,
    color: "#ec4899",
    notes: "",
  },
  {
    id: "gabriel",
    firstName: "Gabriel",
    lastName: "",
    status: "active",
    joinDate: "2026-05-10",
    dateOfBirth: "1993-03-15",
    heightInches: 72,
    experienceLevel: "beginner",
    goal: "strength",
    isTrainer: false,
    color: "#14b8a6",
    notes: "",
  },
  {
    id: "vivica",
    firstName: "Vivica",
    lastName: "",
    status: "active",
    joinDate: "2026-02-14",
    dateOfBirth: "1998-09-20",
    heightInches: 66,
    experienceLevel: "beginner",
    goal: "hypertrophy",
    isTrainer: false,
    color: "#8b5cf6",
    notes: "",
  },
  {
    id: "nate",
    firstName: "Nate",
    lastName: "",
    status: "active",
    joinDate: "2024-11-01",
    dateOfBirth: "1992-01-10",
    heightInches: 71,
    experienceLevel: "intermediate",
    goal: "strength",
    isTrainer: true,
    color: "#3987e5",
    notes: "",
  },
];

/** Bodyweight history. Latest is derived, never stored on the profile. */
export const weighIns: readonly WeighIn[] = [
  { id: "wi_lidia_1", clientId: "lidia", date: "2026-06-01", bodyweightLbs: 137 },
  { id: "wi_lidia_2", clientId: "lidia", date: "2026-07-01", bodyweightLbs: 136 },
  { id: "wi_lidia_3", clientId: "lidia", date: "2026-07-28", bodyweightLbs: 135 },

  { id: "wi_gabriel_1", clientId: "gabriel", date: "2026-05-10", bodyweightLbs: 178 },
  { id: "wi_gabriel_2", clientId: "gabriel", date: "2026-06-14", bodyweightLbs: 176.5 },
  { id: "wi_gabriel_3", clientId: "gabriel", date: "2026-07-26", bodyweightLbs: 175 },

  { id: "wi_vivica_1", clientId: "vivica", date: "2026-02-14", bodyweightLbs: 143 },
  { id: "wi_vivica_2", clientId: "vivica", date: "2026-05-01", bodyweightLbs: 141.5 },
  { id: "wi_vivica_3", clientId: "vivica", date: "2026-07-25", bodyweightLbs: 140 },

  { id: "wi_nate_1", clientId: "nate", date: "2026-05-02", bodyweightLbs: 182 },
  { id: "wi_nate_2", clientId: "nate", date: "2026-06-01", bodyweightLbs: 183.5 },
  { id: "wi_nate_3", clientId: "nate", date: "2026-07-01", bodyweightLbs: 184 },
  { id: "wi_nate_4", clientId: "nate", date: "2026-07-27", bodyweightLbs: 185 },
];
