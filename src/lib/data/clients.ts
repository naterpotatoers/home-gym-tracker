import type { Client, WeighIn } from "../types";

/**
 * `dateOfBirth` is stored rather than age so it never goes stale — derive age
 * at read time. Bodyweight is deliberately NOT here: it lives in `weighIns`
 * below, because storing "the most recent weigh-in" on the profile overwrites
 * history and makes both bodyweight trends and relative-strength stats
 * impossible.
 */
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

export const clientById = new Map(clients.map((c) => [c.id, c]));
