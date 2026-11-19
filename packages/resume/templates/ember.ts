import { Field, ItemStyle, Template } from '../types';

const headerFields: Field<ItemStyle>[] = [
  {
    name: 'header',
    source: 'root',
    gap: 'sm',
    items: [
      {
        type: 'text',
        name: 'name',
        item: {
          fontSize: 'xl',
          color: 'secondary',
          maxWidth: 200,
          font: 'bold',
          leading: 'sm',
        },
      },
      {
        type: 'text',
        name: 'role',
        item: {
          fontSize: 'lg',
          color: 'primary',
          maxWidth: 200,
          font: 'regular',
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
        type: 'text',
        name: 'primaryProfile',
        item: {
          fontSize: 'md',
          color: 'primary',
          maxWidth: 260,
          font: 'regular',
          icon: 'link',
          iconIndent: 'sm',
          justify: 'right',
          underline: true,
        },
      },
      {
        type: 'text',
        name: 'email',
        item: {
          fontSize: 'md',
          color: 'primary',
          maxWidth: 260,
          font: 'regular',
          icon: 'email',
          justify: 'right',
          iconIndent: 'sm',
        },
      },
      {
        type: 'text',
        name: 'phone',
        item: {
          fontSize: 'md',
          color: 'primary',
          maxWidth: 260,
          font: 'regular',
          icon: 'phone',
          iconIndent: 'sm',
          justify: 'right',
        },
      },
      {
        type: 'text',
        name: 'location',
        item: {
          fontSize: 'md',
          color: 'primary',
          maxWidth: 260,
          font: 'regular',
          icon: 'pin',
          iconIndent: 'sm',
          justify: 'right',
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
    separator: 'primary',
    label: {
      text: 'Summary',
      fontSize: 'lg',
      color: 'primary',
      font: 'semibold',
      direction: 'horizontal',
      maxWidth: 120,
    },
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
        keys: ['degree', 'dateRangeShort'],
        item: {
          texts: {
            degree: {
              fontSize: 'md',
              color: 'secondary',
              maxWidth: 200,
              font: 'semibold',
              icon: 'cap',
              iconIndent: 'md',
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
      {
        type: 'text',
        name: 'school',
        item: {
          fontSize: 'md',
          color: 'neutral',
          maxWidth: 200,
          font: 'italic',
        },
      },
      {
        name: 'details',
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

export const ember: Template = {
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
      fields: experienceFields,
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
