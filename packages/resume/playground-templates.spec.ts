import * as playgroundTemplates from '../../playground/templates';
import { fixtures } from './fixtures';
import { record } from './test-utils';
import type { Group, ItemStyle, ResumeData, Template } from './types';

/**
 * The templates built in the playground (not released with the package). `layout.spec.ts` checks
 * them for overlaps, text off the page and split headings; these tests check their sections.
 */

const templates = Object.entries(playgroundTemplates).filter(
  ([name]) => name !== 'engineDemo',
) as Array<[string, Template]>;

/** Heading text of every group with a section name, by section, in config order. */
function headings(template: Template) {
  const found: Array<{ section: string; text: string; when?: string; unless?: string }> = [];
  const walk = (groups: Group<ItemStyle>[]) =>
    groups.forEach((group) => {
      if (group.section && group.label?.text) {
        found.push({
          section: group.section,
          text: group.label.text,
          when: group.when,
          unless: group.unless,
        });
      }
      walk(group.groups ?? []);
    });
  walk(template.groups);
  return found;
}

/** Position in drawing order (which is reading order) of the first line starting with `text`. */
const drawnAt = (texts: Array<{ text: string }>, text: string) =>
  texts.findIndex(
    (t) => t.text.trim().startsWith(text.split(' ')[0]) && text.startsWith(t.text.trim()),
  );

describe.each(templates)('%s', (_, template) => {
  const sections = headings(template);

  it('names every section in its default order', () => {
    expect(new Set(sections.map((s) => s.section))).toEqual(new Set(template.defaultSectionOrder));
  });

  it('draws the section headings in the default order', async () => {
    const { texts } = await record(template, fixtures.senior);
    const order = template.defaultSectionOrder ?? [];
    const drawn = sections
      .map((s) => ({ ...s, at: drawnAt(texts, s.text) }))
      .filter((s) => s.at >= 0)
      .sort((a, b) => a.at - b.at)
      .map((s) => order.indexOf(s.section));
    expect(drawn.length).toBeGreaterThan(3);
    expect(drawn).toEqual([...drawn].sort((a, b) => a - b));
  });

  it('draws the sections in the order it is given', async () => {
    const order = [...(template.defaultSectionOrder ?? [])].reverse();
    const { texts } = await record(template, fixtures.senior, { sectionOrder: order });
    // Sections only move among their siblings, so compare the top-level ones: the children of the
    // page group every playground template wraps its content in.
    const topLevel = (template.groups[0].groups ?? [])
      .filter((group) => group.section && group.label?.text)
      .map((group) => ({
        section: group.section as string,
        at: texts.findIndex((t) => t.text.trim() === group.label?.text),
      }))
      .filter((s) => s.at >= 0)
      .sort((a, b) => a.at - b.at)
      .map((s) => order.indexOf(s.section));
    expect(topLevel.length).toBeGreaterThan(2);
    expect(topLevel).toEqual([...topLevel].sort((a, b) => a - b));
  });

  it('shows only the sections that have data', async () => {
    const data: ResumeData = {
      name: 'Maya Lindqvist',
      role: 'Software Engineer',
      experience: fixtures.senior.experience?.slice(0, 1),
    };
    const { texts } = await record(template, data);
    const shown = sections.filter((s) => texts.some((t) => t.text.trim() === s.text));
    expect(shown.map((s) => s.section)).toEqual(['experience']);
  });
});
