import { Size, Colors, Justify, IconTypes, RowJustify, Width, FontType, Margins } from './config.types';
import { Content } from './content.types';

export type SeparatorVariant = 'primary' | 'secondary' | 'tertiary';

export interface LineParamStyles {
  fontSize: Size;
  font: FontType;
  color: Colors;
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
}

export type TemplateItem = TextItem<LineParamStyles> | RowItem<RowBaseParam> | ContentItem;

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
}

export type Item = TextItem<LineParams> | RowItem<RowParams> | ContentItem;

export type ItemStyle = TextItem<LineParamStyles> | RowItem<RowParamStyles> | ContentItem;

export interface PDFData {
  groups: Group<Item>[];
}

export interface Template {
  groups: Group<ItemStyle>[];
}

export interface Group<T extends TemplateItem> {
  width: Width;
  direction?: 'horizontal';
  gap?: Size;
  label?: LabelItem;
  separator?: SeparatorVariant;
  groups?: Group<T>[];
  fields?: Field<T>[];
}

export interface Field<T extends TemplateItem> {
  name: string;
  gap?: Size;
  label?: LabelItem;
  separator?: SeparatorVariant;
  maxWidth?: number;
  source: 'root' | 'objects' | 'strings';
  join?: JoinField<LineParamStyles>;
  items: T[];
}

export type FormattedExperience = {
  companyWithEmploymentType: string;
  company: string;
  employmentType?: string;
  jobTitle: string;
  description?: Content;
  dateRange: string;
  kind: 'experience';
};

export type FormattedEducation = {
  school: string;
  degree: string;
  description?: Content;
  dateRange: string;
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
  tools?: Array<string>;
};
