# Technical debt

Known issues that have a workaround in place but still need a proper fix.

## Custom fonts are embedded in full

**Where:** `embedFonts` in `packages/resume/pdf.service.ts`, `interFont` in `packages/resume/assets.ts`.

**Problem:** A resume with `interFont` is about 920 KB, because the five Inter files are embedded whole. With the default Helvetica it is about 10 KB. Each extra typeface role adds its files: the playground's Inter, Source Serif 4 and IBM Plex Mono make a three-page resume about 1.8 MB.

Subsetting with `@pdf-lib/fontkit` (`embedFont(bytes, { subset: true })`) can't fix it for Inter. With the Inter v19 files from Google Fonts it drops most glyphs: "Maya Lindqvist" renders as "aya L n" in both pdf.js and macOS Preview. Text extraction still works, so the text layer hides the problem. Roboto from Google Fonts subsets correctly (400 KB to 41 KB, renders the same).

**Workaround in place:** Custom fonts can opt in with `subset: true` on the `CustomFont`. It is off by default and `interFont` doesn't set it. A test checks that `interFont` never turns it on.

The Google Fonts builds of Source Serif 4 (italics) and IBM Plex Mono (every file) don't load at all: `@pdf-lib/fontkit` throws "Trying to access beyond buffer length". The playground uses the publishers' own files instead (Adobe's release of Source Serif 4, IBM's npm package of Plex Mono), which load.

**Fix:** Either find an Inter build that `@pdf-lib/fontkit` subsets correctly (for example the static TTFs from the Inter GitHub releases) and point `interFont` at it, or subset with HarfBuzz (`hb-subset`) before embedding. The HarfBuzz route needs the characters each font uses before `save()`, so it means rendering twice or collecting text during layout. Compare full and subset renders in pdf.js and macOS Preview before switching, including accented and Cyrillic text.

## Mixed font families limit every text to the standard character set

**Where:** `usesStandardFonts` and `encodable` in `packages/resume/pdf.service.ts`.

**Problem:** Text is made encodable once, before layout, for the whole render. When any typeface role the template uses has no font files (so it uses Helvetica, Times or Courier), every text is limited to the Western European characters those fonts cover, including text in roles that do have font files. A template with Inter for the body and the standard Times for headings draws Cyrillic body text as `?`.

**Workaround in place:** Pass font files for every role a template uses when the resume has text outside Western European characters.

**Fix:** Encode per role: replace characters at measuring and drawing time, using the character set of the font the text is drawn with (`getTextLines`, `getTextWidth` and `addText` all receive the font).
