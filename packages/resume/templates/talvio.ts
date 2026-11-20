import { Field, ItemStyle, Template } from '../types';

const headerFields: Field<ItemStyle>[] = [
  {
    name: 'header',
    source: 'root',
    gap: 'sm',
    items: [
      {
        name: 'name',
        type: 'text',
        item: {
          fontSize: 'xl',
          color: 'secondary',
          maxWidth: 400,
          font: 'semibold',
          leading: 'sm',
        },
      },
      {
        name: 'role',
        type: 'text',
        item: {
          fontSize: 'lg',
          color: 'primary',
          maxWidth: 400,
          font: 'regular',
        },
      },
    ],
  },
  {
    name: 'summary',
    source: 'root',
    gap: 'md',
    items: [
      {
        name: 'description',
        type: 'text',
        item: {
          fontSize: 'md',
          color: 'primary',
          font: 'regular',
        },
      },
    ],
  },
];

const experienceFields: Field<ItemStyle>[] = [
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
              color: 'primary',
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
];

const educationFields: Field<ItemStyle>[] = [
  {
    name: 'education',
    source: 'objects',
    gap: 'sm',
    items: [
      // Degree and date are stacked rather than placed in one row: the education block
      // lives in the narrow 1/3 sidebar, where a row would squeeze a long degree into the
      // space left of the date (MDI-422).
      {
        type: 'text',
        name: 'degree',
        item: {
          fontSize: 'md',
          color: 'primary',
          font: 'bold',
        },
      },
      {
        type: 'text',
        name: 'dateRangeShort',
        item: {
          fontSize: 'sm',
          color: 'primary',
          font: 'regular',
        },
      },
      {
        type: 'text',
        name: 'school',
        item: {
          fontSize: 'md',
          color: 'primary',
          maxWidth: 150,
          font: 'regular',
          icon: 'cap',
          iconIndent: 'sm',
        },
      },
      {
        name: 'description',
        margins: { top: 'sm' },
        type: 'content',
      },
    ],
  },
];

const recommendationsFields: Field<ItemStyle>[] = [
  {
    name: 'recommendations',
    source: 'objects',
    gap: 'sm',
    items: [
      {
        type: 'text',
        name: 'recommendeeName',
        item: {
          fontSize: 'md',
          color: 'primary',
          maxWidth: 200,
          font: 'semibold',
        },
      },
      {
        type: 'text',
        name: 'url',
        item: {
          fontSize: 'md',
          color: 'primary',
          maxWidth: 200,
          font: 'regular',
          underline: true,
          icon: 'link',
        },
      },
      {
        name: 'description',
        margins: { top: 'sm' },
        type: 'content',
      },
    ],
  },
];

const projectsFields: Field<ItemStyle>[] = [
  {
    name: 'projects',
    source: 'objects',
    gap: 'sm',
    items: [
      {
        type: 'text',
        name: 'projectName',
        item: {
          fontSize: 'md',
          color: 'primary',
          maxWidth: 200,
          font: 'semibold',
        },
      },
      {
        type: 'text',
        name: 'url',
        item: {
          fontSize: 'md',
          color: 'primary',
          underline: true,
          maxWidth: 200,
          font: 'regular',
          icon: 'link',
        },
      },
      {
        name: 'description',
        margins: { top: 'sm' },
        type: 'content',
      },
    ],
  },
];

export const talvio: Template = {
  groups: [
    {
      width: 'full',
      gap: 'md',
      fields: headerFields,
    },
    {
      width: 'full',
      direction: 'horizontal',
      gap: 'xl',
      groups: [
        {
          width: '2/3',
          gap: 'lg',
          groups: [
            {
              width: 'full',
              label: {
                fontSize: 'lg',
                color: 'secondary',
                maxWidth: 200,
                text: 'Experience',
                font: 'semibold',
                margins: { bottom: 'md' },
              },
              gap: 'lg',
              fields: experienceFields,
            },
            {
              width: 'full',
              label: {
                fontSize: 'lg',
                color: 'secondary',
                maxWidth: 200,
                text: 'Projects',
                font: 'semibold',
                margins: { bottom: 'md' },
              },
              gap: 'md',
              fields: projectsFields,
            },
            {
              width: 'full',
              label: {
                fontSize: 'lg',
                color: 'secondary',
                maxWidth: 200,
                text: 'Recommendations',
                font: 'semibold',
                margins: { bottom: 'md' },
              },
              gap: 'md',
              fields: recommendationsFields,
            },
          ],
        },
        {
          width: '1/3',
          gap: 'md',
          groups: [
            {
              width: 'full',
              label: {
                text: 'Contact',
                fontSize: 'lg',
                color: 'secondary',
                font: 'semibold',
                margins: { bottom: 'md' },
                maxWidth: 200,
              },
              fields: [
                {
                  name: 'links',
                  source: 'objects',
                  gap: 'sm',
                  items: [
                    {
                      type: 'text',
                      name: 'url',
                      item: {
                        fontSize: 'md',
                        color: 'primary',
                        icon: 'link',
                        font: 'regular',
                        wordBreaks: ['/', '-'],
                        underline: true,
                      },
                    },
                  ],
                },
                {
                  name: 'contact',
                  gap: 'sm',
                  source: 'root',
                  items: [
                    {
                      type: 'text',
                      name: 'primaryProfile',
                      item: {
                        fontSize: 'md',
                        color: 'primary',
                        maxWidth: 200,
                        font: 'regular',
                        underline: true,
                        icon: 'link',
                      },
                    },
                    {
                      type: 'text',
                      name: 'email',
                      item: {
                        fontSize: 'md',
                        color: 'primary',
                        maxWidth: 200,
                        font: 'regular',
                        icon: 'email',
                      },
                    },
                    {
                      type: 'text',
                      name: 'phone',
                      item: {
                        fontSize: 'md',
                        color: 'primary',
                        maxWidth: 200,
                        font: 'regular',
                        icon: 'phone',
                      },
                    },
                    {
                      type: 'text',
                      name: 'location',
                      item: {
                        fontSize: 'md',
                        color: 'primary',
                        maxWidth: 200,
                        font: 'regular',
                        icon: 'pin',
                      },
                    },
                  ],
                },
              ],
            },
            {
              width: 'full',
              fields: [
                {
                  name: 'skills',
                  source: 'strings',
                  label: {
                    fontSize: 'lg',
                    color: 'secondary',
                    maxWidth: 200,
                    text: 'Skills',
                    font: 'semibold',
                    margins: { bottom: 'md' },
                  },
                  gap: 'sm',
                  items: [
                    {
                      type: 'text',
                      name: 'skill',
                      item: {
                        fontSize: 'md',
                        color: 'primary',
                        maxWidth: 200,
                        bullet: true,
                        font: 'regular',
                      },
                    },
                  ],
                },
              ],
            },
            {
              width: 'full',
              fields: [
                {
                  name: 'languages',
                  source: 'strings',
                  label: {
                    fontSize: 'lg',
                    color: 'secondary',
                    maxWidth: 200,
                    text: 'Languages',
                    font: 'semibold',
                    margins: { bottom: 'md' },
                  },
                  gap: 'sm',
                  items: [
                    {
                      type: 'text',
                      name: 'language',
                      item: {
                        fontSize: 'md',
                        color: 'primary',
                        maxWidth: 200,
                        bullet: true,
                        font: 'regular',
                      },
                    },
                  ],
                },
              ],
            },
            {
              width: 'full',
              label: {
                fontSize: 'lg',
                color: 'secondary',
                maxWidth: 200,
                text: 'Education',
                font: 'semibold',
                margins: { bottom: 'md' },
              },
              gap: 'md',
              fields: educationFields,
            },
          ],
        },
      ],
    },
  ],
};
