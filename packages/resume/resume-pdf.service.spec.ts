import { PDFDocument, PDFDict, PDFName } from 'pdf-lib';
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
