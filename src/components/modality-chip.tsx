import { MODALITY_COLORS, modalityById } from "@/lib/data/modalities";
import type { ModalityId } from "@/lib/types";

/**
 * Modality tag with a color-tinted background box — identity color, not
 * status. The tint mixes toward the theme surface so it reads in light and
 * dark; text stays foreground for contrast.
 */
export function ModalityChip({ modalityId }: { modalityId: ModalityId }) {
  const hex = MODALITY_COLORS[modalityId];
  return (
    <span
      className="whitespace-nowrap rounded border px-1.5 py-0.5 text-xs"
      style={{
        backgroundColor: `color-mix(in oklab, ${hex} 16%, var(--surface))`,
        borderColor: `color-mix(in oklab, ${hex} 45%, transparent)`,
      }}
    >
      {modalityById.get(modalityId)?.name ?? modalityId}
    </span>
  );
}
