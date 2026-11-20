import { PDFFont, PDFPage } from 'pdf-lib';
import { ResumePDFService } from './resume-pdf.service';
import * as templates from './templates';
import { fixtures } from './fixtures';
import type { Size, Template } from './types';

/**
 * Layout checks over every built-in template, fixture and font size. Each render records where
 * text and icons are drawn, then looks for the symptoms of layout bugs: text drawn over other text,
 * text off the page, and icons with no text beside them.
 */

type Box = { page: number; text: string; x0: number; x1: number; y0: number; y1: number };
type Icon = { page: number; x: number; y: number };

async function renderAndRecord(
  template: Template,
  fixture: string,
  fontSize: Size,
  leading: Size = 'md',
) {
  const pages = new Map<PDFPage, number>();
  const pageOf = (page: PDFPage) => {
    if (!pages.has(page)) pages.set(page, pages.size);
    return pages.get(page) as number;
  };
  const boxes: Box[] = [];
  const icons: Icon[] = [];

  const drawText = PDFPage.prototype.drawText;
  const drawSvgPath = PDFPage.prototype.drawSvgPath;
  const textSpy = jest.spyOn(PDFPage.prototype, 'drawText').mockImplementation(function (
    this: PDFPage,
    text,
    options = {},
  ) {
    const size = options.size ?? 12;
    const font = options.font as PDFFont | undefined;
    const width = font ? font.widthOfTextAtSize(text, size) : 0;
    const x = options.x ?? 0;
    const y = options.y ?? 0;
    // Ignore the watermark and whitespace-only runs: they never collide with content.
    if (text.trim() && font) {
      boxes.push({
        page: pageOf(this),
        text,
        x0: x,
        x1: x + width,
        y0: y - size * 0.2,
        y1: y + size * 0.72,
      });
    }
    return drawText.call(this, text, options);
  });
  const iconSpy = jest.spyOn(PDFPage.prototype, 'drawSvgPath').mockImplementation(function (
    this: PDFPage,
    path,
    options = {},
  ) {
    icons.push({ page: pageOf(this), x: options.x ?? 0, y: options.y ?? 0 });
    return drawSvgPath.call(this, path, options);
  });

  try {
    const service = new ResumePDFService();
    await service.create({ isPreview: false, fontSize, leading });
    await service.generate({ data: fixtures[fixture], template });
    return { boxes, icons, pageCount: pages.size };
  } finally {
    textSpy.mockRestore();
    iconSpy.mockRestore();
  }
}

const PAGE = { width: 595, height: 842 };
/** How far boxes may intersect before it counts. Tight leading makes neighbouring lines touch. */
const TOLERANCE = 1.5;

function overlaps(boxes: Box[]) {
  const found: string[] = [];
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i];
      const b = boxes[j];
      if (a.page !== b.page) continue;
      const dx = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
      const dy = Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0);
      if (dx > TOLERANCE && dy > TOLERANCE)
        found.push(`page ${a.page + 1}: "${a.text}" overlaps "${b.text}"`);
    }
  }
  return found;
}

function offPageVertically(boxes: Box[]) {
  return boxes
    .filter((b) => b.y0 < 0 || b.y1 > PAGE.height)
    .map((b) => `page ${b.page + 1}: "${b.text}" at y=${b.y0.toFixed(0)}`);
}

/** An icon belongs to the text drawn just to its right on the same line. */
function orphanIcons(icons: Icon[], boxes: Box[]) {
  return icons
    .filter(
      (icon) =>
        !boxes.some(
          (b) =>
            b.page === icon.page &&
            b.x0 >= icon.x - 1 &&
            b.x0 <= icon.x + 30 &&
            Math.abs(b.y1 - icon.y) < 14,
        ),
    )
    .map((icon) => `page ${icon.page + 1}: icon at x=${icon.x.toFixed(0)} y=${icon.y.toFixed(0)}`);
}

const SIZES: Size[] = ['sm', 'md', 'lg', 'xl'];
const templateEntries = Object.entries(templates) as Array<[string, Template]>;

// Every fixture at every font size, with the default leading.
const cases = templateEntries.flatMap(([templateName, template]) =>
  Object.keys(fixtures).flatMap((fixture) =>
    SIZES.map((fontSize) => [templateName, fixture, fontSize, 'md' as Size, template] as const),
  ),
);

// Resumes that run past one page, at every font size and leading, so page breaks land in many
// different places: inside bullets, between rows, on icon lines and on section labels.
const pageBreakCases = templateEntries.flatMap(([templateName, template]) =>
  ['multiPage', 'senior'].flatMap((fixture) =>
    SIZES.flatMap((fontSize) =>
      SIZES.filter((leading) => leading !== 'md').map(
        (leading) => [templateName, fixture, fontSize, leading, template] as const,
      ),
    ),
  ),
);

/**
 * Overlaps caused by values wider than their column (debt.md: "Row values are not limited to the
 * width left on the line"). They are expected to fail until that is fixed; once a case passes, Jest
 * reports it so it can be removed from this list.
 */
const KNOWN_WIDTH_OVERLAPS = new Set([
  'ember × longText at lg/md',
  'ember × longText at xl/md',
  'mint × entry at xl/md',
  'mint × international at xl/md',
  'mint × longText at xl/md',
  'mint × mid at xl/md',
  'mint × multiPage at xl/lg',
  'mint × multiPage at xl/md',
  'mint × multiPage at xl/sm',
  'mint × multiPage at xl/xl',
  'mint × senior at xl/lg',
  'mint × senior at xl/md',
  'mint × senior at xl/sm',
  'mint × senior at xl/xl',
  'talvio × longText at lg/md',
  'talvio × longText at md/md',
  'talvio × longText at sm/md',
  'talvio × longText at xl/md',
  'talvio × senior at xl/lg',
  'talvio × senior at xl/md',
  'talvio × senior at xl/sm',
  'talvio × senior at xl/xl',
]);

describe.each([...cases, ...pageBreakCases])(
  '%s × %s at %s/%s',
  (templateName, fixture, fontSize, leading, template) => {
    let result: Awaited<ReturnType<typeof renderAndRecord>>;

    beforeAll(async () => {
      result = await renderAndRecord(template, fixture, fontSize, leading);
    });

    const knownOverlap = KNOWN_WIDTH_OVERLAPS.has(
      `${templateName} × ${fixture} at ${fontSize}/${leading}`,
    );

    (knownOverlap ? it.failing : it)('draws no text over other text', () => {
      expect(overlaps(result.boxes)).toEqual([]);
    });

    it('keeps text on the page vertically', () => {
      expect(offPageVertically(result.boxes)).toEqual([]);
    });

    it('draws every icon next to its text', () => {
      expect(orphanIcons(result.icons, result.boxes)).toEqual([]);
    });
  },
);
