# Technical debt

Known issues that have a workaround in place but still need a proper fix.

## Inter is embedded in full

**Where:** `embedFonts` in `packages/resume/pdf.service.ts`, `interFont` in `packages/resume/assets.ts`.

**Problem:** A resume with `interFont` is about 920 KB, because the five Inter files are embedded whole. With the default Helvetica it is about 10 KB.

Subsetting with `@pdf-lib/fontkit` (`embedFont(bytes, { subset: true })`) can't fix it for Inter. With the Inter v19 files from Google Fonts it drops most glyphs: "Maya Lindqvist" renders as "aya L n" in both pdf.js and macOS Preview. Text extraction still works, so the text layer hides the problem. Roboto from Google Fonts subsets correctly (400 KB to 41 KB, renders the same).

**Workaround in place:** Custom fonts can opt in with `subset: true` on the `CustomFont`. It is off by default and `interFont` doesn't set it. A test checks that `interFont` never turns it on.

**Fix:** Either find an Inter build that `@pdf-lib/fontkit` subsets correctly (for example the static TTFs from the Inter GitHub releases) and point `interFont` at it, or subset with HarfBuzz (`hb-subset`) before embedding. The HarfBuzz route needs the characters each font uses before `save()`, so it means rendering twice or collecting text during layout. Compare full and subset renders in pdf.js and macOS Preview before switching, including accented and Cyrillic text.
