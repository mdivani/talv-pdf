import { svg } from '../constants';

// Config Types
export type Size = 'xl' | 'lg' | 'md' | 'sm';
export type FontSize = number;
export type Width = 'full' | '1/2' | '1/3' | '2/3' | '2/5' | '3/5';
export type SizeMap = Record<Size, number>;
/** The three colours a resume is configured with: text, accent and muted. */
export type Colors = 'primary' | 'secondary' | 'neutral';
/**
 * Every colour a template can use: the three configured colours and three derived from them.
 * - `onSecondary`: text drawn on the accent. White, or the text colour when white on that accent
 *   would be below a 4.5:1 contrast ratio (a light accent such as yellow).
 * - `secondaryTint`: a light tint of the accent, for boxes behind text in the text colour.
 * - `white`
 */
export type Color = Colors | 'onSecondary' | 'secondaryTint' | 'white';
/**
 * A typeface role. Without font files, `body` is Helvetica, `serif` is Times and `mono` is Courier.
 * Pass font files for a role with the `fonts` option.
 */
export type FontFamily = 'body' | 'serif' | 'mono';
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
  color?: Color;
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

/** A box drawn behind a group, a list entry, a label or a chip. */
export interface Background {
  /** Fill colour. Leave it out for an outline only. */
  color?: Color;
  /** An outline, on every side or only on some (a bar on the left, a rule along the bottom). */
  border?: Border;
  /** Corner radius in points. Only used when the box is filled or outlined on every side. */
  radius?: number;
  /**
   * Extend the box to the edge of the page on every side where it touches the page margin. A
   * full-width header band then reaches the top, left and right edges.
   */
  bleed?: boolean;
  /**
   * Fill the full page height, on the group's first page and every page after it. For a side
   * column whose colour runs down every page. Groups only.
   */
  fullHeight?: boolean;
}

export interface Border {
  color: Color;
  /** Line width in points. Defaults to 0.5. */
  width?: number;
  /** Defaults to every side. */
  sides?: Array<'top' | 'right' | 'bottom' | 'left'>;
}

/** Space between a box's edge and its content. A size, or one size for each axis. */
export type Padding = Size | { x?: Size; y?: Size };
