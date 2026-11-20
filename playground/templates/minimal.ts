import type { Group, ItemStyle, LabelItem, Template } from '../../packages/resume/types';
import {
  description,
  entries,
  joined,
  page,
  root,
  row,
  section as baseSection,
  text,
} from './shared';

/**
 * Minimal: wide margins, a large light name, and every section with its label in a narrow column
 * on the left and a hairline above it. Board 3 on the design canvas.
 */

const LABEL_COLUMN = 108;

const heading = (value: string): LabelItem => ({
  text: value.toUpperCase(),
  fontSize: 'sm',
  font: 'semibold',
  color: 'secondary',
  column: LABEL_COLUMN,
});

const section = (
  name: string,
  label: string,
  fields: Parameters<typeof baseSection>[2],
): Group<ItemStyle> => baseSection(name, heading(label), fields, { separator: 'secondary' });

const muted = { fontSize: 'sm' as const, color: 'neutral' as const };

export const minimal: Template = {
  defaultSectionOrder: [
    'summary',
    'experience',
    'education',
    'skills',
    'projects',
    'recommendations',
  ],
  groups: [
    page([
      {
        width: 'full',
        fields: [
          root([
            text('name', { fontSize: 'xl', font: 'semibold' }),
            text('role', { fontSize: 'lg', color: 'neutral' }, { top: 'sm' }),
            row(
              ['email', 'phone', 'location', 'primaryProfile'],
              { email: muted, phone: muted, location: muted, primaryProfile: muted },
              { separator: '   ·   ', margins: { top: 'md' } },
            ),
          ]),
        ],
      },
      section('summary', 'Profile', [root([text('description')])]),
      section('experience', 'Experience', [
        entries('experience', [
          row(['jobTitle', 'company'], { jobTitle: { font: 'semibold' } }, { separator: ' · ' }),
          row(
            ['dateRange', 'locationType'],
            { dateRange: muted, locationType: muted },
            { separator: ' · ' },
          ),
          description(),
        ]),
      ]),
      section('education', 'Education', [
        entries('education', [
          text('degree', { font: 'semibold' }),
          row(
            ['school', 'dateRangeShort'],
            { school: muted, dateRangeShort: muted },
            { separator: ' · ' },
          ),
          description(),
        ]),
      ]),
      section('skills', 'Skills', [joined('skills')]),
      section('skills', 'Tools', [joined('tools')]),
      section('skills', 'Languages', [joined('languages')]),
      section('projects', 'Projects', [
        entries('projects', [
          row(
            ['projectName', 'url'],
            { projectName: { font: 'semibold' }, url: muted },
            { separator: ' · ' },
          ),
          description(),
        ]),
      ]),
      section('recommendations', 'Recommendations', [
        entries('recommendations', [
          row(
            ['recommendeeName', 'url'],
            { recommendeeName: { font: 'semibold' }, url: muted },
            { separator: ' · ' },
          ),
          description(),
        ]),
      ]),
    ]),
  ],
};
