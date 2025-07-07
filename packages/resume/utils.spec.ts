import {
  getFontSize,
  getLineHeight,
  getSeparatorSize,
  getSpacing,
  getWidth,
  justifyLine,
  alignLine,
  formatTextWithAffixes,
  parseMarksForFonts,
  mapDataToTemplate,
  hasContent,
} from './utils';
import * as constants from './constants';
import type { Template, Width, Group, Item, Align } from './types';
import type { ResumeData } from './types';

describe('utils', () => {
  describe('getFontSize', () => {
    it('returns correct font size for given size and scale', () => {
      expect(getFontSize('md', 'md')).toBe(
        constants.fontSizeMap['md'] * constants.fontScaleMap['md'],
      );
      expect(getFontSize('lg', 'sm')).toBe(
        constants.fontSizeMap['lg'] * constants.fontScaleMap['sm'],
      );
    });
  });

  describe('getLineHeight', () => {
    it('returns correct line height for given font size and leading', () => {
      expect(getLineHeight(10, 'md')).toBe(10 * constants.leadingMap['md']);
      expect(getLineHeight(12, 'lg')).toBe(12 * constants.leadingMap['lg']);
    });
  });

  describe('getSeparatorSize', () => {
    it('returns correct separator size for given size', () => {
      expect(getSeparatorSize('sm')).toBe(constants.mapSeparator['sm']);
      expect(getSeparatorSize('xl')).toBe(constants.mapSeparator['xl']);
    });
  });

  describe('getSpacing', () => {
    it('returns correct spacing for given size and scale', () => {
      expect(getSpacing('md', 'md')).toBe(
        constants.SpacingMap['md'] * constants.fontScaleMap['md'],
      );
      expect(getSpacing('lg', 'sm')).toBe(
        constants.SpacingMap['lg'] * constants.fontScaleMap['sm'],
      );
    });
  });

  describe('getWidth', () => {
    it('returns correct width for each width type', () => {
      expect(getWidth('full', 100)).toBe(100);
      expect(getWidth('1/2', 100)).toBe(50);
      expect(getWidth('1/3', 90)).toBe(30);
      expect(getWidth('2/3', 90)).toBe(60);
      expect(getWidth('2/5', 100)).toBe(40);
      expect(getWidth('3/5', 100)).toBe(60);
      expect(getWidth('unknown' as Width, 77)).toBe(77);
    });
  });

  describe('justifyLine', () => {
    it('returns correct offset for right justify', () => {
      expect(justifyLine({ justify: 'right', textWidth: 20, containerWidth: 100 })).toBe(80);
    });
    it('returns correct offset for center justify', () => {
      expect(justifyLine({ justify: 'center', textWidth: 20, containerWidth: 100 })).toBe(60);
    });
    it('returns 0 for left or unknown justify', () => {
      expect(justifyLine({ justify: 'left', textWidth: 20, containerWidth: 100 })).toBe(0);
      expect(justifyLine({ justify: 'other' as any, textWidth: 20, containerWidth: 100 })).toBe(0);
    });
  });

  describe('alignLine', () => {
    it('returns correct offset for bottom align', () => {
      expect(alignLine({ align: 'bottom', textHeight: 10, containerHeight: 100 })).toBe(90);
    });
    it('returns correct offset for middle align', () => {
      expect(alignLine({ align: 'middle', textHeight: 10, containerHeight: 100 })).toBe(55);
    });
    it('returns 0 for top or unknown align', () => {
      expect(alignLine({ align: 'top', textHeight: 10, containerHeight: 100 })).toBe(0);
      expect(alignLine({ align: 'other' as Align, textHeight: 10, containerHeight: 100 })).toBe(0);
    });
  });

  describe('formatTextWithAffixes', () => {
    it('formats text with prepend and append', () => {
      expect(formatTextWithAffixes({ value: 'foo', prepend: '(', append: ')' })).toBe('(foo)');
    });
    it('formats text with only value', () => {
      expect(formatTextWithAffixes({ value: 'bar' })).toBe('bar');
    });
  });

  describe('parseMarksForFonts', () => {
    it('returns bold-italic if both marks present', () => {
      expect(parseMarksForFonts([{ type: 'bold' }, { type: 'italic' }])).toBe('bold-italic');
    });
    it('returns bold if only bold present', () => {
      expect(parseMarksForFonts([{ type: 'bold' }])).toBe('bold');
    });
    it('returns italic if only italic present', () => {
      expect(parseMarksForFonts([{ type: 'italic' }])).toBe('italic');
    });
    it('returns regular if neither present', () => {
      expect(parseMarksForFonts([{ type: 'underline' }])).toBe('regular');
      expect(parseMarksForFonts([])).toBe('regular');
    });
  });

  describe('mapDataToTemplate', () => {
    it('maps data to template structure', () => {
      const data: ResumeData = { name: 'John', role: 'dev' };
      const template: Template = {
        groups: [
          {
            width: 'full',
            fields: [
              {
                name: 'name',
                source: 'root',
                items: [
                  {
                    name: 'name',
                    type: 'text',
                    item: { fontSize: 'md', font: 'regular', color: 'primary' },
                  },
                ],
              },
            ],
          },
        ],
      };
      const result = mapDataToTemplate(data, template);
      expect(result.groups).toBeDefined();
      expect(result.groups?.[0].fields?.[0].items?.[0]).toHaveProperty('item.text', 'John');
    });
  });

  describe('hasContent', () => {
    it('returns true if any field has items', () => {
      const group = {
        fields: [
          {
            name: 'foo',
            source: 'root',
            items: [{ name: 'bar', type: 'text', item: { text: 'baz' } }],
          },
        ],
      };
      expect(hasContent(group as Omit<Group<Item>, 'width'>)).toBe(true);
    });
    it('returns true if any subgroup has content', () => {
      const group = {
        groups: [
          {
            fields: [
              {
                name: 'foo',
                source: 'root',
                items: [{ name: 'bar', type: 'text', item: { text: 'baz' } }],
              },
            ],
          },
        ],
      };
      expect(hasContent(group as Omit<Group<Item>, 'width'>)).toBe(true);
    });
    it('returns false if no fields or groups have items', () => {
      const group = { fields: [{ name: 'foo', source: 'root', items: [] }] };
      expect(hasContent(group as Omit<Group<Item>, 'width'>)).toBe(false);
      expect(hasContent({} as Omit<Group<Item>, 'width'>)).toBe(false);
    });
  });
});
