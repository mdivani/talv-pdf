# Technical debt

Known issues that still need a proper fix. Each entry lists the workaround in place, if there is one.

## Custom fonts are embedded in full

**Where:** `embedFonts` in `packages/resume/pdf.service.ts`, `interFont` in `packages/resume/assets.ts`.

**Problem:** A resume with `interFont` is about 920 KB, because the five Inter files are embedded whole. With the default Helvetica it is about 10 KB. Each extra typeface role adds its files: the playground's Inter, Source Serif 4 and IBM Plex Mono make a three-page resume about 1.8 MB.

Subsetting with `@pdf-lib/fontkit` (`embedFont(bytes, { subset: true })`) can't fix it for Inter. With the Inter v19 files from Google Fonts it drops most glyphs: "Maya Lindqvist" renders as "aya L n" in both pdf.js and macOS Preview. Text extraction still works, so the text layer hides the problem. Roboto from Google Fonts subsets correctly (400 KB to 41 KB, renders the same).

**Workaround in place:** Custom fonts can opt in with `subset: true` on the `CustomFont`. It is off by default and `interFont` doesn't set it. A test checks that `interFont` never turns it on.

The Google Fonts builds of Source Serif 4 (italics) and IBM Plex Mono (every file) don't load at all: `@pdf-lib/fontkit` throws "Trying to access beyond buffer length". The playground uses the publishers' own files instead (Adobe's release of Source Serif 4, IBM's npm package of Plex Mono), which load.

**Fix:** Either find an Inter build that `@pdf-lib/fontkit` subsets correctly (for example the static TTFs from the Inter GitHub releases) and point `interFont` at it, or subset with HarfBuzz (`hb-subset`) before embedding. The HarfBuzz route needs the characters each font uses before `save()`, so it means rendering twice or collecting text during layout. Compare full and subset renders in pdf.js and macOS Preview before switching, including accented and Cyrillic text.

## Mixed font families limit every text to the standard character set

**Where:** `usesStandardFonts` and `encodable` in `packages/resume/pdf.service.ts`.

**Problem:** Text is made encodable once, before layout, for the whole render. When any typeface role the template uses has no font files (so it uses Helvetica, Times or Courier), every text is limited to the Western European characters those fonts cover, including text in roles that do have font files. A template with Inter for the body and the standard Times for headings draws Cyrillic body text as `?`. One item is enough: a template with `family: 'mono'` on a single date, rendered without mono font files, turns every name, title and description into `?`.

**Workaround in place:** Pass font files for every role a template uses when the resume has text outside Western European characters.

**Fix:** Encode per role: replace characters at measuring and drawing time, using the character set of the font the text is drawn with (`getTextLines`, `getTextWidth` and `addText` all receive the font).

## A chip that wraps across a page break gets its box on the wrong page

**Where:** the chip branch of the row writer in `packages/resume/pdf.service.ts`, where `addBackground` is called after each chip is written.

**Problem:** A chip's box is recorded once, after the chip is written, on the page where its text ended, with the height of all its lines. When a chip is too wide for one line and its second line goes onto the next page, the box is drawn on the new page with the height of both lines plus padding. It reaches above the top margin there, and the first line on the previous page has no box.

A line of several chips is not affected, because it moves to the next page as a whole.

**Workaround in place:** None. Keep chip values short enough to fit on one line.

**Fix:** Record the chip's box per page, the way `addBackgroundSpan` does for groups: from the page and top where the first line was drawn to the page and bottom where the last line ended. `writeMultiLine` would need to report where its first line landed.

## `bleed` never reaches the bottom edge of the page

**Where:** `addBackgroundSpan` and `bleedX` in `packages/resume/pdf.service.ts`.

**Problem:** The package README says a `bleed` box extends to the page edge on every side where it touches the page margin. The code only does this for the top, left and right edges. When a group with a `bleed` background continues onto the next page, its box on the first page stops at `$safeArea` (40 pt above the bottom edge), leaving an unfilled strip. The box on the continuation page bleeds to the top.

**Workaround in place:** None. Avoid `bleed` on groups that can break across pages.

**Fix:** This is a design decision. Either extend the box to `y = 0` when it reaches `$safeArea`, at least on pages where the group continues, or change the README to say `bleed` covers the top, left and right edges only. Extending it changes how existing output looks, so check the templates that use `bleed` before switching.

## Group and field boxes are laid out by two copies of the same code

**Where:** `writeGroup` and `writeField` in `packages/resume/resume-pdf.service.ts`.

**Problem:** Both functions have their own copy of the box logic: the page break at the start of a box, `backgroundMark`, padding, separator and label, `labelBottom`, and the bottom edge with descent. The copies have already drifted:

- Groups pass `trailing` for the space after the last child. Fields pass `wroteItems ? space : 0`.
- Only fields call `needsNewPage` before starting a box.

Every box fix has to be made twice, and a fix made in only one place makes groups and fields behave differently.

**Workaround in place:** None.

**Fix:** Move the shared steps into one helper that both functions call. Decide which rule is right for each difference above before merging them. Snapshot tests will show any change in output.

## Box bottoms always use the descent of medium text

**Where:** the `bottom` calculations in `writeGroup` and `writeField` in `packages/resume/resume-pdf.service.ts`, which subtract `this.descent('md')`.

**Problem:** The space added below the last line of a box is always the descent of `md` text, whatever size the last line is:

- A box that ends with `sm` text gets extra space at the bottom.
- A box that ends with `xl` text clips its descenders.
- A wrapper with padding but no background, such as the page-margin wrapper, still adds this space after its content, though nothing is drawn that needs it.

The fixed `md` value is a deliberate approximation, so most templates look right.

**Workaround in place:** None needed for the built-in templates.

**Fix:** Track the font size of the last line written in the box and use its descent. Add the descent only when a background is drawn.
