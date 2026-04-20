═══════════════════════════════════════════════════════════
IranENovin — Custom Brand Assets
═══════════════════════════════════════════════════════════

Drop your own logo files into THIS folder to override the
default Lion & Sun emblem used across the platform.

THE LOADER TRIES THESE FILENAMES IN ORDER — you can use any
one of them (pick whichever matches the file you have):

FULL EMBLEM (used in navbar desktop, hero, footer, large UI):
  1. lion-and-sun.svg   (preferred)
  2. logo.svg
  3. iranenovin.svg
  4. iranenovin_flag.svg
  5. logo.png
  6. iranenovin.png
  7. iranenovin_1.png   (through iranenovin_4.png)

MINI / COMPACT (used on mobile navbar, xs/sm sizes):
  1. lion-and-sun-mini.svg   (preferred)
  2. logo-mini.svg
  3. icon.svg
  4. favicon.svg
  5. iranenovin-mini.svg
  6. iranenovin_flag.svg
  7. logo-mini.png / favicon.png / iranenovin_1.png

Whichever file loads successfully first wins. If NONE of the
custom files exist, the shipped default at
/public/brand/lion-and-sun.svg is used.

Recommended dimensions:
  - Full SVG : viewBox roughly square (200×200 or similar)
  - Mini SVG : viewBox 48×48 for crisp rendering at 16–48px
  - PNG      : ≥ 512×512 for full emblem, ≥ 128×128 for mini

FAVICON / TAB ICON:
  The browser tab icon is set via app/layout.tsx metadata
  and points to /brand/lion-and-sun-mini.svg (the DEFAULT
  path, not this custom folder). To change the favicon
  either:
    (a) replace public/brand/lion-and-sun-mini.svg directly
        with your own file at that exact path, or
    (b) edit app/layout.tsx icons config to point at a file
        inside /brand/custom/.

Hot reload:
  After dropping files here, hard-refresh the browser
  (Cmd+Shift+R / Ctrl+Shift+R). No rebuild needed.

How the override works:
  LionSunLogo.tsx walks a priority chain of filenames. The
  first one that loads wins. If a file is missing, the
  browser's `onError` handler advances to the next candidate.
  When nothing in the custom/ folder matches, it falls back
  to the shipped default.
═══════════════════════════════════════════════════════════
