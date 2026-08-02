import type { MuscleId } from "./types";

/**
 * Stylized front/back body maps for the muscle heat map. Schematic "anatomy
 * chart" blobs, not realism — each region only has to be recognizable and
 * tappable.
 *
 * Both views share a `0 0 200 440` viewBox with the midline at x=100.
 * Bilateral regions are authored LEFT side only with `mirror: true` — the
 * renderer draws them twice, the second time under
 * `transform="translate(200,0) scale(-1,1)"`. Midline regions (abs, traps,
 * lower back) are authored full-width with `mirror: false`.
 *
 * Deep muscles that have no honest surface area (rotator cuff, hip flexors,
 * serratus) are small `deep: true` callout circles rendered with a dashed
 * outline.
 *
 * The `Record<MuscleId, …>` shape is deliberate: forgetting a muscle is a
 * compile error, not a silently missing region.
 */

export type BodyView = "front" | "back";

export type MuscleRegion = {
  view: BodyView;
  d: string;
  mirror: boolean;
  deep?: true;
};

/** Open half-outline from head-top to crotch, stroked twice (mirrored) to
 *  form the figure. One per view; front and back share the same contour. */
const HALF_SILHOUETTE =
  "M100 14 C88 14 82 21 82 30 C82 39 88 46 96 49 L96 56 " +
  "C78 60 60 62 50 68 C36 74 28 82 26 92 L22 132 L18 180 L16 198 L32 200 " +
  "L38 142 L44 112 C48 104 52 100 56 100 L62 146 C58 160 52 172 52 188 " +
  "L54 252 L60 318 L54 356 L64 408 L58 428 L84 430 L90 408 L86 354 " +
  "L90 320 L96 258 L100 194";

export const silhouettes: Record<BodyView, string> = {
  front: HALF_SILHOUETTE,
  back: HALF_SILHOUETTE,
};

function circle(cx: number, cy: number, r: number): string {
  return `M${cx - r} ${cy} a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0`;
}

export const bodyMap: Record<MuscleId, readonly MuscleRegion[]> = {
  // ---- chest (front) ------------------------------------------------------
  upper_chest: [
    { view: "front", mirror: true, d: "M62 64 C72 59 86 59 97 62 L97 75 C84 71 70 72 62 77 Z" },
  ],
  mid_chest: [
    { view: "front", mirror: true, d: "M62 79 C72 74 85 73 97 77 L97 93 C86 91 72 89 63 93 Z" },
  ],
  lower_chest: [
    { view: "front", mirror: true, d: "M63 95 C74 92 86 93 97 95 L97 103 C88 109 74 107 65 103 Z" },
  ],

  // ---- back torso ---------------------------------------------------------
  traps: [
    { view: "back", mirror: false, d: "M100 46 C88 50 74 56 62 64 C74 70 84 80 90 92 C94 100 98 108 100 114 C102 108 106 100 110 92 C116 80 126 70 138 64 C126 56 112 50 100 46 Z" },
  ],
  rhomboids: [
    { view: "back", mirror: true, d: "M86 78 C90 75 95 74 97 76 L97 104 C92 100 86 94 83 88 Z" },
  ],
  lats: [
    { view: "back", mirror: true, d: "M60 100 C70 96 82 98 96 106 L97 148 C86 154 72 146 66 132 L58 110 Z" },
  ],
  lower_back: [
    { view: "back", mirror: false, d: "M86 132 C92 128 108 128 114 132 L112 164 C106 170 94 170 88 164 Z" },
  ],

  // ---- shoulders ----------------------------------------------------------
  front_delts: [
    { view: "front", mirror: true, d: "M44 64 C50 60 58 62 60 66 C60 72 56 78 50 80 C44 78 42 70 44 64 Z" },
  ],
  side_delts: [
    { view: "front", mirror: true, d: "M28 74 C28 66 34 62 42 64 C44 70 42 80 38 86 C32 84 28 80 28 74 Z" },
  ],
  rear_delts: [
    { view: "back", mirror: true, d: "M28 72 C28 64 36 60 44 64 C46 72 42 82 36 86 C30 82 28 78 28 72 Z" },
  ],
  rotator_cuff: [
    { view: "back", mirror: true, deep: true, d: circle(65, 80, 5) },
  ],
  serratus: [
    { view: "front", mirror: true, deep: true, d: circle(64, 108, 6) },
  ],

  // ---- arms ---------------------------------------------------------------
  biceps: [
    { view: "front", mirror: true, d: "M32 88 C38 84 46 86 48 92 L46 122 C42 128 36 128 32 122 L30 100 Z" },
  ],
  triceps: [
    { view: "back", mirror: true, d: "M32 86 C38 82 46 84 48 90 L44 122 C40 128 34 126 30 120 L30 98 Z" },
  ],
  forearms: [
    { view: "front", mirror: true, d: "M26 134 C32 130 40 132 42 138 L40 172 C38 178 32 178 28 172 L24 146 Z" },
  ],

  // ---- core (front) -------------------------------------------------------
  abs: [
    { view: "front", mirror: false, d: "M84 112 C90 108 110 108 116 112 L118 162 C112 170 88 170 82 162 Z" },
  ],
  obliques: [
    { view: "front", mirror: true, d: "M64 114 C70 112 78 112 80 116 L80 158 C76 164 68 164 64 158 L62 132 Z" },
  ],

  // ---- hips & legs --------------------------------------------------------
  hip_flexors: [
    { view: "front", mirror: true, deep: true, d: circle(80, 176, 6) },
  ],
  quads: [
    { view: "front", mirror: true, d: "M56 190 C64 184 80 184 86 190 L88 238 L86 298 C80 310 66 310 62 298 L56 244 Z" },
  ],
  adductors: [
    { view: "front", mirror: true, d: "M90 194 C95 191 98 193 98 198 L96 246 C94 254 91 254 89 246 L88 212 Z" },
  ],
  glutes: [
    { view: "back", mirror: true, d: "M60 168 C70 160 88 162 96 170 L97 202 C88 212 68 210 60 200 L58 182 Z" },
  ],
  glute_med: [
    { view: "back", mirror: true, d: "M56 156 C62 150 72 150 76 156 C76 164 70 170 62 168 C56 164 54 160 56 156 Z" },
  ],
  hamstrings: [
    { view: "back", mirror: true, d: "M58 208 C66 202 84 204 92 210 L90 260 L86 304 C78 314 66 312 62 302 L56 250 Z" },
  ],
  calves: [
    { view: "back", mirror: true, d: "M60 330 C68 322 82 324 88 332 L86 372 C82 398 70 398 66 384 L58 352 Z" },
  ],
};
