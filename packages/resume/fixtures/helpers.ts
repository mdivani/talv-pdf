import type {
  Content,
  FormattedEducation,
  FormattedExperience,
  FormattedProject,
  FormattedRecommendation,
} from '../types';

/** A rich-text paragraph with a single text run. */
export const p = (text: string): Content => ({
  type: 'paragraph',
  content: [{ type: 'text', text }],
});

/** A rich-text document holding one paragraph. */
export const para = (text: string): Content => ({ type: 'doc', content: [p(text)] });

/** A rich-text document holding one bullet list. */
export const bullets = (items: string[]): Content => ({
  type: 'doc',
  content: [
    {
      type: 'bulletList',
      content: items.map((text) => ({ type: 'listItem', content: [p(text)] })),
    },
  ],
});

export const exp = (
  company: string,
  employmentType: string,
  jobTitle: string,
  dateRange: string,
  items: string[],
  locationType?: string,
): FormattedExperience => ({
  company,
  employmentType,
  companyWithEmploymentType: `${company} • ${employmentType}`,
  locationType,
  jobTitle,
  dateRange,
  description: bullets(items),
  kind: 'experience',
});

/** An experience entry with the technologies used in the role. */
export const withStack = (entry: FormattedExperience, stack: string[]): FormattedExperience => ({
  ...entry,
  stack,
});

export const edu = (
  school: string,
  degree: string,
  dateRange: string,
  text?: string,
): FormattedEducation => ({
  school,
  degree,
  dateRange,
  // Narrow sidebars use the short form: years only.
  dateRangeShort: dateRange.replace(/[A-Za-z]+\.? /g, ''),
  description: text ? para(text) : undefined,
  kind: 'education',
});

export const project = (
  projectName: string,
  url: string | undefined,
  text: string,
): FormattedProject => ({
  projectName,
  url,
  description: para(text),
  kind: 'project',
});

export const rec = (
  recommendeeName: string,
  url: string,
  text: string,
): FormattedRecommendation => ({
  recommendeeName,
  url,
  description: para(text),
  kind: 'recommendation',
});
