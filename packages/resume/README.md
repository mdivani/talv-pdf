# @pdf-tlv/resume

Generate PDF resumes from structured data and a declarative layout template. Built on [pdf-lib](https://pdf-lib.js.org/) and [@pdf-lib/fontkit](https://github.com/Hopding/fontkit), written in TypeScript, and shipped with three ready-made templates.

## Installation

```sh
yarn add @pdf-tlv/resume
# or
npm install @pdf-tlv/resume
```

Out of the box the library uses the PDF standard fonts (Helvetica), so it renders offline and downloads nothing. Custom fonts and watermark images are downloaded with the global `fetch`, which needs Node.js 18 or later, or any modern browser.

## Quick start

```ts
import { writeFile } from 'node:fs/promises';
import { ResumePDFService, talvio, type ResumeData } from '@pdf-tlv/resume';

const data: ResumeData = {
  name: 'Jane Doe',
  role: 'Software Engineer',
  description: 'Full-stack engineer with five years of experience building web products.',
  email: 'jane@example.com',
  phone: '+1 555 0100',
  location: 'New York, USA',
  primaryProfile: 'linkedin.com/in/janedoe',
  skills: ['TypeScript', 'React', 'PostgreSQL'],
  languages: ['English - Native', 'Spanish - Fluent'],
  experience: [
    {
      kind: 'experience',
      jobTitle: 'Software Engineer',
      company: 'Acme',
      companyWithEmploymentType: 'Acme • Full-time',
      dateRange: 'Mar 2023 - Present',
      description: {
        type: 'doc',
        content: [
          {
            type: 'bulletList',
            content: [
              {
                type: 'listItem',
                content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Cut API latency by 70%.' }] }],
              },
            ],
          },
        ],
      },
    },
  ],
  education: [
    {
      kind: 'education',
      degree: 'BSc Computer Science',
      school: 'University of Edinburgh',
      dateRange: 'Sep 2017 - Jun 2021',
      dateRangeShort: '2017 - 2021',
    },
  ],
};

const service = new ResumePDFService();
await service.create({ color: '#005BA2' });

const bytes = await service.generate({ data, template: talvio });
await writeFile('resume.pdf', bytes);
```

`generate()` returns the PDF as a `Uint8Array`. You can call it again on the same service to render another resume. Each call renders into a new, empty document, so nothing from an earlier resume ends up in a later file. Calls on the same service run one at a time, even if you start them together.

## Built-in templates

The templates are exported from the package root:

```ts
import { talvio, ember, mint } from '@pdf-tlv/resume';
```

| Template | Layout | Suggested `color` |
| --- | --- | --- |
| `talvio` | Two columns. Experience, projects and recommendations sit on the left. Contact, skills, languages and education sit in a narrow right sidebar. | `'#005CA3'` |
| `ember` | Single column with section labels in a left gutter. Contact details are right-aligned in the header. | `'#660000'` |
| `mint` | Single column with a centered header and full-width sections. | `'#005408'` |

Every template uses your brand color for headings and accents. Each one is a plain `Template` object, so you can copy it and change any part.

## API

### `new ResumePDFService()`

Creates a renderer. Call `create()` once before the first `generate()`.

### `create(options?)`

Sets up the PDF document and loads the fonts. Every option is optional.

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `color` | hex string | `'#00549F'` | Brand color, used wherever a template asks for `secondary`. Shorthand for `colors.secondary`. |
| `colors` | `{ primary?, secondary?, neutral? }` | see [Colors](#colors) | Hex strings for any of the three template colors. `colors.secondary` wins over `color` when both are set. |
| `fontSize` | `'sm' \| 'md' \| 'lg' \| 'xl'` | `'lg'` | Scale applied to every font size in the template. |
| `leading` | `'sm' \| 'md' \| 'lg' \| 'xl'` | `'md'` | Scale applied to line height. |
| `screen` | `{ width, height, paddingX, paddingY }` | A4: `595 × 842`, padding `20` | Page size and margins, in PDF points. |
| `watermark` | `{ text?, url?, color? }` | none | Draws a small mark in the bottom-left corner of every page. `url` must point to a PNG. `color` is a hex string. |
| `customFont` | `{ name, fonts }` | Helvetica, built in | Typeface for every render. See [Fonts](#fonts) for the format. |

### `generate({ data, template, options? })`

Renders `data` with `template` and returns the PDF bytes.

`options` accepts `color`, `colors`, `fontSize`, `leading` and `customFont`. They apply to this render only. The next call goes back to the values from `create()`.

```ts
await service.generate({ data, template: ember, options: { color: '#660000' } });
await service.generate({ data, template: talvio }); // uses the color from create() again
```

### Fonts

Without `customFont`, every render uses Helvetica, one of the standard fonts built into every PDF viewer. Nothing is downloaded, so it works offline, in CI and in e2e tests, and a one-page resume is about 10 KB.

Helvetica only covers Western European characters. Any other character, for example Cyrillic, Greek or Georgian, is drawn as `?`. For those, use a custom font that covers them.

To use Inter, which the built-in templates are designed with, pass the bundled `interFont`. It is downloaded from Google Fonts, so the environment needs access to `fonts.gstatic.com`:

```ts
import { ResumePDFService, interFont } from '@pdf-tlv/resume';

await service.create({ customFont: interFont });
```

To use any other typeface, pass the URLs of its five font files:

```ts
await service.generate({
  data,
  template: talvio,
  options: {
    customFont: {
      name: 'Roboto',
      fonts: {
        regular: 'https://example.com/Roboto-Regular.ttf',
        semibold: 'https://example.com/Roboto-Medium.ttf',
        bold: 'https://example.com/Roboto-Bold.ttf',
        italic: 'https://example.com/Roboto-Italic.ttf',
        'bold-italic': 'https://example.com/Roboto-BoldItalic.ttf',
      },
    },
  },
});
```

All five font weights are required. If a file can't be downloaded, `create()` or `generate()` rejects with an error naming the file. Font files are downloaded once and cached on the service, so later renders with the same font don't download them again. The service keeps the `create()` font and the most recent other font.

Custom fonts are embedded whole, so a resume with Inter is about 920 KB. Set `subset: true` on a custom font to embed only the characters the resume uses, which brings a Roboto resume from about 400 KB to about 40 KB. Subsetting is off by default because the subsetter drops glyphs from some fonts, including Inter as served by Google Fonts, so check a few PDFs before you turn it on for a font.

### Colors

Templates refer to three color slots. Set any of them with `colors` in `create()`, or per render in `generate()` options.

| Slot | Default | Used for |
| --- | --- | --- |
| `primary` | `'#1C1C1C'` | Body text. |
| `secondary` | `'#00549F'` | Brand color: names, headings, icons and accents. |
| `neutral` | `'#7A7A7A'` | Muted text and dividers. |

```ts
await service.create({ colors: { primary: '#222222', secondary: '#660000', neutral: '#8A8A8A' } });
```

### Helpers

- `formatUrl(url)` strips the protocol and `www.` so links read cleanly, for example `linkedin.com/in/janedoe`.
- `formatDate(date, withMonth?)` formats a date as `Jun 2024`, or as `2024` when `withMonth` is `false`. It returns `Present` for an empty or invalid date.

## Resume data

`ResumeData` holds the resume content. Only `name` and `role` are required. Sections with no data are skipped.

| Field | Type | Notes |
| --- | --- | --- |
| `name`, `role` | string | Required. |
| `description` | string | Summary paragraph. |
| `email`, `phone`, `location` | string | Contact details. |
| `primaryProfile` | string | Main profile link. A LinkedIn URL gets the LinkedIn icon automatically. |
| `links` | `{ url, label? }[]` | Extra links. |
| `skills`, `tools`, `languages` | string[] | Simple lists. |
| `experience` | `FormattedExperience[]` | `jobTitle`, `company`, `companyWithEmploymentType`, `dateRange`, optional `employmentType`, `locationType` and `description`. |
| `education` | `FormattedEducation[]` | `degree`, `school`, `dateRange`, optional `dateRangeShort` and `description`. |
| `projects` | `FormattedProject[]` | `projectName`, `description`, optional `url`. |
| `recommendations` | `FormattedRecommendation[]` | `recommendeeName`, `url`, `description`. |

Each entry in `experience`, `education`, `projects` and `recommendations` also needs a `kind` field that matches its section: `'experience'`, `'education'`, `'project'` or `'recommendation'`.

The built-in templates show `locationType` on an experience entry, such as `'Remote'`, next to the company. They show `dateRangeShort` on an education entry, such as `'2017 - 2021'`, under or beside the degree. If `dateRangeShort` is missing, no date is shown for that entry.

### Rich text

`description` on experience, education, projects and recommendations is a rich text document in [TipTap](https://tiptap.dev/) / ProseMirror JSON format. The renderer supports paragraphs and bullet lists.

Keep each paragraph or list item to a single text run. Inline formatting such as bold or italic splits a paragraph into several runs, and the renderer can drop the later runs.

```ts
const description = {
  type: 'doc',
  content: [
    { type: 'paragraph', content: [{ type: 'text', text: 'Led the platform migration with zero downtime.' }] },
    {
      type: 'bulletList',
      content: [
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Retired the legacy database.' }] }] },
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Cut deploy time from 40 to 8 minutes.' }] }] },
      ],
    },
  ],
};
```

## Writing a template

A `Template` is a tree of groups. Groups set the layout. Fields inside a group pull values from the resume data, and items inside a field decide how each value is drawn.

```ts
import type { Template } from '@pdf-tlv/resume';

const minimal: Template = {
  groups: [
    {
      width: 'full',
      gap: 'md',
      fields: [
        {
          name: 'header',
          source: 'root',
          items: [
            { type: 'text', name: 'name', item: { fontSize: 'xl', font: 'semibold', color: 'secondary' } },
            { type: 'text', name: 'role', item: { fontSize: 'lg', font: 'regular', color: 'primary' } },
          ],
        },
      ],
    },
    {
      width: 'full',
      separator: 'primary',
      label: { text: 'Experience', fontSize: 'lg', font: 'semibold', color: 'secondary', margins: { bottom: 'md' } },
      fields: [
        {
          name: 'experience',
          source: 'objects',
          gap: 'md',
          items: [
            {
              type: 'row',
              keys: ['jobTitle', 'dateRange'],
              item: {
                justify: 'between',
                containerWidth: 400,
                texts: {
                  jobTitle: { fontSize: 'md', font: 'semibold', color: 'primary' },
                  dateRange: { fontSize: 'md', font: 'regular', color: 'primary' },
                },
              },
            },
            { type: 'text', name: 'company', item: { fontSize: 'md', font: 'regular', color: 'primary' } },
            { type: 'content', name: 'description', margins: { top: 'sm' } },
          ],
        },
      ],
    },
  ],
};
```

### Groups

| Property | Description |
| --- | --- |
| `width` | Share of the parent's width: `'full'`, `'1/2'`, `'1/3'`, `'2/3'`, `'2/5'` or `'3/5'`. |
| `direction` | Set to `'horizontal'` to place child groups side by side. |
| `gap` | Space between children: `'sm'`, `'md'`, `'lg'` or `'xl'`. |
| `label` | Section heading, drawn only when the group has data. Takes text styles plus `text` and `margins`. Set the label's own `direction: 'horizontal'` to put it beside the content instead of above it. |
| `separator` | Draws a divider line above the group when it has data: `'primary'`, `'secondary'` or `'tertiary'`. |
| `groups`, `fields` | Child groups, or the fields to render. |

### Fields

A field's `source` decides where its data comes from:

- `'root'` reads top-level values of `ResumeData`, such as `name` or `email`. Each item's `name` is the key to read.
- `'objects'` reads the array named by the field's `name`, such as `experience`. The items are repeated for every entry, and each item reads a key of that entry.
- `'strings'` reads a string array such as `skills`, and draws its single item once per string.

A field can also take its own `label`, `separator` and `gap`, which work as they do on groups.

Add `join` to a field to merge a list into one line instead, for example to show skills separated by commas. Set `output: 'row'` to lay the values out as a row instead of one text.

### Items

| Type | Draws |
| --- | --- |
| `text` | One value from the data. Long text wraps to the available width. |
| `row` | Several values on one line, listed in `keys`. `justify` can be `'between'`, `'center'` or `'start'`, and `separator` adds text such as `' \| '` between values. When the values don't fit on one line, the last value of a `'between'` row (usually a date) stays on the right and the others wrap in the space left. Otherwise values move to new lines, and a separator is never drawn at the start of a line. |
| `content` | A rich text document from the data. |

Text styles take a required `fontSize`, `font` and `color`, and these optional settings:

- **`font`** is one of `'regular'`, `'semibold'`, `'bold'`, `'italic'` or `'bold-italic'`.
- **`color`** is one of `'primary'` for body text, `'secondary'` for the brand color, or `'neutral'` for gray. See [Colors](#colors) to change them.
- **`maxWidth`** caps the width in points before the text wraps.
- **`icon`** puts an icon before the text: `'phone'`, `'pin'`, `'link'`, `'email'`, `'linkedin'`, `'book'` or `'cap'`.
- **`bullet`** puts a bullet before the text.
- **`underline`** underlines the text.
- **`wordBreaks`** lists extra characters the text may wrap at, such as `['/', '-']` for long URLs.
- **`leading`** overrides the line height for this text.

## License

MIT
