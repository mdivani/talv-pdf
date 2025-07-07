# pdf-resume

A TypeScript module for generating PDF resumes using [pdf-lib](https://pdf-lib.js.org/) and [@pdf-lib/fontkit](https://pdf-lib.js.org/docs/api/fontkit/). Open source and ready for integration into your projects.

## Features
- Generate professional PDF resumes programmatically
- Uses `pdf-lib` and `@pdf-lib/fontkit` for advanced PDF and font handling
- Written in TypeScript for type safety and maintainability

## Installation

```
yarn add @pdf-tlv/resume
# or
npm install @pdf-tlv/resume
```

## Usage

```typescript
import { ResumePDFService, ResumeData } from '@pdf-tlv/resume';

export const exampleTemplate: Template = {
  groups: [
    {
      width: 'full',
      direction: 'horizontal',
      gap: 'sm',
      groups: [
        {
          width: '1/2',
          fields: headerFields,
        },
        {
          width: '1/2',
          fields: contactFields,
        },
      ],
    },
    {
      width: 'full',
      fields: summaryFields,
    },
    {
      width: 'full',
      separator: 'primary',
      gap: 'md',
      fields: [
        {
          name: 'skills',
          source: 'strings',
          label: {
            text: 'Skills',
            fontSize: 'md',
            color: 'primary',
            font: 'semibold',
            maxWidth: 120,
            direction: 'horizontal',
          },
          join: {
            type: 'join',
            output: 'text',
            separator: ', ',
            width: 500,
            margins: { bottom: 'md' },
            item: {
              fontSize: 'md',
              color: 'primary',
              font: 'regular',
            },
          },
          items: [],
        },
        {
          name: 'tools',
          source: 'strings',
          label: {
            text: 'Tools',
            fontSize: 'md',
            color: 'primary',
            font: 'semibold',
            maxWidth: 120,
            direction: 'horizontal',
          },
          join: {
            type: 'join',
            output: 'text',
            separator: ', ',
            width: 500,
            margins: { bottom: 'md' },
            item: {
              fontSize: 'md',
              color: 'primary',
              font: 'regular',
            },
          },
          items: [],
        },
        {
          name: 'languages',
          source: 'strings',
          label: {
            text: 'Languages',
            fontSize: 'md',
            color: 'primary',
            font: 'semibold',
            direction: 'horizontal',
            maxWidth: 120,
          },
          join: {
            type: 'join',
            output: 'text',
            separator: ', ',
            width: 500,
            margins: { bottom: 'md' },
            item: {
              fontSize: 'md',
              color: 'primary',
              font: 'regular',
            },
          },
          items: [],
        },
      ],
    },
    {
      width: 'full',
      separator: 'primary',
      gap: 'md',
      label: {
        text: 'Experience',
        fontSize: 'lg',
        color: 'primary',
        font: 'semibold',
        direction: 'horizontal',
        maxWidth: 120,
      },
      fields: [
  {
    name: 'experience',
    source: 'objects',
    items: [
      {
        type: 'row',
        keys: ['jobTitle', 'dateRange'],
        item: {
          texts: {
            jobTitle: {
              fontSize: 'md',
              color: 'secondary',
              maxWidth: 200,
              font: 'semibold',
            },
            dateRange: {
              fontSize: 'md',
              color: 'primary',
              maxWidth: 200,
              font: 'regular',
            },
          },
          justify: 'between',
          containerWidth: 400,
        },
      },
      {
        type: 'row',
        keys: ['company', 'locationType'],
        item: {
              texts: {
                company: {
                  fontSize: 'md',
                  color: 'primary',
                  maxWidth: 200,
                  font: 'regular',
                },
                locationType: {
                  fontSize: 'md',
                  color: 'primary',
                  maxWidth: 200,
                  font: 'regular',
                },
              },
              justify: 'between',
              containerWidth: 400,
            },
          },
          {
            name: 'description',
            margins: { top: 'sm' },
            type: 'content',
          },
        ],
      },
    ],
    },
    {
      width: 'full',
      separator: 'primary',
      label: {
        text: 'Education',
        fontSize: 'lg',
        color: 'primary',
        font: 'semibold',
        direction: 'horizontal',
        maxWidth: 120,
      },
      gap: 'md',
      fields: educationFields,
    },
    {
      width: 'full',
      separator: 'primary',
      label: {
        text: 'Projects',
        fontSize: 'lg',
        color: 'primary',
        font: 'semibold',
        direction: 'horizontal',
        maxWidth: 120,
      },
      fields: projectsFields,
    },
    {
      width: 'full',
      separator: 'primary',
      label: {
        text: 'References',
        fontSize: 'lg',
        color: 'primary',
        font: 'semibold',
        direction: 'horizontal',
        maxWidth: 120,
      },
      fields: recommendationsFields,
    },
  ],
};

const resumeData: ResumeData = {
    name: 'John Doe,
    role: 'Software engineer,
    description: 'Personal Summary',
    phone: '+1 77 XXXXX XXXX',
    email: 'johndoe@gmail.com',
    primaryProfile: 'https://linkedin.com/in',
    skills: ['Javascript', 'Typescript', 'C#'],
    tools: ['Figma', 'Slack', 'Chatgpt'],
    links: [{ url: 'https://portfolio.co' }],
    recommendations: [{
      recommendeeName: 'Jane Doe',
      url: 'https://talvio.co/janedoe',
      formattedUrl: 'talvio.co/janedoe',
      description: { type: 'doc', content: [] }, // tipat content
    }],
    experience: [{
      locationType: 'Remote',
      jobTitle: 'Jenitor',
      dateRange: `Jun 2024 - May 2025`,
      company: 'Talvio',
      employmentType: 'Contract',
      companyWithEmploymentType: 'Talvio • Contract',
      description: { type: 'doc', content: [] }, // tipat content
    }],
    education: data.education?.map((education) => ({
      school: 'Harward',
      degree: 'Bachelors Degree',
      description: { type: 'doc', content: [] }, // tipat content
      dateRangeShort: `2011 - 2017`,
      dateRange: `Sep 2011 - Jun 2017`,
    })),
    projects: data.projects?.map((project) => ({
      projectName: 'Pdf-tlv',
      url: 'https://www.npmjs.com/package/@pdf-tlv/resume',
      formattedUrl: 'npmjs.com/package/@pdf-tlv/resume',
      description: { type: 'doc', content: [] },
    })),
    location: 'New York, USA',
    languages: [ 'English - Proficient', 'Spanish - Native' ],
  };

const pdfService = new ResumePDFService();
await pdfService.create({
        fonts: ['regular', 'semibold', 'bold', 'italic', 'bold-italic'],
        screen: {
          width: 555,
          height: 800,
          paddingX: 20,
          paddingY: 20,
        },
        color, // hex color
        fontSize,
        leading: 'md',
        isPreview,
      });
const pdfBytes = await pdfService.generate(resumeData, exampleTemplate);
// Save or send pdfBytes (Uint8Array)
```

## Development

- Clone the repo
- Run `yarn install` to install dependencies
- Build with `yarn build`

## License

MIT
