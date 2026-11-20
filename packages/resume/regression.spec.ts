import { createHash } from 'crypto';
import { PDFFont, PDFPage } from 'pdf-lib';
import { ResumePDFService } from './resume-pdf.service';
import { ember, mint, talvio } from './templates';
import { fixtures } from './fixtures';
import type { Size, Template } from './types';

/**
 * The built-in templates must keep drawing exactly what they drew in 0.3.0. Every drawing call
 * (text, lines, circles, icons, rectangles) is recorded with its position, size, font and colour,
 * and the list is hashed. PDF bytes can't be compared: they change from run to run.
 *
 * A failing hash means a built-in template now draws something different. If that is intended,
 * update the snapshot with `-u` and say why in the commit.
 */

const DRAW_METHODS = [
  'drawText',
  'drawLine',
  'drawCircle',
  'drawSvgPath',
  'drawRectangle',
] as const;

const round = (value: unknown): unknown => {
  if (typeof value === 'number') return Math.round(value * 100) / 100;
  if (value instanceof PDFFont) return value.name;
  if (Array.isArray(value)) return value.map(round);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, round(item)]),
    );
  }
  return value;
};

async function drawCalls(template: Template, fixture: string, fontSize: Size) {
  const pages = new Map<PDFPage, number>();
  const calls: unknown[] = [];
  const spies = DRAW_METHODS.map((method) => {
    const original = PDFPage.prototype[method] as (...args: unknown[]) => unknown;
    return jest.spyOn(PDFPage.prototype, method).mockImplementation(function (
      this: PDFPage,
      ...args: unknown[]
    ) {
      if (!pages.has(this)) pages.set(this, pages.size);
      calls.push([pages.get(this), method, round(args)]);
      return original.apply(this, args);
    } as never);
  });

  try {
    const service = new ResumePDFService();
    await service.create({ isPreview: false, fontSize });
    await service.generate({ data: fixtures[fixture], template });
  } finally {
    spies.forEach((spy) => spy.mockRestore());
  }

  return {
    calls: calls.length,
    hash: createHash('sha1').update(JSON.stringify(calls)).digest('hex'),
  };
}

const templates = { ember, mint, talvio } as Record<string, Template>;
const SIZES: Size[] = ['sm', 'md', 'lg', 'xl'];

describe.each(Object.entries(templates))('%s draws as in 0.3.0', (_, template) => {
  it.each(Object.keys(fixtures).flatMap((fixture) => SIZES.map((size) => [fixture, size])))(
    '%s at %s',
    async (fixture, size) => {
      expect(await drawCalls(template, fixture, size as Size)).toMatchSnapshot();
    },
  );
});
