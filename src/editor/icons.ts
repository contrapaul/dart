// The editor toolbar's icons: small line drawings, 24 by 24, drawn in the
// button's text colour (or the colour the toolbar gives them), so they need
// no image files and follow the theme.

const svg = (body: string) =>
  `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">${body}</svg>`;

export const ICONS = {
  box: svg('<path d="M4 8l8-4 8 4v8l-8 4-8-4z"/><path d="M4 8l8 4 8-4M12 12v8"/>'),
  ramp: svg('<path d="M3 18l11 3 7-4L10 9z"/><path d="M14 21V13L10 9M14 13l7 4"/>'),
  wedge: svg('<path d="M3 17l6 3 12-5-6-3z"/><path d="M9 20l3-12 9 7M12 8l-9 9M12 8l3 4"/>'),
  cylinder: svg('<ellipse cx="12" cy="6" rx="7" ry="2.6"/><path d="M5 6v12c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6V6"/>'),
  stairs: svg('<path d="M3 20h18V5h-5v5h-5v5H6v5"/>'),
  foamers: svg('<rect x="6" y="3" width="12" height="18" rx="6"/><path d="M9 9l2 1M15 9l-2 1"/><circle cx="10" cy="11" r=".6" fill="currentColor"/><circle cx="14" cy="11" r=".6" fill="currentColor"/><path d="M10 15h4"/>'),
  pickups: svg('<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 9v6M9 12h6"/>'),
  doors: svg('<path d="M6 21V3h12v18M3 21h18"/><circle cx="15" cy="12" r="1"/>'),
  spawnPoints: svg('<ellipse cx="12" cy="18" rx="8" ry="3"/><path d="M12 15V4M8 8l4-4 4 4"/>'),
  zones: svg('<rect x="4" y="4" width="16" height="16" rx="1" stroke-dasharray="3 2.4"/>'),
  trigger: svg('<path d="M13 2L5 13h6l-1 9 8-11h-6z"/>'),
  arena: svg('<circle cx="12" cy="12" r="8" stroke-dasharray="3 2.4"/><path d="M12 8v8M8 12h8"/>'),
  translate: svg('<path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/>'),
  rotate: svg('<path d="M20 12a8 8 0 1 1-2.3-5.7"/><path d="M20 4v4h-4"/>'),
  scale: svg('<rect x="3" y="11" width="10" height="10"/><path d="M11 13l9-9M14 4h6v6"/>'),
} as const;

export type IconName = keyof typeof ICONS;
