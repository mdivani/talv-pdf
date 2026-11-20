import {
  Size,
  Color,
  Justify,
  IconTypes,
  RowJustify,
  Width,
  FontType,
  FontFamily,
  Margins,
  Background,
  Padding,
} from './config.types';
import { Content } from './content.types';

export type SeparatorVariant = 'primary' | 'secondary' | 'tertiary';

export interface LineParamStyles {
  fontSize: Size;
  font: FontType;
  /** Typeface role. Defaults to the template's `family`, or `body`. */
  family?: FontFamily;
  color: Color;
  /** Colour of the line's icon. Defaults to `secondary`. */
  iconColor?: Color;
  maxWidth?: number;
  wordBreaks?: string[];
  justify?: Justify;
  iconIndent?: Size;
  icon?: IconTypes | null;
  leading?: Size;
  bullet?: boolean;
  underline?: boolean;
  offset?: number;
}

export interface LineParams extends LineParamStyles {
  text: string;
}

export interface RowBaseParam {
  justify: RowJustify;
  containerWidth: number;
  separator?: string;
  gap?: Size;
  dynamicGap?: number;
  /** Draw each value as a chip: a small box around the value. */
  chip?: Chip;
}

/** A small box around each value of a row, such as a skill or a technology. */
export interface Chip {
  background: Background;
  /** Space inside the box. Defaults to `{ x: 'md', y: 'sm' }`. */
  padding?: Padding;
}

export interface RowParamStyles extends RowBaseParam {
  texts: Record<string, LineParamStyles>;
}

export interface RowParams extends RowBaseParam {
  texts: LineParams[];
}

export interface LabelItem extends LineParams {
  margins?: Margins;
  direction?: 'horizontal';
  /**
   * Put the label in a column of this width (points) on the left, with the content beside it. The
   * label wraps inside the column, and the section ends below whichever is longer.
   */
  column?: number;
  /** A bar behind the label, as wide as its group. */
  background?: Background;
  /** Space inside the background. */
  padding?: Padding;
}

export type TemplateItem =
  | TextItem<LineParamStyles>
  | RowItem<RowBaseParam>
  | ContentItem
  | ListItem;

export interface TextItem<T extends LineParamStyles> {
  name: string;
  type: 'text';
  margins?: Margins;
  item: T;
}

export interface JoinField<T extends LineParamStyles> {
  keys?: string[];
  separator?: string;
  type: 'join';
  output: 'text' | 'row';
  width: number;
  justify?: RowJustify;
  margins?: Margins;
  gap?: Size;
  chip?: Chip;
  item: T;
}

export interface RowItem<T extends RowBaseParam> {
  type: 'row';
  keys: string[];
  margins?: Margins;
  item: T;
}

export interface ContentItem {
  name: string;
  type: 'content';
  margins?: Margins;
  content?: Content;
  /** Style of the rich text. Defaults to the text colour at size `md`. */
  item?: Partial<Pick<LineParamStyles, 'color' | 'fontSize' | 'family' | 'leading'>>;
}

/**
 * A list of strings inside an entry, such as the stack of a job: `stack: ['TypeScript', 'Go']`.
 * Drawn as one joined text, or as a row of values (which can be chips).
 */
export interface ListItem {
  name: string;
  type: 'list';
  margins?: Margins;
  output: 'text' | 'row';
  /** Between values. For `text` output, defaults to `', '`. */
  separator?: string;
  justify?: RowJustify;
  gap?: Size;
  chip?: Chip;
  item: LineParamStyles;
}

export type Item = TextItem<LineParams> | RowItem<RowParams> | ContentItem;

export type ItemStyle =
  | TextItem<LineParamStyles>
  | RowItem<RowParamStyles>
  | ContentItem
  | ListItem;

export interface PDFData {
  groups: Group<Item>[];
}

export interface Template {
  groups: Group<ItemStyle>[];
  /** Typeface role for text that doesn't name one. Defaults to `body`. */
  family?: FontFamily;
  /**
   * Order of the template's sections (groups with a `section` name) when `generate()` gets no
   * `sectionOrder`. Defaults to their order in `groups`.
   */
  defaultSectionOrder?: string[];
}

/** Draw a group or field only when a top-level data key is filled (`when`) or empty (`unless`). */
export interface Condition {
  /** Only draw this when `data[when]` has a value (a non-empty string or array). */
  when?: string;
  /** Only draw this when `data[unless]` is missing or empty, as a fallback for another section. */
  unless?: string;
}

export interface Group<T extends TemplateItem> extends Condition {
  width: Width;
  direction?: 'horizontal';
  gap?: Size;
  label?: LabelItem;
  separator?: SeparatorVariant;
  /**
   * Name of the section this group holds, such as `'experience'`. Named groups can be reordered
   * with `sectionOrder`, within the group that contains them. Unnamed groups stay in place.
   */
  section?: string;
  /** A box behind the group. Not drawn when the group has no content. */
  background?: Background;
  /** Space between the group's edge (or background) and its content. */
  padding?: Padding;
  groups?: Group<T>[];
  fields?: Field<T>[];
}

/**
 * Puts one item of each entry in a column on the left, such as the dates of a job, with the other
 * items beside it.
 */
export interface Aside {
  /** Name of the item to put in the left column. */
  name: string;
  /** Width of the left column, in points. */
  width: number;
  /** Space between the columns. Defaults to `md`. */
  gap?: Size;
  /** A vertical rule between the columns, with a marker at the start of each entry: a timeline. */
  rule?: { color?: Color; marker?: Color };
}

export interface Field<T extends TemplateItem> extends Condition {
  name: string;
  gap?: Size;
  label?: LabelItem;
  separator?: SeparatorVariant;
  maxWidth?: number;
  source: 'root' | 'objects' | 'strings';
  join?: JoinField<LineParamStyles>;
  /** Lay the entries of a list (`source: 'objects'`) out side by side, this many to a row. */
  columns?: number;
  /** Put one item of each entry in a column on the left. */
  aside?: Aside;
  /** A box behind each entry. */
  background?: Background;
  /** Space between each entry's box and its content. */
  padding?: Padding;
  items: T[];
}

export type FormattedExperience = {
  companyWithEmploymentType: string;
  company: string;
  employmentType?: string;
  /** Work arrangement shown next to the company by the built-in templates, for example `'Remote'`. */
  locationType?: string;
  jobTitle: string;
  description?: Content;
  dateRange: string;
  /** Technologies or tools used in the role, such as `['TypeScript', 'Postgres']`. */
  stack?: Array<string>;
  kind: 'experience';
};

export type FormattedEducation = {
  school: string;
  degree: string;
  description?: Content;
  dateRange: string;
  /** Compact date shown by the built-in templates, for example `'2017 - 2021'`. No date is shown when it is missing. */
  dateRangeShort?: string;
  kind: 'education';
};

export type FormattedUrl = {
  url: string;
  label?: string;
};

export type FormattedRecommendation = {
  recommendeeName: string;
  url: string;
  description: Content;
  kind: 'recommendation';
};

export type FormattedProject = {
  projectName: string;
  url?: string;
  description: Content;
  kind: 'project';
};

export type ResumeData = {
  name: string;
  role: string;
  description?: string;
  email?: string;
  phone?: string;
  location?: string;
  primaryProfile?: string;
  languages?: Array<string>;
  experience?: Array<FormattedExperience>;
  education?: Array<FormattedEducation>;
  recommendations?: Array<FormattedRecommendation>;
  projects?: Array<FormattedProject>;
  links?: Array<FormattedUrl>;
  skills?: Array<string>;
  /**
   * Skills in named groups, such as `{ name: 'Architecture', skills: ['Microservices'] }`. Templates
   * that show groups fall back to `skills` when this is empty.
   */
  skillGroups?: Array<FormattedSkillGroup>;
  /** Up to three results to lead with, such as `{ value: '1.2 million', label: 'patients' }`. */
  headlineAchievements?: Array<FormattedAchievement>;
  tools?: Array<string>;
};

export type FormattedSkillGroup = {
  name: string;
  skills: Array<string>;
};

export type FormattedAchievement = {
  value: string;
  label: string;
};
