# @pdf-resume/pdf

A TypeScript library for generating highly customizable PDF resumes using [pdf-lib](https://pdf-lib.js.org/) and [@pdf-lib/fontkit](https://pdf-lib.js.org/docs/api/fontkit/). This package provides a flexible API to define resume templates, map data, and render professional resumes as PDFs.

## Features
- Define custom resume templates and layouts
- Map structured data to PDF templates
- Advanced font and icon support
- Written in TypeScript with full type safety

## Installation

```
yarn add @pdf-resume/pdf
# or
npm install @pdf-resume/pdf
```

## Usage

```typescript
import { ResumePDFService, ResumeData, Template } from '@pdf-resume/pdf';

const resumeData: ResumeData = {
  name: 'John Doe',
  role: 'Software Engineer',
  email: 'john@example.com',
  // ...other fields
};

const template: Template = {
  groups: [/* ...template definition... */],
};

const pdfService = new ResumePDFService();
await pdfService.create();
const pdfBytes = await pdfService.generate(resumeData, template);
// Save or send pdfBytes
```

## Main API

### `ResumePDFService`
- `create(config?)`: Initializes the PDF service (optionally with custom fonts, colors, etc.)
- `generate(data: ResumeData, template: Template)`: Generates a PDF from resume data and a template, returns a `Uint8Array` (PDF bytes)

### Types
- `ResumeData`: Structure for resume information (name, role, experience, education, etc.)
- `Template`: Structure for defining the layout and fields of the resume

## Advanced Usage
- Customize templates for different resume styles
- Use your own fonts by providing them in the config
- Extend or compose with provided services for more control

## License

MIT
