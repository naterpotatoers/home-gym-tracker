/** Small stroke icons for inline action buttons and nav — one style. */

export function iconProps(size = 18) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
  } as const;
}

export function PencilIcon() {
  return (
    <svg {...iconProps()} aria-hidden>
      <path d="M17 3l4 4L8 20l-5 1 1-5L17 3z" />
    </svg>
  );
}

export function TrashIcon() {
  return (
    <svg {...iconProps()} aria-hidden>
      <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m3 0l-1 13a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1L6 7M10 11v6M14 11v6" />
    </svg>
  );
}
