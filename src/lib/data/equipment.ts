import type {
  Band,
  Bar,
  DumbbellPair,
  Equipment,
  HipBand,
  LoopBand,
  PlatePair,
} from "../types";

export const equipment: readonly Equipment[] = [
  { id: "rack", name: "Rogue Monster Lite Half Rack", owned: true },
  { id: "spotter_arms", name: "SAML-24 Monster Lite Spotter Arms", owned: true },
  { id: "pull_up_bar", name: "Pull-Up Bar (rack integral)", owned: true },
  { id: "dip_bars", name: "Dip Bars", owned: true },
  { id: "ohio_bar", name: "Rogue Ohio Barbell (Black Oxide)", owned: true },
  { id: "bella_bar", name: "Rogue Bella Bar", owned: true },
  { id: "plates", name: "Plate Set", owned: true },
  { id: "dumbbells", name: "Fixed Dumbbells", owned: true },
  { id: "bench", name: "Rep Blackwing Bench (flat)", owned: true },
  { id: "bench_incline", name: "Rep Blackwing Bench (incline)", owned: true },
  { id: "bench_decline", name: "Rep Blackwing Bench (decline)", owned: true },
  { id: "monster_bands", name: "Rogue Monster Loop Bands", owned: true },
  { id: "hip_bands", name: "Rogue Hip Bands", owned: true },
  { id: "floor", name: "Floor / Mat", owned: true },
];

export const bars: readonly Bar[] = [
  { id: "ohio_bar", name: "Rogue Ohio Barbell", weightLbs: 45 },
  { id: "bella_bar", name: "Rogue Bella Bar", weightLbs: 33 },
];

/**
 * One pair of each size. In 1.25 lb units the per-side set is
 * {1, 2, 4, 8, 12, 20, 28, 36, 44} — the 1/2/4/8 block covers 0-15 with no
 * gaps and every larger plate shifts that window by less than its own width,
 * so loadable weights are contiguous on a 2.5 lb grid all the way up.
 * Adding or losing a size is a one-line edit; `loadableWeights()` re-derives.
 */
export const plates: readonly PlatePair[] = [
  { weightLbs: 55, pairs: 1 },
  { weightLbs: 45, pairs: 1 },
  { weightLbs: 35, pairs: 1 },
  { weightLbs: 25, pairs: 1 },
  { weightLbs: 15, pairs: 1 },
  { weightLbs: 10, pairs: 1 },
  { weightLbs: 5, pairs: 1 },
  { weightLbs: 2.5, pairs: 1 },
  { weightLbs: 1.25, pairs: 1 },
];

/**
 * Fixed pairs, so the step is 5 lb per hand — 10 lb total. Worth noting that
 * this makes the BARBELL the finer progression tool (2.5 lb steps), which
 * inverts the usual beginner advice: pick dumbbells for stability, range of
 * motion, and asymmetry work, not for load precision.
 */
export const dumbbells: readonly DumbbellPair[] = [
  { weightLbs: 3 },
  { weightLbs: 5 },
  { weightLbs: 8 },
  { weightLbs: 10 },
  { weightLbs: 15 },
  { weightLbs: 20 },
  { weightLbs: 25 },
  { weightLbs: 30 },
  { weightLbs: 35 },
  { weightLbs: 40 },
  { weightLbs: 45 },
  { weightLbs: 50 },
];

/** Full-length loop bands. Tension is a range because it rises with stretch —
 *  a single number would overstate the precision. Doubles as an assisted
 *  pull-up stack: orange (~9 lb) through green (~40 lb) is a real ladder from
 *  "can't do one" to unassisted. */
export const loopBands: readonly LoopBand[] = [
  {
    id: "band_orange",
    family: "monster",
    label: "Orange",
    model: "Micro #0",
    minLbs: 5,
    maxLbs: 15,
    loadPrecision: "approximate",
  },
  {
    id: "band_red",
    family: "monster",
    label: "Red",
    model: "Mini #1",
    minLbs: 10,
    maxLbs: 25,
    loadPrecision: "approximate",
  },
  {
    id: "band_blue",
    family: "monster",
    label: "Blue",
    model: "Monster Mini #2",
    minLbs: 20,
    maxLbs: 40,
    loadPrecision: "approximate",
  },
  {
    id: "band_green",
    family: "monster",
    label: "Green",
    model: "#3",
    minLbs: 30,
    maxLbs: 50,
    loadPrecision: "approximate",
  },
];

/**
 * Woven hip bands. No lb rating exists, so difficulty is ordinal — you can say
 * "moved from medium to small" but not "load went up 20%".
 *
 * SMALLER IS HARDER. `sizeInches` is the only source of truth and rank is
 * derived from it (see `hipBandsByDifficulty`), so there is no intensity string
 * to drift out of sync. A 16" large would slot in as the easiest.
 */
export const hipBands: readonly HipBand[] = [
  {
    id: "hip_band_small",
    family: "hip",
    label: "Green/Black",
    sizeInches: 12,
    loadPrecision: "ordinal",
  },
  {
    id: "hip_band_medium",
    family: "hip",
    label: "Black/Red",
    sizeInches: 14,
    loadPrecision: "ordinal",
  },
];

export const bands: readonly Band[] = [...loopBands, ...hipBands];

/** Easiest first. Derived by descending circumference, never hand-maintained. */
export const hipBandsByDifficulty: readonly HipBand[] = [...hipBands].sort(
  (a, b) => b.sizeInches - a.sizeInches,
);

/** 1-based difficulty rank per hip band id, easiest = 1. */
export const hipBandRank = new Map(
  hipBandsByDifficulty.map((b, i) => [b.id, i + 1]),
);

export const barById = new Map(bars.map((b) => [b.id, b]));
export const bandById = new Map(bands.map((b) => [b.id, b]));

export const ownedEquipmentIds = new Set(
  equipment.filter((e) => e.owned).map((e) => e.id),
);

