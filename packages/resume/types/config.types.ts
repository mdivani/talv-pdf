import { svg } from '../constants';

// Config Types
export type Size = 'xl' | 'lg' | 'md' | 'sm';
export type FontSize = number;
export type Width = 'full' | '1/2' | '1/3' | '2/3' | '2/5' | '3/5';
export type SizeMap = Record<Size, number>;
export type Colors = 'primary' | 'secondary' | 'neutral';
export type FontType = 'regular' | 'semibold' | 'bold' | 'italic' | 'bold-italic';
export type Justify = 'left' | 'right' | 'center';
export type Align = 'top' | 'bottom' | 'middle';
export type RowJustify = 'between' | 'center' | 'start';
export type IconTypes = keyof typeof svg;

export interface Margins {
  bottom?: Size;
  top?: Size;
}

export interface Separator {
  color?: Colors;
  size?: Size;
  maxWidth?: number;
  margins?: Margins;
}

export interface PageConfig {
  width: number;
  height: number;
  gapX: Size;
  gapY: Size;
}

export interface ResumeConfig {
  page: PageConfig;
  color: Colors;
  fontSize: Size;
  leading: Size;
}

export type FontMap = Record<FontType, string>;

export type CustomFont = {
  name: string;
  fonts: FontMap;
  /**
   * Embed only the characters a resume uses instead of the whole font files, for example 400 KB
   * down to 40 KB for Roboto. Off by default: the subsetter in `@pdf-lib/fontkit` drops glyphs from
   * some fonts, including the Google Fonts build of Inter, so check the output before turning it on.
   */
  subset?: boolean;
};

export type Watermark = {
  text?: string;
  url?: string;
  color?: string;
};
