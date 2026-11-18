import { describe, expect, it } from "vitest";
import { bodyMap, silhouettes } from "./body-map";
import { muscles } from "./data/muscles";

describe("bodyMap", () => {
  it("maps every muscle to at least one region", () => {
    for (const muscle of muscles) {
      const regions = bodyMap[muscle.id];
      expect(regions, muscle.id).toBeDefined();
      expect(regions.length, muscle.id).toBeGreaterThan(0);
    }
  });

  it("keeps each muscle on exactly one view (front or back)", () => {
    for (const muscle of muscles) {
      const views = new Set(bodyMap[muscle.id].map((r) => r.view));
      expect(views.size, muscle.id).toBe(1);
    }
  });

  it("every region has a non-empty path", () => {
    for (const muscle of muscles) {
      for (const region of bodyMap[muscle.id]) {
        expect(region.d.length, muscle.id).toBeGreaterThan(0);
      }
    }
  });
});

// ---- geometry: regions stay inside the figure and never overlap ----------

type Pt = [number, number];

/** Sample an SVG path: absolute M/L/C/Z plus the relative semicircle `a`
 *  pairs `circle()` emits — everything body-map.ts authors. */
function sampleOutline(d: string, steps = 16): Pt[] {
  const tokens = d.match(/[MLCZa]|-?\d*\.?\d+/g) ?? [];
  const pts: Pt[] = [];
  let cur: Pt = [0, 0];
  let i = 0;
  const num = () => Number(tokens[i++]);
  while (i < tokens.length) {
    const cmd = tokens[i++];
    if (cmd === "M" || cmd === "L") {
      cur = [num(), num()];
      pts.push(cur);
    } else if (cmd === "C") {
      const c1: Pt = [num(), num()];
      const c2: Pt = [num(), num()];
      const end: Pt = [num(), num()];
      for (let s = 1; s <= steps; s++) {
        const t = s / steps;
        const u = 1 - t;
        const at = (k: 0 | 1) => u * u * u * cur[k] + 3 * u * u * t * c1[k] + 3 * u * t * t * c2[k] + t * t * t * end[k];
        pts.push([at(0), at(1)]);
      }
      cur = end;
    } else if (cmd === "a") {
      const r = num();
      i += 3; // ry, rotation, large-arc
      const sweep = num();
      const end: Pt = [cur[0] + num(), cur[1] + num()];
      const cx = (cur[0] + end[0]) / 2;
      const cy = (cur[1] + end[1]) / 2;
      const a0 = Math.atan2(cur[1] - cy, cur[0] - cx);
      for (let s = 1; s <= steps; s++) {
        const a = a0 + (sweep ? 1 : -1) * Math.PI * (s / steps);
        pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
      }
      cur = end;
    }
  }
  return pts;
}

function contains(poly: Pt[], [x, y]: Pt): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

function distanceToEdge(poly: Pt[], p: Pt): number {
  let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, ay] = poly[j];
    const [bx, by] = poly[i];
    const dx = bx - ax;
    const dy = by - ay;
    const t = Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - ay) * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(p[0] - (ax + t * dx), p[1] - (ay + t * dy)));
  }
  return best;
}

const flip = (pts: Pt[]): Pt[] => pts.map(([x, y]) => [200 - x, y]);

describe("bodyMap geometry", () => {
  for (const view of ["front", "back"] as const) {
    const half = sampleOutline(silhouettes[view]);
    const figure = [...half, ...flip(half).reverse()];
    const regions = muscles.flatMap((m) =>
      bodyMap[m.id]
        .filter((r) => r.view === view)
        .flatMap((r) => {
          const outline = sampleOutline(r.d);
          const copies = r.mirror ? [outline, flip(outline)] : [outline];
          return copies.map((poly) => ({ id: m.id, poly, deep: r.deep ?? false }));
        }),
    );

    it(`${view}: every region sits inside the figure (≤1 unit of slack — the clip path trims the rest)`, () => {
      for (const { id, poly } of regions) {
        const worst = Math.max(0, ...poly.filter((p) => !contains(figure, p)).map((p) => distanceToEdge(figure, p)));
        expect(worst, id).toBeLessThanOrEqual(1);
      }
    });

    it(`${view}: surface regions never overlap (an unfilled muscle can't show its neighbor's color)`, () => {
      const owner = new Map<string, string>();
      const shared = new Set<string>();
      for (const { id, poly, deep } of regions) {
        if (deep) continue;
        const xs = poly.map((p) => p[0]);
        const ys = poly.map((p) => p[1]);
        for (let y = Math.floor(Math.min(...ys)) + 0.5; y < Math.max(...ys); y++) {
          for (let x = Math.floor(Math.min(...xs)) + 0.5; x < Math.max(...xs); x++) {
            if (!contains(poly, [x, y])) continue;
            const key = `${x},${y}`;
            const prev = owner.get(key);
            if (prev && prev !== id) shared.add([prev, id].sort().join(" + "));
            owner.set(key, id);
          }
        }
      }
      expect([...shared]).toEqual([]);
    });
  }
});
