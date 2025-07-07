# pdf-resume

A TypeScript module for generating PDF resumes using [pdf-lib](https://pdf-lib.js.org/) and [@pdf-lib/fontkit](https://pdf-lib.js.org/docs/api/fontkit/). Open source and ready for integration into your projects.

## Features
- Generate professional PDF resumes programmatically
- Uses `pdf-lib` and `@pdf-lib/fontkit` for advanced PDF and font handling
- Written in TypeScript for type safety and maintainability

## Installation

```
yarn add pdf-resume
# or
npm install pdf-resume
```

## Usage

```typescript
import { createResume } from 'pdf-resume';

const pdfBytes = await createResume({
  name: 'John Doe',
  experience: [...],
  // ...other fields
});
// Save or send pdfBytes
```

## Development

- Clone the repo
- Run `yarn install` to install dependencies
- Build with `yarn build`

## License

MIT
