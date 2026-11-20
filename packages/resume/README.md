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
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Cut API latency by 70%.' }],
                  },
                ],
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

| Template | Layout                                                                                                                                         | Suggested `color` |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| `talvio` | Two columns. Experience, projects and recommendations sit on the left. Contact, skills, languages and education sit in a narrow right sidebar. | `'#005CA3'`       |
| `ember`  | Single column with section labels in a left gutter. Contact details are right-aligned in the header.                                           | `'#660000'`       |
| `mint`   | Single column with a centered header and full-width sections.                                                                                  | `'#005408'`       |

Every template uses your brand color for headings and accents. Each one is a plain `Template` object, so you can copy it and change any part.

Their sections can be reordered with [`sectionOrder`](#section-order). Each template lists its sections in `defaultSectionOrder`:

| Template        | Sections                                                                                                                                              |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ember`, `mint` | `summary`, `skills` (with tools and languages), `experience`, `education`, `projects`, `recommendations`.                                             |
| `talvio`        | Main column: `experience`, `projects`, `recommendations`. Side column: `skills` (skills and languages), `education`. The summary stays in the header. |

## API

### `new ResumePDFService()`

Creates a renderer. Call `create()` once before the first `generate()`.

### `create(options?)`

Sets up the PDF document and loads the fonts. Every option is optional.

| Option       | Type                                    | Default                       | Description                                                                                                     |
| ------------ | --------------------------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `color`      | hex string                              | `'#00549F'`                   | Brand color, used wherever a template asks for `secondary`. Shorthand for `colors.secondary`.                   |
| `colors`     | `{ primary?, secondary?, neutral? }`    | see [Colors](#colors)         | Hex strings for any of the three template colors. `colors.secondary` wins over `color` when both are set.       |
| `fontSize`   | `'sm' \| 'md' \| 'lg' \| 'xl'`          | `'lg'`                        | Scale applied to every font size in the template.                                                               |
| `leading`    | `'sm' \| 'md' \| 'lg' \| 'xl'`          | `'md'`                        | Scale applied to line height.                                                                                   |
| `screen`     | `{ width, height, paddingX, paddingY }` | A4: `595 × 842`, padding `20` | Page size and margins, in PDF points.                                                                           |
| `watermark`  | `{ text?, url?, color? }`               | none                          | Draws a small mark in the bottom-left corner of every page. `url` must point to a PNG. `color` is a hex string. |
| `customFont` | `{ name, fonts }`                       | Helvetica, built in           | Typeface for every render. Shorthand for `fonts.body`. See [Fonts](#fonts) for the format.                      |
| `fonts`      | `{ body?, serif?, mono? }`              | Helvetica, Times, Courier     | Font files for each typeface role. See [Fonts](#fonts).                                                         |

### `generate({ data, template, options?, sectionOrder? })`

Renders `data` with `template` and returns the PDF bytes.

`options` accepts `color`, `colors`, `fontSize`, `leading`, `customFont` and `fonts`. They apply to this render only. The next call goes back to the values from `create()`.

`sectionOrder` lists section names in the order to draw them. See [Section order](#section-order).

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

All five font weights are required. If a file can't be downloaded, `create()` or `generate()` rejects with an error naming the file. Font files are downloaded once and cached on the service, so later renders with the same font don't download them again. The service keeps the `create()` fonts and the three most recent other families.

#### Typeface roles

Text in a template uses one of three typeface roles, set with `family` on a text style or for a whole template:

| Role    | Without font files | Typical use                              |
| ------- | ------------------ | ---------------------------------------- |
| `body`  | Helvetica          | Everything that doesn't name a role.     |
| `serif` | Times              | Names and headings in a classic layout.  |
| `mono`  | Courier            | Dates, contact lines, technical details. |

Pass font files for any role with `fonts`, in the same `{ name, fonts }` shape as `customFont`. Roles without files keep the standard font. Only the roles a template uses are embedded.

```ts
await service.create({
  fonts: {
    body: interFont,
    serif: {
      name: 'Source Serif 4',
      fonts: { regular: '…', semibold: '…', bold: '…', italic: '…', 'bold-italic': '…' },
    },
  },
});
```

The package ships no font files. If any role a template uses has no font files, all text is limited to the characters Helvetica covers, as described above.

#### File size

Custom fonts are embedded whole, so a resume with Inter is about 920 KB, and each extra family adds the size of its files. Set `subset: true` on a custom font to embed only the characters the resume uses, which brings a Roboto resume from about 400 KB to about 40 KB. Subsetting is off by default because the subsetter drops glyphs from some fonts, including Inter as served by Google Fonts, so check a few PDFs before you turn it on for a font.

### Colors

Templates refer to three color slots. Set any of them with `colors` in `create()`, or per render in `generate()` options.

| Slot        | Default     | Used for                                         |
| ----------- | ----------- | ------------------------------------------------ |
| `primary`   | `'#1C1C1C'` | Body text.                                       |
| `secondary` | `'#00549F'` | Brand color: names, headings, icons and accents. |
| `neutral`   | `'#7A7A7A'` | Muted text and dividers.                         |

```ts
await service.create({ colors: { primary: '#222222', secondary: '#660000', neutral: '#8A8A8A' } });
```

Templates can also use three colors worked out from those:

| Color           | Value                                                                                                                                                                                    |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `onSecondary`   | Text on a `secondary` background. White if it reaches a 4.5:1 contrast ratio with the brand color, otherwise `primary` if that does, otherwise black or white, whichever contrasts more. |
| `secondaryTint` | A light tint of the brand color, for boxes behind body text.                                                                                                                             |
| `white`         | White.                                                                                                                                                                                   |

### Helpers

- `formatUrl(url)` strips the protocol and `www.` so links read cleanly, for example `linkedin.com/in/janedoe`.
- `formatDate(date, withMonth?)` formats a date as `Jun 2024`, or as `2024` when `withMonth` is `false`. It returns `Present` for an empty or invalid date.

## Resume data

`ResumeData` holds the resume content. Only `name` and `role` are required. Sections with no data are skipped.

| Field                          | Type                        | Notes                                                                                                                                             |
| ------------------------------ | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`, `role`                 | string                      | Required.                                                                                                                                         |
| `description`                  | string                      | Summary paragraph.                                                                                                                                |
| `email`, `phone`, `location`   | string                      | Contact details.                                                                                                                                  |
| `primaryProfile`               | string                      | Main profile link. A LinkedIn URL gets the LinkedIn icon automatically.                                                                           |
| `links`                        | `{ url, label? }[]`         | Extra links.                                                                                                                                      |
| `skills`, `tools`, `languages` | string[]                    | Simple lists.                                                                                                                                     |
| `skillGroups`                  | `{ name, skills }[]`        | Skills in named groups, such as `{ name: 'Architecture', skills: ['Microservices'] }`. Keep `skills` filled as well.                              |
| `headlineAchievements`         | `{ value, label }[]`        | Up to three results to lead with, such as `{ value: '1.2 million', label: 'patients on the platform' }`.                                          |
| `experience`                   | `FormattedExperience[]`     | `jobTitle`, `company`, `companyWithEmploymentType`, `dateRange`, optional `employmentType`, `locationType`, `stack` (string[]) and `description`. |
| `education`                    | `FormattedEducation[]`      | `degree`, `school`, `dateRange`, optional `dateRangeShort` and `description`.                                                                     |
| `projects`                     | `FormattedProject[]`        | `projectName`, `description`, optional `url`.                                                                                                     |
| `recommendations`              | `FormattedRecommendation[]` | `recommendeeName`, `url`, `description`.                                                                                                          |

Each entry in `experience`, `education`, `projects` and `recommendations` also needs a `kind` field that matches its section: `'experience'`, `'education'`, `'project'` or `'recommendation'`.

The built-in templates don't use `skillGroups`, `headlineAchievements` or `stack`; they are for templates built on top of the package.

The built-in templates show `locationType` on an experience entry, such as `'Remote'`, next to the company. They show `dateRangeShort` on an education entry, such as `'2017 - 2021'`, under or beside the degree. If `dateRangeShort` is missing, no date is shown for that entry. An education entry's `description` is shown below it when there is one.

### Rich text

`description` on experience, education, projects and recommendations is a rich text document in [TipTap](https://tiptap.dev/) / ProseMirror JSON format. The renderer supports:

- paragraphs, including inline `bold` and `italic` marks, which can be mixed within a line
- bullet lists, including nested lists
- hard breaks (`hardBreak`, Shift+Enter in the editor), which start a new line
- empty paragraphs between two others, which leave a blank line (leading and trailing ones are ignored)

Other marks, such as links or underline, are drawn as plain text.

```ts
const description = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Led the platform migration with ' },
        { type: 'text', text: 'zero downtime', marks: [{ type: 'bold' }] },
        { type: 'text', text: '.' },
      ],
    },
    {
      type: 'bulletList',
      content: [
        {
          type: 'listItem',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Retired the legacy database.' }],
            },
          ],
        },
        {
          type: 'listItem',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Cut deploy time from 40 to 8 minutes.' }],
            },
          ],
        },
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
            {
              type: 'text',
              name: 'name',
              item: { fontSize: 'xl', font: 'semibold', color: 'secondary' },
            },
            {
              type: 'text',
              name: 'role',
              item: { fontSize: 'lg', font: 'regular', color: 'primary' },
            },
          ],
        },
      ],
    },
    {
      width: 'full',
      separator: 'primary',
      label: {
        text: 'Experience',
        fontSize: 'lg',
        font: 'semibold',
        color: 'secondary',
        margins: { bottom: 'md' },
      },
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
            {
              type: 'text',
              name: 'company',
              item: { fontSize: 'md', font: 'regular', color: 'primary' },
            },
            { type: 'content', name: 'description', margins: { top: 'sm' } },
          ],
        },
      ],
    },
  ],
};
```

### Groups

| Property           | Description                                                                                                                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `width`            | Share of the parent's width: `'full'`, `'1/2'`, `'1/3'`, `'2/3'`, `'2/5'` or `'3/5'`.                                                                                                             |
| `direction`        | Set to `'horizontal'` to place child groups side by side.                                                                                                                                         |
| `gap`              | Space between children: `'sm'`, `'md'`, `'lg'` or `'xl'`.                                                                                                                                         |
| `label`            | Section heading, drawn only when the group has data. Takes text styles plus `text` and `margins`. Set the label's own `direction: 'horizontal'` to put it beside the content instead of above it. |
| `separator`        | Draws a divider line above the group when it has data: `'primary'`, `'secondary'` or `'tertiary'`.                                                                                                |
| `section`          | Section name, such as `'experience'`, for [Section order](#section-order).                                                                                                                        |
| `background`       | A box behind the group. See [Backgrounds](#backgrounds).                                                                                                                                          |
| `padding`          | Space between the group's edge and its content: a size, or `{ x?, y? }`.                                                                                                                          |
| `when`, `unless`   | Draw the group only when a top-level data key has a value (`when`), or only when it is empty (`unless`). Use a pair to show a fallback, such as one skills line `unless: 'skillGroups'`.          |
| `groups`, `fields` | Child groups, or the fields to render.                                                                                                                                                            |

A label takes these extra settings:

- **`column`** puts the label in a column of that width (in points) on the left, with the content beside it. The label wraps inside the column, and the next section starts below the label or the content, whichever is longer.
- **`background`** and **`padding`** draw a bar behind the label, as wide as its group.

### Fields

A field's `source` decides where its data comes from:

- `'root'` reads top-level values of `ResumeData`, such as `name` or `email`. Each item's `name` is the key to read.
- `'objects'` reads the array named by the field's `name`, such as `experience`. The items are repeated for every entry, and each item reads a key of that entry.
- `'strings'` reads a string array such as `skills`, and draws its single item once per string.

A field can also take its own `label`, `separator` and `gap`, which work as they do on groups. A field label with `column` puts the label beside the field's values; the next field starts below whichever is longer.

Add `join` to a field to merge a list into one line instead, for example to show skills separated by commas. Set `output: 'row'` to lay the values out as a row instead of one text, and add `chip` to draw each value in a small box.

Fields reading a list (`source: 'objects'`) can also take:

| Property                | Description                                                                                                                                                                                                                                             |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `columns`               | Lay the entries out side by side, this many to a row. Boxes in a row are as tall as the tallest, and a row is never split across pages.                                                                                                                 |
| `aside`                 | `{ name, width, gap?, rule? }`. Puts the item called `name` (such as `dateRange`) in a column of `width` points on the left, with the other items beside it. With `rule`, a vertical line with a marker per entry runs between the columns: a timeline. |
| `background`, `padding` | A box behind each entry. A border on one side only draws a bar or a rule, such as `{ border: { color: 'neutral', sides: ['bottom'] } }` under each row of a table.                                                                                      |
| `headingItems`          | How many items at the start of each entry form its heading, such as a company row then a title row. The heading moves to the next page with the first lines of what follows rather than end a page. Defaults to 1.                                      |
| `when`, `unless`        | As on groups.                                                                                                                                                                                                                                           |

### Items

| Type      | Draws                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `text`    | One value from the data. Long text wraps to the available width.                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `row`     | Several values on one line, listed in `keys`. `justify` can be `'between'`, `'split'` (every value but the last flows from the left, the last sits on the right), `'start'`, `'center'` or `'end'`, and `separator` adds text such as `' \| '` between values. When the values don't fit on one line, the last value of a `'between'` row (usually a date) stays on the right and the others wrap in the space left. Otherwise values move to new lines, and a separator is never drawn at the start of a line. |
| `content` | A rich text document from the data. Its optional `item` sets the `color`, `fontSize`, `family` and `leading` of the text.                                                                                                                                                                                                                                                                                                                                                                                       |
| `list`    | A list of strings inside an entry, such as the `stack` of a job. `output: 'text'` joins the values with `separator` (`', '` by default); `output: 'row'` lays them out as a row, and `chip` draws each in a small box. An empty list takes no space.                                                                                                                                                                                                                                                            |

Text styles take a required `fontSize`, `font` and `color`, and these optional settings:

- **`font`** is one of `'regular'`, `'semibold'`, `'bold'`, `'italic'` or `'bold-italic'`.
- **`color`** is one of `'primary'` for body text, `'secondary'` for the brand color, `'neutral'` for gray, or one of the derived `'onSecondary'`, `'secondaryTint'` and `'white'`. See [Colors](#colors).
- **`family`** is the typeface role: `'body'`, `'serif'` or `'mono'`. See [Fonts](#fonts).
- **`iconColor`** sets the icon's color. Defaults to `'secondary'`.
- **`maxWidth`** caps the width in points before the text wraps.
- **`icon`** puts an icon before the text: `'phone'`, `'pin'`, `'link'`, `'email'`, `'linkedin'`, `'book'` or `'cap'`.
- **`bullet`** puts a bullet before the text.
- **`underline`** underlines the text.
- **`wordBreaks`** lists extra characters the text may wrap at, such as `['/', '-']` for long URLs.
- **`leading`** overrides the line height for this text.

A template can also set `family`, the typeface role for text that names none, and `defaultSectionOrder`.

### Backgrounds

`background` draws a box behind a group, a list entry, a label or a chip:

| Property     | Description                                                                                                                       |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `color`      | Fill color. Leave it out for an outline only.                                                                                     |
| `border`     | `{ color, width?, sides? }`. An outline 0.5 points wide by default, on every side or only on the listed ones.                     |
| `radius`     | Corner radius in points.                                                                                                          |
| `bleed`      | Extend the box to the page edge on every side where it touches the page margin, such as a header band across the top of the page. |
| `fullHeight` | Groups only. Fill the full page height on the group's first page and every page after it, such as a colored side column.          |

Boxes are drawn behind all text and lines. A group's box is drawn under the boxes inside it. A box split by a page break is drawn on each page around its part of the content, and a small box (a list entry, a row of side-by-side entries) moves to the next page rather than split. Groups and entries with no content draw no box.

### Section order

Name the groups you want to make movable with `section`, and list the default order in the template's `defaultSectionOrder`. Then pass `sectionOrder` to `generate()`:

```ts
await service.generate({ data, template: talvio, sectionOrder: ['education', 'experience'] });
```

- Sections only move among the groups next to them, so in a two-column template a section stays in its column.
- Groups without a `section` name, such as the header, stay where they are.
- Unknown names are ignored. Sections missing from `sectionOrder` follow in the default order.
- Several groups can share a name, and they then move together.

Groups are written to the PDF in the order they are drawn, which is the order text extraction and screen readers read them in. In a two-column template, put the main column first in the config, whichever side of the page it is on.

## License

MIT
