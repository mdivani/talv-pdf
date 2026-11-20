import type {
  Field,
  ItemStyle,
  LabelItem,
  LineParamStyles,
  Template,
  TextItem,
} from '../../packages/resume/types';

/**
 * Not a resume design: every engine option added for the new templates in one template, so a change
 * to the engine can be checked by eye. A filled header band with chips, a label bar, boxes side by
 * side, label columns, a skills table, a timeline with stacks, and a full-height side column.
 */

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

const heading = (value: string, overrides: Partial<LabelItem> = {}): LabelItem => ({
  ...style({ font: 'semibold', fontSize: 'lg' }),
  text: value,
  margins: { bottom: 'md' },
  ...overrides,
});

const experience: Field<ItemStyle> = {
  name: 'experience',
  source: 'objects',
  gap: 'sm',
  aside: { name: 'dateRange', width: 80, rule: { color: 'neutral', marker: 'secondary' } },
  items: [
    text('dateRange', { color: 'neutral', fontSize: 'sm', family: 'mono' }),
    text('jobTitle', { font: 'semibold' }),
    text('companyWithEmploymentType', { color: 'neutral' }),
    {
      type: 'list',
      name: 'stack',
      output: 'row',
      gap: 'sm',
      margins: { top: 'sm' },
      chip: {
        background: { border: { color: 'neutral' }, radius: 3 },
        padding: { x: 'md', y: 'sm' },
      },
      item: style({ fontSize: 'sm', family: 'mono' }),
    },
    { type: 'content', name: 'description', margins: { top: 'sm' } },
  ],
};

export const engineDemo: Template = {
  family: 'body',
  defaultSectionOrder: ['achievements', 'skills', 'experience', 'education', 'languages'],
  groups: [
    {
      width: 'full',
      gap: 'md',
      padding: 'lg',
      background: { color: 'secondary', bleed: true },
      fields: [
        {
          name: 'header',
          source: 'root',
          gap: 'sm',
          items: [
            text('name', { fontSize: 'xl', font: 'bold', color: 'onSecondary', family: 'serif' }),
            text('role', { color: 'onSecondary', family: 'mono' }),
          ],
        },
        {
          name: 'skills',
          source: 'root',
          join: {
            type: 'join',
            output: 'row',
            width: 0,
            gap: 'sm',
            chip: { background: { border: { color: 'onSecondary' }, radius: 6 } },
            item: style({ fontSize: 'sm', color: 'onSecondary' }),
          },
          items: [],
        },
      ],
    },
    {
      width: 'full',
      direction: 'horizontal',
      gap: 'lg',
      groups: [
        {
          width: '2/3',
          gap: 'lg',
          groups: [
            {
              width: 'full',
              section: 'achievements',
              gap: 'md',
              label: heading('Selected achievements', {
                color: 'onSecondary',
                background: { color: 'secondary', radius: 2 },
                padding: { x: 'md', y: 'sm' },
              }),
              fields: [
                {
                  name: 'headlineAchievements',
                  source: 'objects',
                  columns: 3,
                  padding: 'md',
                  background: {
                    color: 'secondaryTint',
                    border: { color: 'secondary', width: 3, sides: ['left'] },
                  },
                  items: [
                    text('value', { fontSize: 'lg', font: 'bold', color: 'secondary' }),
                    text('label', { fontSize: 'sm' }),
                  ],
                },
              ],
            },
            {
              width: 'full',
              section: 'skills',
              when: 'skillGroups',
              gap: 'sm',
              label: heading('Skills', { column: 80 }),
              fields: [
                {
                  name: 'skillGroups',
                  source: 'objects',
                  aside: { name: 'name', width: 90 },
                  padding: { y: 'sm' },
                  background: { border: { color: 'neutral', sides: ['bottom'] } },
                  items: [
                    text('name', { font: 'semibold' }),
                    { type: 'list', name: 'skills', output: 'text', item: style() },
                  ],
                },
              ],
            },
            {
              width: 'full',
              section: 'skills',
              unless: 'skillGroups',
              label: heading('Skills', { column: 80 }),
              fields: [
                {
                  name: 'skills',
                  source: 'root',
                  join: { type: 'join', output: 'text', separator: ', ', width: 0, item: style() },
                  items: [],
                },
              ],
            },
            {
              width: 'full',
              section: 'experience',
              gap: 'md',
              label: heading('Experience', { column: 80 }),
              fields: [experience],
            },
          ],
        },
        {
          width: '1/3',
          gap: 'md',
          padding: 'md',
          background: { color: 'secondaryTint', fullHeight: true, bleed: true },
          groups: [
            {
              width: 'full',
              section: 'education',
              gap: 'sm',
              label: heading('Education', { color: 'secondary' }),
              fields: [
                {
                  name: 'education',
                  source: 'objects',
                  gap: 'sm',
                  items: [
                    text('degree', { font: 'semibold' }),
                    text('school'),
                    text('dateRange', { color: 'neutral', fontSize: 'sm' }),
                  ],
                },
              ],
            },
            {
              width: 'full',
              section: 'languages',
              gap: 'sm',
              label: heading('Languages', { color: 'secondary' }),
              fields: [
                {
                  name: 'languages',
                  source: 'strings',
                  gap: 'sm',
                  items: [text('language', { bullet: true })],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};
