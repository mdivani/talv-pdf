# Technical debt

Known issues that have a workaround in place but still need a proper fix.

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
