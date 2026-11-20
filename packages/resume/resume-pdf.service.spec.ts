import { PDFDocument, PDFDict, PDFName, StandardFonts } from 'pdf-lib';
import { ResumePDFService } from './resume-pdf.service';
import { interFont } from './assets';
import { talvio, ember, mint } from './templates';
import { entry, international, longText } from './fixtures';

/** BaseFont names of every font on the first page. */
async function pageFonts(bytes: Uint8Array) {
  const doc = await PDFDocument.load(bytes);
  const resources = doc.getPage(0).node.Resources();
  const fonts = resources?.lookup(PDFName.of('Font'), PDFDict);
  return (fonts?.entries() ?? []).map(([, ref]) =>
    (doc.context.lookup(ref, PDFDict).get(PDFName.of('BaseFont')) ?? '').toString(),
  );
}

describe('default fonts', () => {
  const realFetch = global.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    // Simulate an environment where Google Fonts is blocked, such as CI or e2e tests.
    fetchMock = jest.fn(async () => {
      throw new TypeError('fetch failed');
    });
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = realFetch;
  });

  it('renders with the standard fonts and downloads nothing when no custom font is set', async () => {
    const service = new ResumePDFService();
    await service.create({ isPreview: false });

    const bytes = await service.generate({ data: entry, template: talvio });

    expect(fetchMock).not.toHaveBeenCalled();
    const fonts = await pageFonts(bytes);
    expect(fonts).toContain('/Helvetica');
    expect(fonts).toContain('/Helvetica-Bold');
    expect(fonts.every((name) => name.startsWith('/Helvetica'))).toBe(true);
  });

  it('works even when create() is not awaited', async () => {
    const service = new ResumePDFService();
    void service.create({ isPreview: false });

    const bytes = await service.generate({ data: entry, template: talvio });

    expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThan(0);
  });

  it.each([
    ['talvio', talvio],
    ['ember', ember],
    ['mint', mint],
  ])(
    'replaces characters the standard fonts cannot encode instead of throwing (%s)',
    async (_, template) => {
      const service = new ResumePDFService();
      await service.create({ isPreview: false });

      await expect(service.generate({ data: international, template })).resolves.toBeInstanceOf(
        Uint8Array,
      );
      await expect(service.generate({ data: longText, template })).resolves.toBeInstanceOf(
        Uint8Array,
      );
    },
  );

  it('keeps characters the standard fonts support and replaces the rest', async () => {
    const service = new ResumePDFService();
    await service.create({ isPreview: false });

    expect(service.encodable('Zoë Ångström • “quotes” – €')).toBe('Zoë Ångström • “quotes” – €');
    expect(service.encodable('Русский ქართული')).toBe('??????? ???????');
    expect(service.encodable('tab\there')).toBe('tab here');
  });

  it('reports a failed custom font download clearly', async () => {
    fetchMock.mockImplementation(async () => new Response('not found', { status: 404 }));
    const service = new ResumePDFService();

    await expect(service.create({ isPreview: false, customFont: interFont })).rejects.toThrow(
      /Could not download the \w+ font .* HTTP 404/,
    );
  });
});

describe('custom font subsetting', () => {
  const realFetch = global.fetch;
  const realEmbed = PDFDocument.prototype.embedFont;
  let subsetOptions: Array<boolean | undefined>;

  beforeEach(() => {
    subsetOptions = [];
    // Serve placeholder font bytes and embed Helvetica in their place: the test only checks which
    // options reach pdf-lib, not the font itself.
    global.fetch = (async () => new Response(new Uint8Array([0, 1, 0, 0]))) as typeof fetch;
    jest.spyOn(PDFDocument.prototype, 'embedFont').mockImplementation(function (
      this: PDFDocument,
      font,
      options,
    ) {
      if (typeof font === 'string') return realEmbed.call(this, font, options);
      subsetOptions.push(options?.subset);
      return realEmbed.call(this, StandardFonts.Helvetica);
    });
  });

  afterEach(() => {
    global.fetch = realFetch;
    jest.restoreAllMocks();
  });

  const font = (subset?: boolean) => ({
    name: 'Test',
    subset,
    fonts: {
      regular: 'https://example.com/r.ttf',
      semibold: 'https://example.com/s.ttf',
      bold: 'https://example.com/b.ttf',
      italic: 'https://example.com/i.ttf',
      'bold-italic': 'https://example.com/bi.ttf',
    },
  });

  it('embeds custom fonts whole unless subsetting is turned on', async () => {
    const service = new ResumePDFService();
    await service.create({ isPreview: false, customFont: font() });
    await service.generate({ data: entry, template: talvio });

    expect(subsetOptions).toEqual([false, false, false, false, false]);
  });

  it('subsets custom fonts that ask for it', async () => {
    const service = new ResumePDFService();
    await service.create({ isPreview: false, customFont: font(true) });
    await service.generate({ data: entry, template: talvio });

    expect(subsetOptions).toEqual([true, true, true, true, true]);
  });

  it('embeds custom fonts without ligatures', async () => {
    const features: unknown[] = [];
    (PDFDocument.prototype.embedFont as jest.Mock).mockImplementation(function (
      this: PDFDocument,
      font,
      options,
    ) {
      if (typeof font === 'string') return realEmbed.call(this, font, options);
      features.push(options?.features);
      return realEmbed.call(this, StandardFonts.Helvetica);
    });
    const service = new ResumePDFService();
    await service.create({ isPreview: false, customFont: font() });
    await service.generate({ data: entry, template: talvio });

    expect(features).toEqual(Array(5).fill({ liga: false }));
  });

  it('never subsets the bundled Inter, which the subsetter breaks', () => {
    expect(interFont.subset).not.toBe(true);
  });
});
