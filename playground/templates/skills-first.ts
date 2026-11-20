import type { LabelItem, Template } from '../../packages/resume/types';
import { description, entries, joined, page, root, row, section, text } from './shared';

/**
 * Skills first: grouped skills in boxes above the work history, for career changers. Without skill
 * groups, one line of skills takes the boxes' place. Board 5 on the design canvas.
 */

const heading = (value: string): LabelItem => ({
  text: value.toUpperCase(),
  fontSize: 'md',
  font: 'bold',
  color: 'primary',
  padding: { y: 'sm' },
  background: { border: { color: 'neutral', width: 0.5, sides: ['bottom'] } },
  margins: { top: 'md', bottom: 'md' },
});

const muted = { color: 'neutral' as const };

export const skillsFirst: Template = {
  defaultSectionOrder: [
    'summary',
    'skills',
    'experience',
    'education',
    'languages',
    'projects',
    'recommendations',
  ],
  groups: [
    page([
      {
        width: 'full',
        fields: [
          root([
            text('name', { fontSize: 'xl', font: 'bold' }),
            text('role', { font: 'semibold', color: 'secondary' }, { top: 'sm' }),
            row(
              ['email', 'phone', 'location', 'primaryProfile'],
              { email: muted, phone: muted, location: muted, primaryProfile: muted },
              { separator: ' · ', margins: { top: 'sm' } },
            ),
          ]),
        ],
      },
      section('summary', heading('Summary'), [root([text('description')])]),
      section(
        'skills',
        heading('Key skills'),
        [
          entries(
            'skillGroups',
            [
              text('name', { font: 'semibold', color: 'secondary' }),
              {
                type: 'list',
                name: 'skills',
                output: 'text',
                item: { fontSize: 'sm', font: 'regular', color: 'primary' },
              },
            ],
            { columns: 3, padding: 'md', background: { color: 'secondaryTint', radius: 4 } },
          ),
        ],
        { when: 'skillGroups' },
      ),
      section('skills', heading('Key skills'), [joined('skills')], { unless: 'skillGroups' }),
      section('experience', heading('Experience'), [
        entries('experience', [
          row(
            ['jobTitle', 'company', 'dateRange'],
            { jobTitle: { font: 'semibold' }, dateRange: muted },
            { justify: 'split', separator: ' · ' },
          ),
          description(),
        ]),
      ]),
      section('education', heading('Education'), [
        entries('education', [
          row(
            ['degree', 'school', 'dateRangeShort'],
            { degree: { font: 'semibold' }, dateRangeShort: muted },
            { justify: 'split', separator: ' · ' },
          ),
          description(),
        ]),
      ]),
      section('languages', heading('Languages'), [joined('languages')]),
      section('projects', heading('Projects'), [
        entries('projects', [
          row(
            ['projectName', 'url'],
            { projectName: { font: 'semibold' }, url: muted },
            { justify: 'split' },
          ),
          description(),
        ]),
      ]),
      section('recommendations', heading('Recommendations'), [
        entries('recommendations', [
          row(
            ['recommendeeName', 'url'],
            { recommendeeName: { font: 'semibold' }, url: muted },
            { justify: 'split' },
          ),
          description(),
        ]),
      ]),
    ]),
  ],
};
