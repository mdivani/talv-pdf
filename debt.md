# Technical debt

Known issues that have a workaround in place but still need a proper fix.

## Content after a page break is drawn on the previous page

**Where:** `writeRow` and `writeLine` in `packages/resume/pdf.service.ts`.

**Problem:** Two bugs make resumes that run past one page render wrongly.

1. In the `justify === 'start'` branch of `writeRow`, every value in a row is written with the `pageIndex` the row was called with, not `currentPageIndex`. When the first value moves to a new page, the next value is drawn at the top of the old page. The row then returns the old page index, so everything after it in the column goes onto the old page too, on top of what is already there. The `center` and `between` branches end up in the same code path.
2. In `writeLine`, the icon is drawn at the `y` the line was called with, not the `currentY` it moved to after a page break. The text goes to the top of the new page, but its icon is left near the bottom of that page.

**Workaround in place:** None. Short resumes fit on one page and are not affected. The Talvio web app's previews pick a type scale that fits on one page.

**Still affected:**

- Any resume whose main column breaks at a row. The `multiPage` fixture with `talvio` shows bug 1: page 1 is drawn over, and page 2 holds a single job title.
- Any line with an icon that starts a new page. The `senior` fixture with `talvio` at `md` size and the Inter font shows bug 2: a recommendation's link icon sits alone at the bottom of page 2.

**Fix:** In `writeRow`, pass `pageIndex: currentPageIndex` to `writeMultiLine`. In `writeLine`, draw the icon at the line's final position (`currentY` plus the line's height) instead of `y`. The `writeRow` change alone was tried in a local build and fixes `multiPage`; the icon change has not been tried yet. Check `multiPage`, `senior` and `longText` with every template in the playground (`yarn playground`, "Template × every fixture") before releasing.

## Row values are not limited to the width left on the line

**Where:** `writeRow` in `packages/resume/pdf.service.ts`, `justify === 'start'` branch.

**Problem:** Every value in a row is written with `maxWidth: containerWidth`, the full width of the row. It should be the width still free on the line, `containerWidth - (positionX - x)`. A later value starts after the earlier ones but may still be as wide as the whole row, so it runs past the column edge and gets clipped. The `center` and `between` branches end up in the same code path, so they are affected too.

**Workaround in place:** The `talvio` template stacks the education degree and date as separate `text` items instead of one row (MDI-422). The package README tells template authors to use rows only where every value fits on one line.

**Still affected:**

- `ember`: `keys: ['degree', 'dateRangeShort']` and `['company', 'locationType']`.
- `mint`: `keys: ['degree', 'school', 'dateRangeShort']` and `['company', 'locationType']`.
- Any user template with a row in a narrow column.

**Fix:** Pass the remaining width to each value in `writeRow`. Decide what happens when there is no room left, for example wrapping the value onto the next line at `x`. Then put the `talvio` education row back and remove the row caveat from the package README.

## Custom fonts are embedded in full

**Where:** `embedFonts` in `packages/resume/pdf.service.ts`.

**Problem:** When a custom font such as `interFont` is set, the five font files are embedded whole, so a one-page resume is about 930 KB instead of about 10 KB with the default Helvetica.

**Fix:** Embed with `doc.embedFont(bytes, { subset: true })`. A quick test brings the file back to about 6 KB. `@pdf-lib/fontkit` subsetting has known glyph bugs with some fonts, so check the output in Acrobat, Chrome and macOS Preview, including non-Latin text, before switching it on.
