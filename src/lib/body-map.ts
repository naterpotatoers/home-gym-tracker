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
 *  form the figure. One per view; front and back share the same contour:
 *  head, neck, trapezius slope, a rounded deltoid cap, upper arm, forearm,
 *  hand, then back up the inner arm to the armpit, lat flare, waist, hip
 *  and leg. */
const HALF_SILHOUETTE =
  "M100 14 C88 14 82 21 82 30 C82 39 88 46 96 49 L96 56 " +
  "C86 59 70 61 58 64 C44 66 32 74 30 90 C29 104 27 120 26 132 " +
  "C24 150 21 168 20 184 C19 192 20 202 26 204 C31 205 34 200 34 194 " +
  "C35 178 38 158 40 140 C42 124 44 112 47 104 C49 100 52 98 56 98 " +
  "C58 112 60 128 62 144 C59 160 53 172 52 188 " +
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
    { view: "front", mirror: true, d: "M63 67 C73 62 86 62 97 64 L97 76 C84 72 72 73 63 78 Z" },
  ],
  mid_chest: [
    { view: "front", mirror: true, d: "M63 80 C72 75 85 74 97 78 L97 93 C86 91 73 89 64 93 Z" },
  ],
  lower_chest: [
    { view: "front", mirror: true, d: "M64 95 C74 92 86 93 97 95 L97 103 C88 109 75 107 66 103 Z" },
  ],

  // ---- back torso (non-overlapping: traps above, rhomboids under the
  //      trap's lower edge, lats around them, lower back below) ------------
  traps: [
    { view: "back", mirror: false, d: "M100 52 L97 57 C86 60 74 62 63 66 C72 70 80 75 86 81 C91 88 96 96 100 104 C104 96 109 88 114 81 C120 75 128 70 137 66 C126 62 114 60 103 57 Z" },
  ],
  rhomboids: [
    { view: "back", mirror: true, d: "M85 85 C90 91 95 99 98 107 L98 117 C91 115 85 111 81 106 L80 93 C81 89 83 86 85 85 Z" },
  ],
  lats: [
    { view: "back", mirror: true, d: "M58 101 C64 97 72 96 78 97 L78 108 C84 114 90 119 98 122 L98 127 C93 128 89 130 85 133 L83 148 C76 150 69 147 65 140 L61 120 Z" },
  ],
  lower_back: [
    { view: "back", mirror: false, d: "M87 135 C93 131 107 131 113 135 L112 162 C106 168 94 168 88 162 Z" },
  ],

  // ---- shoulders (inside the deltoid cap) ---------------------------------
  front_delts: [
    { view: "front", mirror: true, d: "M57 67 C60 70 61 76 60 82 C58 89 53 95 47 98 C44 91 44 82 46 75 C49 70 53 67 57 67 Z" },
  ],
  side_delts: [
    { view: "front", mirror: true, d: "M44 71 C41 77 40 87 41 99 C37 100 34 98 32 94 C32 83 36 75 44 71 Z" },
  ],
  rear_delts: [
    { view: "back", mirror: true, d: "M58 67 C55 75 51 86 46 97 C41 98 36 97 32 94 C32 82 38 73 47 69 C51 67 55 67 58 67 Z" },
  ],
  rotator_cuff: [
    { view: "back", mirror: true, deep: true, d: circle(68, 82, 5) },
  ],
  serratus: [
    { view: "front", mirror: true, deep: true, d: circle(64, 110, 5) },
  ],

  // ---- arms ---------------------------------------------------------------
  biceps: [
    { view: "front", mirror: true, d: "M35 104 C38 101 43 101 45 106 L42 127 C40 132 34 132 32 128 L31 112 Z" },
  ],
  triceps: [
    { view: "back", mirror: true, d: "M34 101 C38 99 43 100 45 105 L42 128 C39 133 33 132 31 127 L30 111 Z" },
  ],
  forearms: [
    { view: "front", mirror: true, d: "M27 140 C31 136 37 136 39 140 L37 170 C35 177 28 177 24 172 L23 155 Z" },
  ],

  // ---- core (front) -------------------------------------------------------
  abs: [
    { view: "front", mirror: false, d: "M84 112 C90 108 110 108 116 112 L118 162 C112 170 88 170 82 162 Z" },
  ],
  obliques: [
    { view: "front", mirror: true, d: "M64 118 C70 115 77 115 80 118 L80 158 C76 164 69 164 65 158 L63 136 Z" },
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
    { view: "back", mirror: true, d: "M58 177 C68 172 86 172 97 177 L97 205 C88 214 68 212 60 204 L57 190 Z" },
  ],
  glute_med: [
    { view: "back", mirror: true, d: "M62 156 C68 152 78 152 84 156 C85 162 80 167 72 168 C66 168 62 163 62 156 Z" },
  ],
  hamstrings: [
    { view: "back", mirror: true, d: "M58 217 C66 214 84 214 92 217 L90 262 L86 304 C78 314 66 312 62 302 L56 252 Z" },
  ],
  calves: [
    { view: "back", mirror: true, d: "M61 330 C68 324 80 325 86 332 L85 372 C81 396 71 396 67 384 L59 352 Z" },
  ],
  tibialis: [
    { view: "front", mirror: true, d: "M62 328 C68 322 78 324 84 330 L82 372 C78 394 68 394 64 382 L58 350 Z" },
  ],
};
