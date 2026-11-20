import { PDFFont, PDFPage, RGB } from 'pdf-lib';
import { ResumePDFService } from './resume-pdf.service';
import { BasePDFService, BackgroundBox, RenderOptions } from './pdf.service';
import type { ResumeData, Size, Template } from './types';

/** Records what a render draws. Test helper; not part of the package. */

export type DrawnText = {
  page: number;
  text: string;
  x: number;
  y: number;
  /** Width of the drawn line of text. */
  width: number;
  size: number;
  font: string;
  color: string;
};
export type DrawnLine = { page: number; x1: number; y1: number; x2: number; y2: number };
export type DrawnCircle = { page: number; x: number; y: number; size: number; color: string };

const hex = (color?: unknown) => {
  const { red = 0, green = 0, blue = 0 } = (color ?? {}) as RGB;
  return (
    '#' +
    [red, green, blue]
      .map((c) =>
        Math.round(c * 255)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
      .toUpperCase()
  );
};

export async function record(
  template: Template,
  data: ResumeData,
  {
    fontSize = 'md',
    options,
    sectionOrder,
    service = new ResumePDFService(),
  }: {
    fontSize?: Size;
    options?: RenderOptions;
    sectionOrder?: string[];
    service?: ResumePDFService;
  } = {},
) {
  const pages = new Map<PDFPage, number>();
  const pageOf = (page: PDFPage) => {
    if (!pages.has(page)) pages.set(page, pages.size);
    return pages.get(page) as number;
  };
  const texts: DrawnText[] = [];
  const lines: DrawnLine[] = [];
  const circles: DrawnCircle[] = [];
  const backgrounds: BackgroundBox[] = [];

  const { drawText, drawLine, drawCircle } = PDFPage.prototype;
  const spies = [
    jest.spyOn(PDFPage.prototype, 'drawText').mockImplementation(function (
      this: PDFPage,
      text,
      opts = {},
    ) {
      const font = opts.font as PDFFont | undefined;
      text.split('\n').forEach((line, index) => {
        if (!line.trim() || !font) return;
        texts.push({
          page: pageOf(this),
          text: line,
          x: opts.x ?? 0,
          y: (opts.y ?? 0) - index * (opts.lineHeight ?? opts.size ?? 12),
          width: font.widthOfTextAtSize(line, opts.size ?? 12),
          size: opts.size ?? 12,
          font: font.name,
          color: hex(opts.color),
        });
      });
      return drawText.call(this, text, opts);
    }),
    jest.spyOn(PDFPage.prototype, 'drawLine').mockImplementation(function (this: PDFPage, opts) {
      lines.push({
        page: pageOf(this),
        x1: opts.start.x,
        y1: opts.start.y,
        x2: opts.end.x,
        y2: opts.end.y,
      });
      return drawLine.call(this, opts);
    }),
    jest.spyOn(PDFPage.prototype, 'drawCircle').mockImplementation(function (
      this: PDFPage,
      opts = {},
    ) {
      circles.push({
        page: pageOf(this),
        x: opts.x ?? 0,
        y: opts.y ?? 0,
        size: Number(opts.size ?? 0),
        color: hex(opts.color),
      });
      return drawCircle.call(this, opts);
    }),
  ];
  const { addBackground } = BasePDFService.prototype;
  const backgroundSpy = jest
    .spyOn(BasePDFService.prototype, 'addBackground')
    .mockImplementation(function (this: BasePDFService, box, at) {
      if (box.width > 0 && box.height > 0) backgrounds.push({ ...box });
      return addBackground.call(this, box, at);
    });

  try {
    if (!service.isInitialised) await service.create({ isPreview: false, fontSize });
    const bytes = await service.generate({ data, template, options, sectionOrder });
    // Pages with nothing drawn on them still count.
    const pageCount = (await import('pdf-lib')).PDFDocument.load(bytes).then((doc) =>
      doc.getPageCount(),
    );
    return { texts, lines, circles, backgrounds, pageCount: await pageCount, bytes };
  } finally {
    spies.forEach((spy) => spy.mockRestore());
    backgroundSpy.mockRestore();
  }
}

/** The first drawn line whose text starts with `start`. */
export function textOf(texts: DrawnText[], start: string) {
  const found = texts.find((t) => t.text.trim().startsWith(start));
  if (!found) throw new Error(`"${start}" was not drawn`);
  return found;
}
