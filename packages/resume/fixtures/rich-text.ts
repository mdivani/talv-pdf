import type { Content, ResumeData } from '../types';
import { edu, exp } from './helpers';

const text = (value: string, marks?: string[]): Content => ({
  type: 'text',
  text: value,
  ...(marks ? { marks: marks.map((type) => ({ type })) } : {}),
});

/**
 * Rich-text descriptions with bold and italic runs, several paragraphs, empty paragraphs and lists.
 * Known issue: later text runs in a paragraph are dropped unless they wrap, so mixed-mark lines render short.
 */
export const richText: ResumeData = {
  name: 'Maya Lindqvist',
  role: 'Software Engineer',
  description:
    'Summary is plain text; rich text appears in the experience and education descriptions below.',
  experience: [
    {
      ...exp('Northwind Health', 'Full-time', 'Software Engineer', 'Mar 2023 - Present', []),
      description: {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [text('Single run, regular.')] },
          { type: 'paragraph', content: [text('Single run, bold.', ['bold'])] },
          { type: 'paragraph', content: [text('Single run, italic.', ['italic'])] },
          { type: 'paragraph', content: [text('Single run, bold italic.', ['bold', 'italic'])] },
          {
            type: 'paragraph',
            content: [
              text('Mixed runs: '),
              text('this part is bold', ['bold']),
              text(' and this part is regular again.'),
            ],
          },
          { type: 'paragraph', content: [] },
          { type: 'paragraph', content: [text('Paragraph after an empty paragraph.')] },
          {
            type: 'bulletList',
            content: [
              {
                type: 'listItem',
                content: [{ type: 'paragraph', content: [text('Bullet with plain text.')] }],
              },
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [
                      text('Bullet with '),
                      text('bold', ['bold']),
                      text(' in the middle.'),
                    ],
                  },
                ],
              },
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [
                      text(
                        'A long bullet that has to wrap onto a second and possibly third line so the hanging indent under the bullet can be checked.',
                      ),
                    ],
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
      ...edu('University of Edinburgh', 'BSc Computer Science', 'Sep 2017 - Jun 2021'),
      description: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [text('Graduated with ', ['italic']), text('First Class Honours', ['bold'])],
          },
        ],
      },
    },
  ],
};
