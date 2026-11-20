# Technical debt

Known issues that have a workaround in place but still need a proper fix.

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

## Entry headings can be left alone at the bottom of a page

**Where:** `writeField` and `writeItem` in `packages/resume/resume-pdf.service.ts`.

**Problem:** Page breaks are decided line by line. Only section labels look ahead (`offset: 70` in `writeLabel`). An entry's first line, such as a job title or a recommender's name, can be the last line on a page while the rest of the entry starts the next page.

**Workaround in place:** None. It only affects resumes that run past one page.

**Still affected:** The `senior` fixture with `talvio` at `md` size and the Inter font: "Tom Okafor, Head of Engineering at Northwind Health" ends page 1, and its link and text start page 2.

**Fix:** Before writing an object field (`source: 'objects'`), measure the height of its first two or three items and move to the next page if they don't fit. The layout tests in `packages/resume/layout.spec.ts` can be extended to check that no page ends with an entry's first line.
