import { PDFArray, PDFDocument, PDFRawStream, StandardFonts, decodePDFRawStream } from 'pdf-lib';
import { ResumePDFService } from './resume-pdf.service';
import { BasePDFService } from './pdf.service';
import { talvio } from './templates';
import { fixtures } from './fixtures';
import { exp } from './fixtures/helpers';
import { contrastRatio, orderSections } from './utils';
import { record, textOf, DrawnText } from './test-utils';
import type {
  Field,
  Group,
  ItemStyle,
  LineParamStyles,
  ResumeData,
  Template,
  TextItem,
} from './types';

/** Engine options added for the new templates. Each is checked on its own, most across a page break. */

const style = (overrides: Partial<LineParamStyles> = {}): LineParamStyles => ({
  fontSize: 'md',
  color: 'primary',
  font: 'regular',
  ...overrides,
});
const text = (
  name: string,
  overrides: Partial<LineParamStyles> = {},
): TextItem<LineParamStyles> => ({
  type: 'text',
  name,
  item: style(overrides),
});
const label = (value: string, overrides: Partial<Group<ItemStyle>['label']> = {}) => ({
  ...style({ font: 'semibold', fontSize: 'lg' }),
  text: value,
  margins: { bottom: 'md' as const },
  ...overrides,
});

const header: Field<ItemStyle> = {
  name: 'header',
  source: 'root',
  items: [text('name', { fontSize: 'xl', font: 'bold' }), text('role')],
};
const experience = (overrides: Partial<Field<ItemStyle>> = {}): Field<ItemStyle> => ({
  name: 'experience',
  source: 'objects',
  gap: 'sm',
  items: [
    text('jobTitle', { font: 'semibold' }),
    text('companyWithEmploymentType'),
    text('dateRange', { color: 'neutral' }),
    { type: 'content', name: 'description', margins: { top: 'sm' } },
  ],
  ...overrides,
});
const section = (name: string, fields: Field<ItemStyle>[], extra: Partial<Group<ItemStyle>> = {}) =>
  ({ width: 'full', section: name, gap: 'md', fields, ...extra }) as Group<ItemStyle>;

const page = { width: 595, height: 842, padding: 20 };
const { multiPage, senior, mid } = fixtures;

/** Every drawn line of `texts` lies inside the box. */
const inside = (texts: DrawnText[], box: { x: number; y: number; width: number; height: number }) =>
  texts.every(
    (t) =>
      t.x >= box.x - 0.5 && t.y >= box.y - 0.5 && t.y + t.size * 0.72 <= box.y + box.height + 0.5,
  );

describe('section order', () => {
  const groups = (names: Array<string | undefined>) =>
    names.map((name) => ({ width: 'full', section: name }) as Group<ItemStyle>);
  const names = (list: Group<ItemStyle>[]) => list.map((group) => group.section ?? '-');

  it('moves named groups into the given order and keeps unnamed groups in place', () => {
    const result = orderSections(groups(['a', undefined, 'b', 'c']), ['c', 'a']);
    expect(names(result)).toEqual(['c', '-', 'a', 'b']);
  });

  it('ignores unknown names and puts missing ones in the default order', () => {
    const result = orderSections(groups(['a', 'b', 'c']), ['nope', 'c'], ['b', 'a', 'c']);
    expect(names(result)).toEqual(['c', 'b', 'a']);
  });

  it('keeps groups that share a name together', () => {
    const result = orderSections(groups(['a', 'b', 'b', 'c']), ['b']);
    expect(names(result)).toEqual(['b', 'b', 'a', 'c']);
  });

  it('only reorders sections among their neighbours, never across columns', () => {
    const columns = [
      { width: '2/3', groups: groups(['a', 'b']) },
      { width: '1/3', groups: groups(['c', 'd']) },
    ] as Group<ItemStyle>[];
    const result = orderSections(columns, ['d', 'b']);
    expect(result.map((column) => names(column.groups ?? []))).toEqual([
      ['b', 'a'],
      ['d', 'c'],
    ]);
  });

  it('reorders the sections of a rendered template', async () => {
    const before = await record(talvio, senior);
    const after = await record(talvio, senior, { sectionOrder: ['education', 'skills'] });
    // In the side column, education now comes before skills.
    expect(textOf(after.texts, 'Education').y).toBeGreaterThan(textOf(after.texts, 'Skills').y);
    expect(textOf(before.texts, 'Education').y).toBeLessThan(textOf(before.texts, 'Skills').y);
    // The main column is untouched.
    expect(textOf(after.texts, 'Experience')).toEqual(textOf(before.texts, 'Experience'));
  });

  it("uses the template's default order when no order is given", async () => {
    const template: Template = {
      defaultSectionOrder: ['second', 'first'],
      groups: [
        section('first', [{ name: 'role', source: 'root', items: [text('role')] }]),
        section('second', [{ name: 'name', source: 'root', items: [text('name')] }]),
      ],
    };
    const { texts } = await record(template, mid);
    expect(texts.map((t) => t.text)).toEqual([mid.name, mid.role]);
  });

  it('gives every built-in template a default order that names all its sections', () => {
    for (const template of [talvio]) {
      const named = new Set<string>();
      const walk = (list: Group<ItemStyle>[]) =>
        list.forEach((group) => {
          if (group.section) named.add(group.section);
          walk(group.groups ?? []);
        });
      walk(template.groups);
      expect([...named].sort()).toEqual([...(template.defaultSectionOrder ?? [])].sort());
    }
  });
});

describe('when and unless', () => {
  const template: Template = {
    groups: [
      section(
        'skills',
        [
          {
            name: 'skillGroups',
            source: 'objects',
            items: [text('name', { font: 'bold' })],
          },
        ],
        { when: 'skillGroups' },
      ),
      section(
        'skills',
        [
          {
            name: 'skills',
            source: 'root',
            join: { type: 'join', output: 'text', separator: ', ', width: 0, item: style() },
            items: [],
          },
        ],
        { unless: 'skillGroups' },
      ),
    ],
  };

  it('draws skill groups when there are some, and not the fallback line', async () => {
    const data = {
      ...mid,
      skills: ['Go', 'SQL'],
      skillGroups: [{ name: 'Backend', skills: ['Go'] }],
    };
    const { texts } = await record(template, data);
    expect(texts.map((t) => t.text)).toEqual(['Backend']);
  });

  it('draws the fallback line when there are no skill groups', async () => {
    for (const skillGroups of [undefined, []]) {
      const { texts } = await record(template, { ...mid, skills: ['Go', 'SQL'], skillGroups });
      expect(texts.map((t) => t.text)).toEqual(['Go, SQL']);
    }
  });
});

describe('font families', () => {
  const template = (family?: Template['family']): Template => ({
    family,
    groups: [
      {
        width: 'full',
        fields: [
          {
            name: 'header',
            source: 'root',
            items: [
              text('name'),
              text('role', { family: 'serif' }),
              text('email', { family: 'mono' }),
              text('phone', { family: 'body' }),
            ],
          },
        ],
      },
    ],
  });

  it('draws each family with its standard font when no font files are given', async () => {
    const { texts } = await record(template(), mid);
    expect(texts.map((t) => t.font)).toEqual(['Helvetica', 'Times-Roman', 'Courier', 'Helvetica']);
  });

  it("uses the template's family for text that names none", async () => {
    const { texts } = await record(template('serif'), mid);
    expect(texts[0].font).toBe('Times-Roman');
    expect(texts[3].font).toBe('Helvetica');
  });

  it('only embeds the families a template uses', async () => {
    const spy = jest.spyOn(PDFDocument.prototype, 'embedStandardFont');
    await record(talvio, mid);
    const embedded = spy.mock.calls.map(([name]) => name);
    spy.mockRestore();
    expect(
      embedded.filter((name) => name.startsWith('Times') || name.startsWith('Courier')),
    ).toEqual([]);
  });

  describe('with font files', () => {
    const realFetch = global.fetch;
    const realEmbed = PDFDocument.prototype.embedFont;
    let requested: string[];

    beforeEach(() => {
      requested = [];
      // Placeholder bytes, embedded as Courier-Oblique so the test can tell custom fonts apart.
      global.fetch = (async (url: string) => {
        requested.push(url);
        return new Response(new Uint8Array([0, 1, 0, 0]));
      }) as typeof fetch;
      jest.spyOn(PDFDocument.prototype, 'embedFont').mockImplementation(function (
        this: PDFDocument,
        font,
        options,
      ) {
        if (typeof font === 'string') return realEmbed.call(this, font, options);
        return realEmbed.call(this, StandardFonts.CourierOblique);
      });
    });

    afterEach(() => {
      global.fetch = realFetch;
      jest.restoreAllMocks();
    });

    const files = (name: string) => ({
      name,
      fonts: {
        regular: `https://example.com/${name}-r.ttf`,
        semibold: `https://example.com/${name}-s.ttf`,
        bold: `https://example.com/${name}-b.ttf`,
        italic: `https://example.com/${name}-i.ttf`,
        'bold-italic': `https://example.com/${name}-bi.ttf`,
      },
    });

    it('embeds font files for the families that have them', async () => {
      const service = new ResumePDFService();
      await service.create({ isPreview: false, fonts: { serif: files('serif') } });
      const { texts } = await record(template(), mid, { service });
      expect(texts.map((t) => t.font)).toEqual([
        'Helvetica',
        'Courier-Oblique',
        'Courier',
        'Helvetica',
      ]);
      expect(requested).toHaveLength(5);
    });

    it('downloads fonts for a family once, across renders', async () => {
      const service = new ResumePDFService();
      await service.create({ isPreview: false });
      const options = { fonts: { serif: files('serif'), mono: files('mono') } };
      await record(template(), mid, { service, options });
      await record(template(), mid, { service, options });
      expect(requested).toHaveLength(10);
    });

    it('keeps characters the standard fonts lack only when every family has font files', async () => {
      const data = { ...mid, name: 'Ελλάδα', role: 'Ελλάδα', email: 'Ελλάδα', phone: 'Ελλάδα' };
      const service = new ResumePDFService();
      await service.create({ isPreview: false });

      // The serif family has no files, so text is limited to what the standard fonts encode.
      const { texts } = await record(template(), data, {
        service,
        options: { customFont: files('body'), fonts: { mono: files('mono') } },
      });
      expect(texts.map((t) => t.text)).toEqual(Array(4).fill('??????'));
    });
  });
});

describe('derived colours', () => {
  // The accents offered by the Talvio colour picker.
  const accents = [
    '#015408',
    '#670000',
    '#1B1B1B',
    '#005BA2',
    '#7A7A7A',
    '#763900',
    '#983805',
    '#BA8E23',
  ];

  it.each(accents)('text on %s reaches a 4.5:1 contrast ratio', async (accent) => {
    const service = new ResumePDFService();
    await service.create({ isPreview: false, color: accent });
    expect(
      contrastRatio(service.color('onSecondary'), service.color('secondary')),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it('puts white text on dark accents and dark text on light ones', async () => {
    const colorOn = async (accent: string) => {
      const service = new ResumePDFService();
      await service.create({ isPreview: false, color: accent });
      return service.color('onSecondary');
    };
    expect(await colorOn('#005BA2')).toMatchObject({ red: 1, green: 1, blue: 1 });
    expect(await colorOn('#F5D000')).toMatchObject({ red: 0x1c / 255 });
  });

  it('tints the accent towards white', async () => {
    const service = new ResumePDFService();
    await service.create({ isPreview: false, color: '#005BA2' });
    const tint = service.color('secondaryTint');
    expect(tint.red).toBeGreaterThan(0.85);
    expect(tint.blue).toBeGreaterThan(tint.red);
  });
});

describe('backgrounds', () => {
  const boxed = (extra: Partial<Group<ItemStyle>> = {}): Template => ({
    groups: [
      section('experience', [experience()], {
        background: { color: 'secondaryTint' },
        padding: 'lg',
        ...extra,
      }),
    ],
  });

  it('draws a box around the group, with its content inset by the padding', async () => {
    const data = { ...mid, experience: mid.experience?.slice(0, 1) };
    const { texts, backgrounds } = await record(boxed(), data);
    expect(backgrounds).toHaveLength(1);
    const [box] = backgrounds;
    expect(box).toMatchObject({
      pageIndex: 0,
      x: page.padding,
      width: page.width - 2 * page.padding,
    });
    expect(inside(texts, box)).toBe(true);
    expect(Math.min(...texts.map((t) => t.x))).toBeCloseTo(page.padding + 12);
  });

  it('draws no box for a group with no content', async () => {
    const { backgrounds, texts } = await record(boxed(), { ...mid, experience: [] });
    expect(backgrounds).toEqual([]);
    expect(texts).toEqual([]);
  });

  it('splits a box across pages, one per page, each around its own content', async () => {
    const { texts, backgrounds, pageCount } = await record(boxed(), multiPage, { fontSize: 'xl' });
    expect(pageCount).toBeGreaterThan(1);
    expect(backgrounds.map((box) => box.pageIndex)).toEqual([...Array(pageCount).keys()]);
    for (const box of backgrounds) {
      expect(
        inside(
          texts.filter((t) => t.page === box.pageIndex),
          box,
        ),
      ).toBe(true);
    }
  });

  it('reaches the page edges it touches with bleed', async () => {
    const data = { ...mid, experience: mid.experience?.slice(0, 1) };
    const { backgrounds } = await record(
      boxed({ background: { color: 'secondary', bleed: true } }),
      data,
    );
    expect(backgrounds[0]).toMatchObject({ x: 0, width: page.width });
    expect(backgrounds[0].y + backgrounds[0].height).toBe(page.height);
  });

  it('fills a full-height column on every page, including pages after its content', async () => {
    const template: Template = {
      groups: [
        {
          width: 'full',
          direction: 'horizontal',
          gap: 'lg',
          groups: [
            section('experience', [experience()], { width: '2/3' }),
            {
              width: '1/3',
              background: { color: 'secondary', fullHeight: true, bleed: true },
              padding: 'md',
              fields: [
                { name: 'role', source: 'root', items: [text('role', { color: 'onSecondary' })] },
              ],
            },
          ],
        },
      ],
    };
    const { backgrounds, pageCount } = await record(template, multiPage);
    expect(pageCount).toBeGreaterThan(1);
    expect(backgrounds.map((box) => box.pageIndex).sort()).toEqual([...Array(pageCount).keys()]);
    for (const box of backgrounds) {
      expect(box).toMatchObject({ y: 0, height: page.height });
      expect(box.x + box.width).toBe(page.width);
    }
  });

  it('is drawn behind the content in the saved PDF', async () => {
    const { bytes } = await record(boxed(), { ...mid, experience: mid.experience?.slice(0, 1) });
    const doc = await PDFDocument.load(bytes);
    const contents = doc.getPage(0).node.Contents() as PDFArray;
    const streams = contents
      .asArray()
      .map((ref) => doc.context.lookup(ref) as PDFRawStream)
      .map((stream) => Buffer.from(decodePDFRawStream(stream).decode()).toString('latin1'));
    expect(streams[0]).toMatch(/ re\s+f/);
    expect(streams[0]).not.toMatch(/Tj/);
    expect(streams.slice(1).join('')).toMatch(/Tj/);
  });

  it('moves a box to the next page instead of starting it at the bottom of this one', async () => {
    const filler: Group<ItemStyle> = section('filler', [experience()]);
    const template: Template = {
      groups: [
        filler,
        section('projects', [{ name: 'email', source: 'root', items: [text('email')] }], {
          background: { color: 'secondaryTint' },
          padding: 'lg',
        }),
      ],
    };
    // Find an amount of filler that leaves the box starting near the bottom of the first page.
    for (let count = 1; count <= 7; count++) {
      const data = { ...multiPage, experience: multiPage.experience?.slice(0, count) };
      const { backgrounds, texts } = await record(template, data);
      const box = backgrounds[0];
      expect(box.height).toBeGreaterThan(20);
      expect(
        inside(
          texts.filter((t) => t.text === data.email),
          box,
        ),
      ).toBe(true);
    }
  });
});

describe('nested boxes', () => {
  it("draws a group's box under the boxes inside it", async () => {
    const template: Template = {
      groups: [
        {
          width: 'full',
          background: { color: 'secondary' },
          padding: 'lg',
          fields: [
            {
              name: 'skills',
              source: 'root',
              join: {
                type: 'join',
                output: 'row',
                width: 0,
                gap: 'sm',
                chip: { background: { border: { color: 'onSecondary' } } },
                item: style({ color: 'onSecondary' }),
              },
              items: [],
            },
          ],
        },
      ],
    };
    // Record the paint order through the operators each box produces.
    const order: string[] = [];
    const base = BasePDFService.prototype as unknown as {
      backgroundOperators: (box: { background: { color?: string } }) => unknown;
    };
    const original = base.backgroundOperators;
    base.backgroundOperators = function (box: { background: { color?: string } }) {
      order.push(box.background.color ? 'group' : 'chip');
      return original.call(this, box);
    };
    try {
      await record(template, { ...mid, skills: ['Go', 'SQL', 'Kafka'] });
    } finally {
      base.backgroundOperators = original;
    }
    expect(order).toEqual(['group', 'chip', 'chip', 'chip']);
  });

  it('starts stacked sections at the same x, whatever label columns they have', async () => {
    const template: Template = {
      groups: [
        {
          width: '2/3',
          groups: ['Experience', 'Projects', 'Skills'].map((heading, i) =>
            section(
              heading.toLowerCase(),
              [
                {
                  name: ['name', 'role', 'email'][i],
                  source: 'root',
                  items: [text(['name', 'role', 'email'][i])],
                },
              ],
              { label: label(heading, { column: 80 }) },
            ),
          ),
        },
      ],
    };
    const { texts } = await record(template, mid);
    expect(new Set(['Experience', 'Projects', 'Skills'].map((h) => textOf(texts, h).x))).toEqual(
      new Set([page.padding]),
    );
    expect(new Set([mid.name, mid.role, mid.email].map((v) => textOf(texts, v ?? '').x))).toEqual(
      new Set([page.padding + 80]),
    );
  });
});

describe('labels', () => {
  const columnTemplate = (labelText: string, column = 100): Template => ({
    groups: [
      section('experience', [experience()], {
        label: label(labelText, { column }),
      }),
      section('next', [{ name: 'role', source: 'root', items: [text('role')] }]),
    ],
  });

  it('puts a column label beside its content, level with it', async () => {
    const data = { ...mid, experience: mid.experience?.slice(0, 1) };
    const { texts } = await record(columnTemplate('Experience'), data);
    const heading = textOf(texts, 'Experience');
    const title = textOf(texts, data.experience?.[0].jobTitle ?? '');
    expect(heading.x).toBe(page.padding);
    expect(title.x).toBe(page.padding + 100);
    expect(Math.abs(heading.y + heading.size * 0.72 - (title.y + title.size * 0.72))).toBeLessThan(
      heading.size * 0.3,
    );
  });

  it('wraps a long label inside its column and starts the next section below it', async () => {
    const data = {
      ...mid,
      experience: [exp('Acme', 'Full-time', 'Engineer', '2020 - 2021', [])].map((entry) => ({
        ...entry,
        description: undefined,
        companyWithEmploymentType: '',
      })),
    };
    const long = 'Professional experience and leadership roles';
    const { texts } = await record(columnTemplate(long, 90), data);
    const labelLines = texts.filter((t) => t.x === page.padding && t.text !== data.role);
    expect(labelLines.length).toBeGreaterThan(2);
    const lowestLabelLine = Math.min(...labelLines.map((t) => t.y));
    expect(textOf(texts, data.role).y).toBeLessThan(lowestLabelLine - 5);
  });

  it('keeps a column label on the same page as the start of its content', async () => {
    const template: Template = {
      groups: [
        section('experience', [experience()], { label: label('Experience', { column: 100 }) }),
        section(
          'projects',
          [{ name: 'projects', source: 'objects', items: [text('projectName')] }],
          {
            label: label('Projects', { column: 100 }),
          },
        ),
      ],
    };
    for (const count of [5, 6, 7]) {
      const data = { ...multiPage, experience: multiPage.experience?.slice(0, count) };
      const { texts } = await record(template, data);
      const heading = textOf(texts, 'Projects');
      const firstProject = textOf(texts, data.projects?.[0].projectName ?? '');
      expect(firstProject.page).toBe(heading.page);
    }
  });

  it('draws a bar behind a label as wide as its group', async () => {
    const template: Template = {
      groups: [
        section('experience', [experience()], {
          label: label('Experience', {
            color: 'onSecondary',
            background: { color: 'secondary' },
            padding: { x: 'md', y: 'sm' },
          }),
        }),
      ],
    };
    const { texts, backgrounds } = await record(template, {
      ...mid,
      experience: mid.experience?.slice(0, 1),
    });
    expect(backgrounds).toHaveLength(1);
    expect(backgrounds[0]).toMatchObject({ x: page.padding, width: page.width - 2 * page.padding });
    const heading = textOf(texts, 'Experience');
    expect(inside([heading], backgrounds[0])).toBe(true);
    expect(heading.color).toBe('#FFFFFF');
    // The content starts below the bar.
    const title = textOf(texts, mid.experience?.[0].jobTitle ?? '');
    expect(title.y + title.size * 0.72).toBeLessThan(backgrounds[0].y);
  });
});

describe('page breaks', () => {
  const filler = section('filler', [experience()]);

  it('keeps a label bar with its label, and both with the start of the section', async () => {
    const template: Template = {
      groups: [
        filler,
        section(
          'projects',
          [{ name: 'projects', source: 'objects', items: [text('projectName')] }],
          {
            label: label('Projects', {
              color: 'onSecondary',
              background: { color: 'secondary' },
              padding: { x: 'md', y: 'sm' },
            }),
          },
        ),
      ],
    };
    let crossed = false;
    for (let count = 1; count <= 7; count++) {
      const data = { ...multiPage, experience: multiPage.experience?.slice(0, count) };
      const { texts, backgrounds } = await record(template, data);
      const heading = textOf(texts, 'Projects');
      const bar = backgrounds[0];
      const first = textOf(texts, data.projects?.[0].projectName ?? '');
      crossed ||= heading.page > 0;
      expect(bar.pageIndex).toBe(heading.page);
      expect(inside([heading], bar)).toBe(true);
      expect(first.page).toBe(heading.page);
      expect(first.y + first.size * 0.72).toBeLessThan(bar.y);
    }
    // Some filler length pushed the section onto the next page.
    expect(crossed).toBe(true);
  });

  it('keeps each chip of a list inside an entry around its own text, across pages', async () => {
    const template: Template = {
      groups: [
        section('experience', [
          experience({
            items: [
              text('jobTitle', { font: 'semibold' }),
              {
                type: 'list',
                name: 'stack',
                output: 'row',
                gap: 'sm',
                chip: { background: { border: { color: 'neutral' }, radius: 3 } },
                item: style({ fontSize: 'sm' }),
              },
              { type: 'content', name: 'description', margins: { top: 'sm' } },
            ],
          }),
        ]),
      ],
    };
    const stack = ['TypeScript', 'React', 'PostgreSQL', 'Kubernetes', 'Terraform', 'Kafka'];
    const data = {
      ...multiPage,
      experience: multiPage.experience?.map((entry) => ({ ...entry, stack })),
    };
    const { texts, backgrounds, pageCount } = await record(template, data, { fontSize: 'xl' });
    expect(pageCount).toBeGreaterThan(1);
    const chips = texts.filter((t) => stack.includes(t.text));
    expect(chips).toHaveLength(stack.length * (data.experience?.length ?? 0));
    expect(backgrounds).toHaveLength(chips.length);
    for (const chip of chips) {
      const box = backgrounds.find(
        (b) =>
          b.pageIndex === chip.page && inside([chip], b) && chip.x + chip.width <= b.x + b.width,
      );
      expect(box).toBeDefined();
    }
    expect(new Set(chips.map((t) => t.page)).size).toBe(pageCount);
  });

  it('takes the joined text of a list inside an entry onto the next page whole', async () => {
    const template: Template = {
      groups: [
        section('experience', [
          experience({
            items: [
              text('jobTitle', { font: 'semibold' }),
              { type: 'list', name: 'stack', output: 'text', item: style() },
              { type: 'content', name: 'description' },
            ],
          }),
        ]),
      ],
    };
    const stack = ['TypeScript', 'React', 'PostgreSQL'];
    const data = {
      ...multiPage,
      experience: multiPage.experience?.map((entry) => ({ ...entry, stack })),
    };
    const { texts } = await record(template, data, { fontSize: 'xl' });
    const lines = texts.filter((t) => t.text === stack.join(', '));
    expect(lines).toHaveLength(data.experience?.length ?? 0);
    for (const line of lines) expect(line.y).toBeGreaterThan(30);
  });
});

describe('entries side by side', () => {
  const achievements = (count: number): ResumeData => ({
    ...mid,
    headlineAchievements: Array.from({ length: count }, (_, i) => ({
      value: `${i + 1}.2 million`,
      label: `result number ${i + 1}, with a label that is long enough to wrap onto a second line`,
    })),
  });
  const template = (before?: Group<ItemStyle>): Template => ({
    groups: [
      ...(before ? [before] : []),
      section('achievements', [
        {
          name: 'headlineAchievements',
          source: 'objects',
          columns: 3,
          padding: 'md',
          background: { border: { color: 'secondary', width: 3, sides: ['left'] } },
          items: [
            text('value', { fontSize: 'xl', font: 'bold' }),
            text('label', { fontSize: 'sm' }),
          ],
        },
      ]),
    ],
  });

  it('puts entries in columns, in boxes of equal height', async () => {
    const { texts, backgrounds } = await record(template(), achievements(3));
    expect(backgrounds).toHaveLength(3);
    const [a, b, c] = backgrounds;
    expect(new Set(backgrounds.map((box) => box.y)).size).toBe(1);
    expect(new Set(backgrounds.map((box) => box.height)).size).toBe(1);
    expect(a.x + a.width).toBeLessThan(b.x);
    expect(b.x + b.width).toBeLessThan(c.x);
    expect(c.x + c.width).toBeCloseTo(page.width - page.padding);
    const values = texts.filter((t) => t.text.endsWith('million'));
    expect(new Set(values.map((t) => t.y)).size).toBe(1);
  });

  it('starts a new row after every `columns` entries', async () => {
    const { backgrounds } = await record(template(), achievements(4));
    expect(backgrounds).toHaveLength(4);
    expect(backgrounds[3].x).toBe(backgrounds[0].x);
    expect(backgrounds[3].y + backgrounds[3].height).toBeLessThan(backgrounds[0].y);
  });

  it('keeps each row on one page', async () => {
    const filler = section('filler', [experience()]);
    for (let count = 4; count <= 7; count++) {
      const data = { ...achievements(6), experience: multiPage.experience?.slice(0, count) };
      const { backgrounds } = await record(template(filler), data);
      for (let row = 0; row < 6; row += 3) {
        const pages = backgrounds.slice(row, row + 3).map((box) => box.pageIndex);
        expect(new Set(pages).size).toBe(1);
      }
    }
  });
});

describe('lists inside an entry', () => {
  const template = (list: ItemStyle): Template => ({
    groups: [
      section('experience', [experience({ items: [text('jobTitle'), list, text('dateRange')] })]),
    ],
  });
  const data = (stacks: Array<string[] | undefined>): ResumeData => ({
    ...mid,
    experience: stacks.map((stack, i) => ({
      ...exp('Acme', 'Full-time', `Role ${i + 1}`, '2020 - 2021', []),
      stack,
    })),
  });

  it('joins a list into one line of text', async () => {
    const { texts } = await record(
      template({ type: 'list', name: 'stack', output: 'text', item: style() }),
      data([['TypeScript', 'Go', 'Postgres']]),
    );
    expect(texts.map((t) => t.text)).toContain('TypeScript, Go, Postgres');
  });

  it('draws a list as chips', async () => {
    const { texts, backgrounds } = await record(
      template({
        type: 'list',
        name: 'stack',
        output: 'row',
        gap: 'sm',
        chip: { background: { border: { color: 'neutral' }, radius: 3 } },
        item: style({ fontSize: 'sm' }),
      }),
      data([['TypeScript', 'Go', 'Postgres']]),
    );
    expect(backgrounds).toHaveLength(3);
    for (const name of ['TypeScript', 'Go', 'Postgres']) {
      const drawn = textOf(texts, name);
      expect(backgrounds.some((box) => inside([drawn], box) && drawn.x < box.x + box.width)).toBe(
        true,
      );
    }
  });

  it('takes no space when the list is empty', async () => {
    const item: ItemStyle = {
      type: 'list',
      name: 'stack',
      output: 'text',
      margins: { top: 'lg' },
      item: style(),
    };
    const empty = await record(template(item), data([[], undefined]));
    const none = await record(
      {
        groups: [
          section('experience', [experience({ items: [text('jobTitle'), text('dateRange')] })]),
        ],
      },
      data([[], undefined]),
    );
    expect(empty.texts).toEqual(none.texts);
  });
});

describe('chips', () => {
  const skills = Array.from({ length: 40 }, (_, i) => `Skill number ${i + 1}`);
  const template = (before?: Group<ItemStyle>): Template => ({
    groups: [
      ...(before ? [before] : []),
      section('skills', [
        {
          name: 'skills',
          source: 'root',
          join: {
            type: 'join',
            output: 'row',
            width: 0,
            gap: 'sm',
            chip: { background: { color: 'secondaryTint', radius: 4 } },
            item: style(),
          },
          items: [],
        },
      ]),
    ],
  });
  const overlap = (a: { x: number; y: number; width: number; height: number }, b: typeof a) =>
    Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > 0.5 &&
    Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > 0.5;

  it('wraps chips onto several lines without overlapping', async () => {
    const { texts, backgrounds } = await record(template(), { ...mid, skills });
    expect(backgrounds).toHaveLength(skills.length);
    expect(new Set(backgrounds.map((box) => box.y)).size).toBeGreaterThan(2);
    for (let i = 0; i < backgrounds.length; i++) {
      for (let j = i + 1; j < backgrounds.length; j++) {
        expect(overlap(backgrounds[i], backgrounds[j])).toBe(false);
      }
      expect(
        inside(
          [textOf(texts, skills[i])].filter((t) => t.text === skills[i]),
          backgrounds[i],
        ),
      ).toBe(true);
      expect(backgrounds[i].x + backgrounds[i].width).toBeLessThanOrEqual(
        page.width - page.padding + 0.5,
      );
    }
  });

  it('moves a whole line of chips to the next page', async () => {
    const filler = section('filler', [experience()]);
    for (let count = 5; count <= 7; count++) {
      const data = { ...multiPage, skills, experience: multiPage.experience?.slice(0, count) };
      const { backgrounds } = await record(template(filler), data);
      // Chips level with each other share a page.
      const lines = new Map<string, Set<number>>();
      for (const box of backgrounds) {
        const key = box.y.toFixed(1);
        lines.set(key, (lines.get(key) ?? new Set()).add(box.pageIndex));
      }
      for (const box of backgrounds) expect(box.y).toBeGreaterThan(0);
      for (const pages of lines.values()) expect(pages.size).toBeLessThanOrEqual(2);
    }
  });
});

describe('aside and timeline', () => {
  const asideWidth = 90;
  const template = (rule?: { color?: 'neutral' }): Template => ({
    groups: [
      section('experience', [
        experience({
          gap: 'sm',
          aside: { name: 'dateRange', width: asideWidth, gap: 'md', rule },
        }),
      ]),
    ],
  });

  it('puts the dates in a left column and the rest beside them', async () => {
    const data = { ...mid, experience: mid.experience?.slice(0, 2) };
    const { texts } = await record(template(), data);
    for (const entry of data.experience ?? []) {
      const date = textOf(texts, entry.dateRange);
      const title = textOf(texts, entry.jobTitle);
      expect(date.x).toBe(page.padding);
      expect(title.x).toBeCloseTo(page.padding + asideWidth + 6);
      expect(Math.abs(date.y - title.y)).toBeLessThan(3);
    }
  });

  it('draws a rule with a marker at each entry, across pages', async () => {
    const {
      texts,
      lines,
      circles: all,
      pageCount,
    } = await record(template({}), multiPage, {
      fontSize: 'xl',
    });
    // Markers, not the bullets of the descriptions.
    const circles = all.filter((circle) => circle.size === 3);
    expect(pageCount).toBeGreaterThan(1);
    const ruleX = page.padding + asideWidth + 6 * 1.4;
    const rules = lines.filter((line) => line.x1 === line.x2);
    expect(rules.length).toBeGreaterThan(0);
    expect(rules.every((line) => Math.abs(line.x1 - ruleX) < 0.01)).toBe(true);
    expect(circles).toHaveLength(multiPage.experience?.length ?? 0);
    // Each entry's date, title and marker start together on one page.
    for (const [index, entry] of (multiPage.experience ?? []).entries()) {
      // At this size the dates wrap in their column; their first line is enough.
      const date = textOf(texts, entry.dateRange.slice(0, 8));
      const title = textOf(texts, entry.jobTitle);
      expect(date.page).toBe(title.page);
      expect(circles[index].page).toBe(title.page);
    }
    // The rule reaches every page the entries are on.
    expect(new Set(rules.map((line) => line.page)).size).toBe(pageCount);
  });

  it('draws no rule without the rule option', async () => {
    const { lines, circles } = await record(template(), multiPage);
    expect(lines.filter((line) => line.x1 === line.x2)).toEqual([]);
    expect(circles.filter((circle) => circle.size === 3)).toEqual([]);
  });
});

describe('reading order', () => {
  it('writes the main column of a two-column template before the side column', async () => {
    const { texts } = await record(talvio, senior);
    const sideX = Math.min(...texts.filter((t) => t.text === 'Skills').map((t) => t.x));
    const lastMain = texts
      .map((t) => t.x < sideX - 1 && t.text !== senior.name && t.text !== senior.role)
      .lastIndexOf(true);
    const firstSide = texts.findIndex((t) => t.x >= sideX - 1);
    expect(lastMain).toBeLessThan(firstSide);
  });

  it('writes groups in config order', async () => {
    const template: Template = {
      groups: ['name', 'role', 'email', 'phone'].map((name) =>
        section(name, [{ name, source: 'root', items: [text(name)] }]),
      ),
    };
    const { texts } = await record(template, mid);
    expect(texts.map((t) => t.text)).toEqual([mid.name, mid.role, mid.email, mid.phone]);
  });
});

describe('rich text style', () => {
  it('never draws two lines of a mixed-font paragraph on top of each other', async () => {
    // A line that breaks at a space between runs in different fonts once ended with an empty
    // segment, and the next line was drawn over it. Narrow columns at large sizes hit that case.
    const overlapping = (texts: DrawnText[]) =>
      texts.filter((a, i) =>
        texts.some(
          (b, j) =>
            j > i &&
            a.page === b.page &&
            Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > 1 &&
            Math.abs(a.y - b.y) < a.size * 0.5,
        ),
      );
    for (const width of ['1/3', '2/5', '1/2'] as const) {
      for (const fontSize of ['md', 'lg', 'xl'] as const) {
        const template: Template = {
          groups: [
            section(
              'experience',
              [experience({ items: [{ type: 'content', name: 'description' }] })],
              { width },
            ),
          ],
        };
        const { texts } = await record(template, fixtures.richText, { fontSize });
        expect(overlapping(texts).map((t) => `${width} ${fontSize}: ${t.text}`)).toEqual([]);
      }
    }
  });

  it('draws rich text in the colour and family the template gives it', async () => {
    const template: Template = {
      groups: [
        section('experience', [
          experience({
            items: [
              {
                type: 'content',
                name: 'description',
                item: { color: 'secondary', family: 'serif' },
              },
            ],
          }),
        ]),
      ],
    };
    const { texts } = await record(template, { ...mid, experience: mid.experience?.slice(0, 1) });
    expect(texts.length).toBeGreaterThan(0);
    expect(new Set(texts.map((t) => t.font))).toEqual(new Set(['Times-Roman']));
    expect(new Set(texts.map((t) => t.color))).toEqual(new Set(['#00549F']));
  });
});
