import { Field, ItemStyle, Template } from '../types';

const headerFields: Field<ItemStyle>[] = [
  {
    name: 'header',
    source: 'root',
    gap: 'sm',
    items: [
      {
        type: 'row',
        keys: ['name'],
        item: {
          texts: {
            name: {
              fontSize: 'xl',
              color: 'secondary',
              maxWidth: 400,
              font: 'bold',
              leading: 'sm',
            },
          },
          justify: 'center',
          containerWidth: 400,
        },
      },
      {
        type: 'row',
        keys: ['role'],
        item: {
          texts: {
            role: {
              fontSize: 'lg',
              color: 'primary',
              maxWidth: 400,
              font: 'regular',
            },
          },
          justify: 'center',
          containerWidth: 400,
        },
      },
    ],
  },
];

const contactFields: Field<ItemStyle>[] = [
  {
    name: 'contact',
    gap: 'sm',
    source: 'root',
    items: [
      {
        type: 'row',
        keys: ['primaryProfile', 'email', 'phone'],
        item: {
          texts: {
            primaryProfile: {
              fontSize: 'md',
              color: 'primary',
              maxWidth: 200,
              font: 'regular',
              icon: 'link',
              iconIndent: 'sm',
              underline: true,
            },
            email: {
              fontSize: 'md',
              color: 'primary',
              maxWidth: 200,
              font: 'regular',
              iconIndent: 'sm',
              icon: 'email',
            },
            phone: {
              fontSize: 'md',
              color: 'primary',
              maxWidth: 200,
              font: 'regular',
              iconIndent: 'sm',
              icon: 'phone',
            },
          },
          gap: 'md',
          justify: 'center',
          containerWidth: 200,
        },
      },
      {
        type: 'row',
        keys: ['location'],
        item: {
          texts: {
            location: {
              fontSize: 'md',
              color: 'primary',
              maxWidth: 200,
              font: 'regular',
              icon: 'pin',
              iconIndent: 'sm',
            },
          },
          justify: 'center',
          containerWidth: 200,
        },
      },
    ],
  },
];

const summaryFields: Field<ItemStyle>[] = [
  {
    name: 'summary',
    source: 'root',
    gap: 'md',
    separator: 'secondary',
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
];

const educationFields: Field<ItemStyle>[] = [
  {
    name: 'education',
    source: 'objects',
    items: [
      {
        type: 'row',
        keys: ['degree', 'school', 'dateRangeShort'],
        item: {
          texts: {
            degree: {
              fontSize: 'md',
              color: 'secondary',
              maxWidth: 200,
              font: 'semibold',
            },
            school: {
              fontSize: 'md',
              color: 'primary',
              maxWidth: 200,
              font: 'regular',
            },
            dateRangeShort: {
              fontSize: 'md',
              color: 'primary',
              maxWidth: 200,
              font: 'regular',
            },
          },
          justify: 'start',
          separator: ' | ',
          containerWidth: 400,
        },
      },
      // {
      //   type: 'text',
      //   name: 'school',
      //   item: {
      //     fontSize: 'md',
      //     color: 'neutral',
      //     maxWidth: 200,
      //     font: 'italic',
      //   },
      // },
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
          color: 'secondary',
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
          color: 'secondary',
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

export const mint: Template = {
  groups: [
    {
      width: 'full',
      gap: 'sm',
      fields: headerFields,
    },
    {
      width: 'full',
      fields: contactFields,
    },
    {
      width: 'full',
      fields: summaryFields,
    },
    {
      width: 'full',
      separator: 'secondary',
      gap: 'md',
      fields: [
        {
          name: 'skills',
          source: 'strings',
          label: {
            text: 'Skills: ',
            fontSize: 'md',
            color: 'primary',
            font: 'semibold',
            direction: 'horizontal',
            maxWidth: 100,
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
            text: 'Tools: ',
            fontSize: 'md',
            color: 'primary',
            font: 'semibold',
            maxWidth: 100,
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
            text: 'Languages: ',
            fontSize: 'md',
            color: 'primary',
            font: 'semibold',
            direction: 'horizontal',
            maxWidth: 100,
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
      separator: 'secondary',
      gap: 'md',
      label: {
        text: 'Experience',
        fontSize: 'lg',
        color: 'primary',
        font: 'semibold',
        margins: { bottom: 'md' },
      },
      fields: experienceFields,
    },
    {
      width: 'full',
      separator: 'secondary',
      label: {
        text: 'Education',
        fontSize: 'lg',
        color: 'primary',
        font: 'semibold',
        margins: { bottom: 'md' },
      },
      gap: 'md',
      fields: educationFields,
    },
    {
      width: 'full',
      separator: 'secondary',
      label: {
        text: 'Personal Projects',
        fontSize: 'lg',
        color: 'primary',
        font: 'semibold',
        margins: { bottom: 'md' },
      },
      gap: 'sm',
      fields: projectsFields,
    },
    {
      width: 'full',
      separator: 'secondary',
      label: {
        text: 'Recommendations',
        fontSize: 'lg',
        color: 'primary',
        font: 'semibold',
        margins: { bottom: 'md' },
      },
      gap: 'sm',
      fields: recommendationsFields,
    },
  ],
};
