import {
  PDFArray,
  PDFDocument,
  PDFOperator,
  PDFPage,
  StandardFonts,
  PDFFont,
  RGB,
  appendBezierCurve,
  breakTextIntoLines,
  closePath,
  fill,
  lineTo,
  moveTo,
  popGraphicsState,
  pushGraphicsState,
  rectangle,
  rgb,
  setFillingRgbColor,
  setLineWidth,
  setStrokingRgbColor,
  stroke,
} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { contrastRatio, fromHexStr, getIconPath, getLinkIconType, mixColors } from './utils';
import { fetchCustomFont, fetchImage } from './assets';
import {
  DrawCircleParams,
  DrawIconParams,
  DrawLineParams,
  FontType,
  Size,
  WriteLineParams,
  WriteLineResponse,
  WriteRowParams,
  WriteTextParams,
  Colors,
  Color,
  FontFamily,
  Background,
  Padding,
  TextLinesParams,
  TextWidthParams,
  Coords,
  JustifyTextParams,
  CustomFont,
  Watermark,
  IconTypes,
  Justify,
} from './types';
import { getFontSize, getLineHeight, getSeparatorSize, getSpacing, justifyLine } from './utils';
import { iconScaleMap } from './constants';

/** Hex colors (for example `'#00549F'`) for any of the template color slots. */
export type ColorOverrides = Partial<Record<Colors, string>>;

/** Font files for each typeface role. Roles without files use the PDF standard fonts. */
export type FontFiles = Partial<Record<FontFamily, CustomFont>>;

export type Config = {
  /** Shorthand for `fonts.body`. `fonts.body` wins when both are set. */
  customFont?: CustomFont;
  fonts?: FontFiles;
  watermark?: Watermark;
  screen: {
    width: number;
    height: number;
    paddingX: number;
    paddingY: number;
  };
  /** Shorthand for `colors.secondary`. `colors.secondary` wins when both are set. */
  color: string;
  colors?: ColorOverrides;
  fontSize: Size;
  leading: Size;
  isPreview: boolean;
};

/** Options that can be overridden for a single render. */
export type RenderOptions = Partial<
  Pick<Config, 'color' | 'colors' | 'fontSize' | 'leading' | 'customFont' | 'fonts'>
>;

export const DEFAULT_COLORS: Record<Colors, string> = {
  primary: '#1C1C1C',
  secondary: '#00549F',
  neutral: '#7A7A7A',
};

export const DEFAULT_CONFIG: Config = {
  screen: {
    width: 595,
    height: 842,
    paddingX: 20,
    paddingY: 20,
  },
  fontSize: 'lg',
  leading: 'md',
  isPreview: true,
  color: DEFAULT_COLORS.secondary,
};

type FontBytes = Array<{ type: FontType; arrayBuffer: ArrayBuffer }>;

/** The PDF standard fonts used when no custom font is set. Every PDF viewer has them, so nothing is downloaded. */
const STANDARD_FONTS: Record<FontFamily, Record<FontType, StandardFonts>> = {
  body: {
    regular: StandardFonts.Helvetica,
    semibold: StandardFonts.HelveticaBold,
    bold: StandardFonts.HelveticaBold,
    italic: StandardFonts.HelveticaOblique,
    'bold-italic': StandardFonts.HelveticaBoldOblique,
  },
  serif: {
    regular: StandardFonts.TimesRoman,
    semibold: StandardFonts.TimesRomanBold,
    bold: StandardFonts.TimesRomanBold,
    italic: StandardFonts.TimesRomanItalic,
    'bold-italic': StandardFonts.TimesRomanBoldItalic,
  },
  mono: {
    regular: StandardFonts.Courier,
    semibold: StandardFonts.CourierBold,
    bold: StandardFonts.CourierBold,
    italic: StandardFonts.CourierOblique,
    'bold-italic': StandardFonts.CourierBoldOblique,
  },
};

type FontSet = Partial<Record<FontType, PDFFont>>;

/** A box to draw behind the page content, recorded during layout and drawn by `save()`. */
export type BackgroundBox = {
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  background: Background;
};

/** Other downloaded font families kept besides the base config's fonts. */
const FONT_CACHE_SIZE = 3;

const fontCacheKey = (font: CustomFont) => JSON.stringify([font.name, font.fonts]);

/** Folds the `color` shorthand into `colors` so layers can be merged key by key. */
const normalizeColors = ({
  color,
  colors,
}: Pick<Partial<Config>, 'color' | 'colors'>): ColorOverrides => ({
  ...(color ? { secondary: color } : {}),
  ...colors,
});

/** Folds the `customFont` shorthand into `fonts`, like `normalizeColors`. */
const normalizeFonts = ({
  customFont,
  fonts,
}: Pick<Partial<Config>, 'customFont' | 'fonts'>): FontFiles => ({
  ...(customFont ? { body: customFont } : {}),
  ...fonts,
});

const WHITE = rgb(1, 1, 1);
const BLACK = rgb(0, 0, 0);

/** The colours a template can use, from the three configured ones. */
function deriveColors(base: Record<Colors, RGB>): Record<Color, RGB> {
  // Text on the accent: white, or else the text colour, if either reaches 4.5:1. Mid-tone accents
  // (a mid grey) reach it with neither, so then black or white, whichever contrasts more.
  const onSecondary =
    [WHITE, base.primary].find((text) => contrastRatio(text, base.secondary) >= 4.5) ??
    (contrastRatio(BLACK, base.secondary) > contrastRatio(WHITE, base.secondary) ? BLACK : WHITE);
  return {
    ...base,
    onSecondary,
    secondaryTint: mixColors(base.secondary, WHITE, 0.12),
    white: WHITE,
  };
}

/** Characters after which a long word may break, in order of preference. */
const SOFT_BREAKS = /[-/.@_?&=,]/;

/**
 * Splits a line that is too wide into pieces that fit, character by character. A piece ends after a
 * soft break character (`-`, `/`, `.`, `@`, ...) when one is in its second half, so URLs and email
 * addresses break at natural points.
 */
export function splitLongLine(
  line: string,
  maxWidth: number,
  widthOf: (text: string) => number,
): string[] {
  const pieces: string[] = [];
  let rest = line;
  while (rest) {
    let end = 1;
    while (end < rest.length && widthOf(rest.slice(0, end + 1)) <= maxWidth) end++;
    if (end < rest.length) {
      // Break after the last soft break character in the piece's second half, but not one that
      // would leave only a character or two for the next line ("project-" + "2") when an earlier
      // one exists.
      let fallback = 0;
      for (let i = end - 1; i > end / 2; i--) {
        if (!SOFT_BREAKS.test(rest[i])) continue;
        if (rest.length - (i + 1) >= 3) {
          fallback = 0;
          end = i + 1;
          break;
        }
        fallback ||= i + 1;
      }
      if (fallback) end = fallback;
    }
    pieces.push(rest.slice(0, end));
    rest = rest.slice(end);
  }
  return pieces;
}

export class BasePDFService {
  protected $width = 595;
  protected $height = 842;
  protected $maxWidth = 555;
  protected $maxHeight = 802;
  /** Fonts of the `body` family. */
  protected $fonts: FontSet = {};
  /** Fonts of every family embedded in the current document. */
  protected $families: Partial<Record<FontFamily, FontSet>> = {};
  /** Family used by text that doesn't name one: the template's `family`. */
  protected $family: FontFamily = 'body';
  /** Families the current render draws with the standard fonts. */
  protected $standardFamilies = new Set<FontFamily>(['body']);
  /** Boxes to draw behind the content of the current document. */
  protected $backgrounds: BackgroundBox[] = [];
  protected $fontScale: Size = 'md';
  protected $leading: Size = 'md';
  protected $colors: Record<Color, RGB> = deriveColors({
    primary: fromHexStr(DEFAULT_COLORS.primary),
    secondary: fromHexStr(DEFAULT_COLORS.secondary),
    neutral: fromHexStr(DEFAULT_COLORS.neutral),
  });
  protected $paddingX = 20;
  protected $paddingY = 20;
  protected $safeArea = 40;
  protected $watermark?: Watermark;

  protected $isPreview = true;

  protected $document: PDFDocument | null = null;
  protected $pages: PDFPage[] = [];
  protected $defaultFont?: PDFFont;
  /** Characters the standard fonts can encode. Text drawn with them is limited to this set. */
  private $standardCharset?: Set<number>;

  /** Settings from the constructor or `init()`. Per-render overrides are layered on top and never written back. */
  protected $baseConfig: Config;
  /** Font files embedded into every new document unless a render overrides them. */
  protected $baseFonts: FontFiles = {};
  /** Downloaded font files, so a fresh document per render doesn't re-download them. */
  private $fontCache = new Map<string, FontBytes>();

  constructor(config: Config = DEFAULT_CONFIG) {
    this.$baseConfig = config;
    this.applyConfig(config);
  }

  public get currentPage() {
    if (!this.$pages.length) throw new Error('No Pages created');

    return this.$pages[this.$pages.length - 1];
  }

  public get currentPageIndex() {
    return this.$pages.length - 1;
  }

  public get defaultFont() {
    if (!this.$defaultFont) throw new Error('Default font is not initialised');

    return this.$defaultFont;
  }

  getFont(type: FontType = 'regular', family: FontFamily = this.$family) {
    const font = this.$families[family]?.[type] || this.$fonts?.[type] || this.defaultFont;

    if (!font) throw new Error('Font is not initialised');

    return font;
  }

  fontSize(size: Size) {
    return getFontSize(size, this.$fontScale);
  }

  lineHeight(fontSize: number, leading: Size = this.$leading) {
    return getLineHeight(fontSize, leading);
  }

  color(color: Color) {
    return this.$colors[color];
  }

  spacing(size?: Size) {
    return size ? getSpacing(size, this.$fontScale) : 0;
  }

  /**
   * How far letters reach below the baseline, roughly. Text sits on its baseline, so a box around
   * text leaves this much room under the last line for descenders (g, p, y).
   */
  descent(size: Size) {
    return this.fontSize(size) * 0.22;
  }

  /** Padding in points on each axis. */
  padding(padding?: Padding) {
    if (!padding) return { x: 0, y: 0 };
    if (typeof padding === 'string') {
      const space = this.spacing(padding);
      return { x: space, y: space };
    }
    return { x: this.spacing(padding.x), y: this.spacing(padding.y) };
  }

  separator(size: Size = 'sm') {
    return getSeparatorSize(size);
  }

  isOverflowing(positionY: number) {
    return positionY < this.$safeArea;
  }

  getTextLines(options: TextLinesParams) {
    const { text, font, size, wordBreaks = [' '], maxWidth } = options;

    const fontSize = this.fontSize(size);
    const getTextWidth = (t: string) => font.widthOfTextAtSize(t, fontSize);

    // Half a point of slack: a value given exactly its own measured width (as rows do) must not wrap
    // because of floating-point rounding.
    const limit = maxWidth + 0.5;
    const lines = breakTextIntoLines(text, wordBreaks, limit, getTextWidth);

    // A single word wider than the line (a URL, an email address) is broken by characters.
    return lines.flatMap((line) =>
      getTextWidth(line.trimEnd()) > limit
        ? splitLongLine(line.trimEnd(), limit, getTextWidth)
        : [line],
    );
  }

  getTextWidth(options: TextWidthParams) {
    const { font, text = '', size } = options;

    const fontSize = this.fontSize(size);

    return font.widthOfTextAtSize(text, fontSize);
  }

  getTextDimensions(options: TextLinesParams) {
    const { size, leading, wordBreaks = [' '] } = options;
    const fontSize = this.fontSize(size);

    const lines = this.getTextLines({ ...options, wordBreaks });

    const longestLine = lines.reduce((longest, line) => {
      return line.length > longest.length ? line : longest;
    }, lines[0]);

    const textWidth = this.getTextWidth({ ...options, text: longestLine });

    return {
      height: lines.length * getLineHeight(fontSize, leading),
      width: textWidth,
      lineHeight: getLineHeight(fontSize, leading),
    };
  }

  getWriteLineDimensions({
    x,
    y,
    pageIndex,
    ...options
  }: TextLinesParams & Coords & { pageIndex: number }): WriteLineResponse {
    const { height, width } = this.getTextDimensions(options);

    return { height, width, nextY: y - height, nextX: x, pageIndex };
  }

  justifyText({
    justify,
    text,
    containerWidth,
    maxWidth,
    size,
    font,
    wordBreaks,
    leading,
  }: JustifyTextParams) {
    const lines = this.getTextLines({ text, maxWidth, size, font, wordBreaks, leading });

    const widths = lines.map((line) => this.getTextWidth({ text: line, size, font, leading }));

    return widths.map((width) => {
      const positionX = justifyLine({ justify, textWidth: width, containerWidth });

      return { positionX, text };
    });
  }

  /** Sets every layout and color field from a full config. Derived sizes are recomputed here so they never go stale. */
  protected applyConfig({
    screen,
    fontSize,
    leading,
    color,
    colors,
    isPreview = true,
    watermark,
  }: Config) {
    this.$fontScale = fontSize;
    this.$leading = leading;
    this.$width = screen.width;
    this.$height = screen.height;
    this.$paddingX = screen.paddingX;
    this.$paddingY = screen.paddingY;
    this.$maxWidth = screen.width - 2 * screen.paddingX;
    this.$maxHeight = screen.height - 2 * screen.paddingY;
    this.$isPreview = isPreview;
    this.$watermark = watermark;

    const hex = { ...DEFAULT_COLORS, ...normalizeColors({ color, colors }) };
    this.$colors = deriveColors({
      primary: fromHexStr(hex.primary),
      secondary: fromHexStr(hex.secondary),
      neutral: fromHexStr(hex.neutral),
    });
  }

  /** Layers per-render options over the base config without mutating it. Undefined options are ignored. */
  protected resolveConfig(options: RenderOptions = {}): Config {
    const base = this.$baseConfig;

    return {
      ...base,
      fontSize: options.fontSize ?? base.fontSize,
      leading: options.leading ?? base.leading,
      customFont: undefined,
      fonts: { ...normalizeFonts(base), ...normalizeFonts(options) },
      colors: { ...normalizeColors(base), ...normalizeColors(options) },
    };
  }

  /**
   * Replaces the current document with an empty one. Every render must start here: pdf-lib's
   * `removePage` only unlinks pages, and `save()` still writes their content streams, so reusing a
   * document would carry the previous resume's text into the next file.
   */
  protected async newDocument() {
    this.$document = await PDFDocument.create();
    this.$document.registerFontkit(fontkit);
    const doc = this.$document;
    const standard = await Promise.all(
      (Object.keys(STANDARD_FONTS.body) as FontType[]).map(
        async (type) => [type, await doc.embedFont(STANDARD_FONTS.body[type])] as const,
      ),
    );
    this.$fonts = Object.fromEntries(standard) as FontSet;
    this.$families = { body: this.$fonts };
    this.$standardFamilies = new Set(['body']);
    this.$defaultFont = this.$fonts.regular;
    this.$pages = [];
    this.$backgrounds = [];
    this.$fullHeight = [];
  }

  /** Embeds the standard fonts of a family (Times for `serif`, Courier for `mono`). */
  protected embedStandardFamily(family: FontFamily) {
    if (!this.$document) throw new Error('Initialise document first');
    const doc = this.$document;
    const fonts = STANDARD_FONTS[family];
    this.$families[family] = Object.fromEntries(
      (Object.keys(fonts) as FontType[]).map((type) => [type, doc.embedStandardFont(fonts[type])]),
    ) as FontSet;
    if (family === 'body') this.$fonts = this.$families[family] as FontSet;
  }

  /**
   * True when the current render draws any text with the standard fonts. Their character set is
   * limited, so text is then made encodable (see `encodable`).
   */
  protected get usesStandardFonts() {
    return this.$standardFamilies.size > 0;
  }

  /**
   * Makes text safe to draw with the current fonts. The standard fonts only cover WinAnsi (Western
   * European) characters and pdf-lib throws on anything else, so with them every other character is
   * replaced: whitespace with a space, the rest with `?`. Custom fonts get the text unchanged.
   */
  encodable(text: string) {
    if (!this.usesStandardFonts) return text;

    this.$standardCharset ??= new Set(this.defaultFont.getCharacterSet());
    const charset = this.$standardCharset;

    let out = '';
    for (const char of text.normalize('NFC')) {
      const code = char.codePointAt(0) as number;
      out += charset.has(code) ? char : /\s/.test(char) ? ' ' : '?';
    }
    return out;
  }

  async init(config: Config = DEFAULT_CONFIG) {
    this.$baseConfig = { ...DEFAULT_CONFIG, ...config };
    this.$baseFonts = normalizeFonts(this.$baseConfig);
    this.applyConfig(this.$baseConfig);

    await this.newDocument();
  }

  /**
   * Starts a new render in a fresh document. `options` apply to this render only; the next call
   * starts again from the values given to `init()`. `families` are the typeface roles the render
   * draws with; `body` is always embedded.
   */
  async update(options: RenderOptions = {}, families: FontFamily[] = ['body']) {
    if (!this.$document) throw new Error('Initialise document first');

    const config = this.resolveConfig(options);
    this.applyConfig(config);

    await this.newDocument();

    const fonts = config.fonts ?? {};
    this.$standardFamilies = new Set();
    for (const family of new Set<FontFamily>(['body', ...families])) {
      const files = fonts[family];
      if (files) await this.embedFonts(files, family);
      else if (family !== 'body') this.embedStandardFamily(family);
      if (!files && families.includes(family)) this.$standardFamilies.add(family);
    }

    await this.addPage();
  }

  /**
   * Downloads a font family once and keeps it for later documents. The base config's fonts are
   * always kept, and the most recently used few others.
   */
  protected async loadFonts(customFont: CustomFont): Promise<FontBytes> {
    const key = fontCacheKey(customFont);
    const cached = this.$fontCache.get(key);
    if (cached) {
      // Mark it as recently used.
      this.$fontCache.delete(key);
      this.$fontCache.set(key, cached);
      return cached;
    }

    const bytes = await fetchCustomFont(customFont.fonts);
    this.$fontCache.set(key, bytes);

    const baseKeys = new Set(Object.values(this.$baseFonts).map(fontCacheKey));
    const others = [...this.$fontCache.keys()].filter((existing) => !baseKeys.has(existing));
    for (const existing of others.slice(0, Math.max(others.length - FONT_CACHE_SIZE, 0))) {
      this.$fontCache.delete(existing);
    }

    return bytes;
  }

  async embedFonts(customFont: CustomFont, family: FontFamily = 'body') {
    if (!this.$document) throw new Error('Initialise document first');

    const doc = this.$document; // ts workaround to avoid type error

    const fontBytes = await this.loadFonts(customFont);
    const embedded = await Promise.all(
      fontBytes.map(
        async ({ type, arrayBuffer }) =>
          [type, await doc.embedFont(arrayBuffer, { subset: customFont.subset === true })] as const,
      ),
    );

    const fonts = Object.fromEntries(embedded) as FontSet;
    this.$families[family] = fonts;
    if (family === 'body') this.$fonts = fonts;

    return fonts;
  }

  /** Where content starts on every page: the same top margin as the first page. */
  protected get pageTop() {
    return this.$height - this.$paddingY;
  }

  /**
   * Moves from `pageIndex` to the page after it. Columns side by side share pages, so the page may
   * already exist (another column broke onto it first); otherwise it is added.
   */
  protected async nextPage(pageIndex: number) {
    if (this.currentPageIndex <= pageIndex) await this.addPage();
    return pageIndex + 1;
  }

  async addPage() {
    if (!this.$document) throw new Error('Initialise class first');

    const page = await this.$document.addPage([this.$width, this.$height]);

    if (this.$watermark) {
      if (this.$watermark.url) {
        const logoBytes = await fetchImage(this.$watermark.url);
        const logo = await this.$document.embedPng(logoBytes as unknown as Uint8Array);

        page.drawImage(logo, {
          x: 10,
          y: 5,
          width: 14,
          height: 16,
        });
      }

      if (this.$watermark.text) {
        const color = this.$watermark.color
          ? fromHexStr(this.$watermark.color)
          : this.$colors.primary;
        page.drawText(this.encodable(this.$watermark.text), {
          x: 28,
          y: 10,
          size: this.fontSize('sm'),
          color,
        });
      }
    }

    this.$pages.push(page);

    return this.$height - this.$paddingY - 20;
  }

  /**
   * Draws text wrapped at `maxWidth`. The wrapping is done here, with the same rules used to measure
   * text, and pdf-lib only gets the finished lines: its own wrapping has no slack for rounding and
   * can't break long words, so letting it re-wrap made drawn text differ from measured text.
   */
  addText({
    text = '',
    page,
    x,
    y,
    font,
    size,
    maxWidth,
    wordBreaks,
    leading,
    lineHeight,
    ...options
  }: WriteTextParams) {
    const lines = this.getTextLines({ text, font, size, maxWidth, wordBreaks, leading });

    page.drawText(lines.join('\n'), {
      x,
      y,
      font,
      lineHeight,
      size: this.fontSize(size),
      color: this.color(options.color),
    });
  }

  async writeLine({
    text,
    icon,
    color,
    iconColor = 'secondary',
    family,
    font: fontStyle,
    fontSize: size,
    leading,
    maxWidth = this.$maxWidth,
    wordBreaks = [' '],
    justify = 'left',
    underline = false,
    bullet = false,
    offset = 0,
    y = this.$paddingY,
    x = this.$paddingX,
    pageIndex,
  }: WriteLineParams): Promise<WriteLineResponse> {
    let currentPageIndex = pageIndex;
    let currentWidth = 0;
    let currentY = y;

    const font = this.getFont(fontStyle, family);

    if (!font) throw new Error('Default font is not initialised');

    const fontSize = this.fontSize(size);
    const lineHeight = this.lineHeight(fontSize, leading);
    const indent = icon || bullet ? this.spacing('lg') : 0;

    // The icon and bullet sit in front of the text, so the text only gets the width left after them.
    const prefix = this.prefixWidth({ text, icon, bullet, fontSize: size });
    const textMaxWidth = Math.max(maxWidth - prefix, 1);

    const { height: textHeight, width: textWidth } = this.getTextDimensions({
      text,
      font,
      maxWidth: textMaxWidth,
      size,
      wordBreaks,
      leading: leading || this.$leading,
    });

    currentWidth = textWidth;
    currentY = currentY - textHeight;
    const positionX =
      x + justifyLine({ justify, textWidth: currentWidth + prefix, containerWidth: maxWidth });

    if (this.isOverflowing(currentY - offset)) {
      currentPageIndex = await this.nextPage(currentPageIndex);
      currentY = this.pageTop - textHeight;
    }

    const page = this.$pages[currentPageIndex];

    let textX = bullet ? positionX + indent : positionX;
    const underlineWidth = underline ? currentWidth : 0;

    if (icon) {
      let selectedIcon = icon;
      if (selectedIcon === 'link') {
        selectedIcon = getLinkIconType(text);
      }
      const iconResult = this.drawIcon({
        x: positionX,
        // The top of the line where it was drawn, which is not `y` if the line moved to a new page.
        y: currentY + textHeight,
        color: iconColor,
        icon: selectedIcon,
        page,
        size,
      });

      textX = textX + iconResult.width;
      currentWidth += iconResult.width + 2;
    }

    this.addText({
      text,
      color,
      lineHeight,
      font,
      maxWidth: textMaxWidth,
      wordBreaks,
      size,
      y: currentY,
      x: textX,
      page,
      leading: leading || this.$leading,
    });

    if (underline) {
      this.drawStreightLine({
        y: currentY - 1,
        x: textX,
        width: underlineWidth,
        size,
        color,
        page,
      });
    }

    if (bullet) {
      this.drawCircle({
        y: currentY + lineHeight,
        x: positionX + indent / 2,
        color,
        size,
        page,
      });
    }

    return {
      height: textHeight,
      width: currentWidth,
      nextY: currentY,
      nextX: positionX + currentWidth,
      pageIndex: currentPageIndex,
    };
  }

  async writeMultiLine(options: WriteLineParams): Promise<WriteLineResponse> {
    const {
      text = '',
      fontSize: size,
      font: fontStyle,
      family,
      leading,
      maxWidth = this.$maxWidth,
      wordBreaks = [' '],
      y = this.$paddingY,
      x = this.$paddingX,
      pageIndex,
    } = options;

    let currentPageIndex = pageIndex;

    const font = this.getFont(fontStyle, family);

    if (!font) throw new Error('Default font is not initialised');

    // Wrap in the width left after the first line's icon or bullet, so that line fits too.
    const lines = this.getTextLines({
      text,
      maxWidth: Math.max(maxWidth - this.prefixWidth({ ...options, fontSize: size }), 1),
      size,
      font,
      wordBreaks,
      leading: leading || this.$leading,
    });

    let nextY = y;
    let height = 0;
    let width = 0;

    for (const [index, line] of lines.entries()) {
      const prefixes =
        index === 0
          ? { icon: options.icon, bullet: options.bullet }
          : { icon: null, bullet: false };

      const result = await this.writeLine({
        ...options,
        maxWidth,
        text: line,
        y: nextY,
        pageIndex: currentPageIndex,
        leading,
        // The look-ahead applies to the first line only: once it is placed, the rest follows it.
        offset: index === 0 ? options.offset : 0,
        ...prefixes,
      });

      nextY = result.nextY;
      height += result.height;
      width = result.width > width ? result.width : width;
      currentPageIndex = result.pageIndex;
    }

    return {
      width,
      height,
      nextX: x,
      nextY,
      pageIndex: currentPageIndex,
    };
  }

  async writeList(options: WriteLineParams[], separator = ', '): Promise<WriteLineResponse> {
    const params: WriteLineParams = options.reduce(
      (acc, option) => {
        acc.text += separator + option.text;
        return { ...option, ...acc };
      },
      { ...options[0], text: '' },
    );

    const result = await this.writeLine(params);

    return {
      height: result.height,
      width: result.width,
      nextX: result.nextX,
      nextY: result.nextY,
      pageIndex: result.pageIndex,
    };
  }

  /** Width of an icon as drawn by `drawIcon`. Icon sets with their own sizes override this. */
  iconWidth(_icon: IconTypes, size: Size) {
    return this.fontSize(size) * iconScaleMap[size];
  }

  /** Width of what `writeLine` draws before the text: a bullet's indent and an icon. */
  protected prefixWidth({
    text,
    icon,
    bullet,
    fontSize,
  }: Pick<WriteLineParams, 'text' | 'icon' | 'bullet' | 'fontSize'>) {
    // `writeLine` picks the icon for a link from its URL, so measure the same icon.
    const resolved = icon === 'link' ? getLinkIconType(text) : icon;
    return (bullet ? this.spacing('lg') : 0) + (resolved ? this.iconWidth(resolved, fontSize) : 0);
  }

  /** Width of `text` drawn on one line with its icon, as `writeLine` reports it. */
  protected lineWidth({
    text,
    font = 'regular',
    family,
    fontSize,
    icon,
    leading,
  }: WriteLineParams) {
    const textWidth = this.getTextWidth({
      text,
      font: this.getFont(font, family),
      size: fontSize,
      leading: leading || this.$leading,
    });
    return textWidth + (icon ? this.prefixWidth({ text, icon, fontSize }) + 2 : 0);
  }

  /**
   * Writes several values side by side. If they fit on one line they are placed by `justify`. If
   * not, the last value of a `between` row (usually a date) stays on the right and the others wrap
   * in the space left; otherwise values flow onto new lines. No value is ever wider than the space
   * it is given, so nothing runs past the column.
   */
  async writeRow(options: WriteRowParams): Promise<WriteLineResponse> {
    const {
      texts,
      justify,
      containerWidth,
      x,
      y,
      gap,
      chip,
      pageIndex = this.currentPageIndex,
    } = options;
    // Chips are boxes of their own: no separator between them.
    const separator = chip ? '' : (options.separator ?? '');
    const pad = chip ? this.padding(chip.padding ?? { x: 'md', y: 'sm' }) : { x: 0, y: 0 };

    // Each value keeps its text without the separator; the separator is only drawn between values
    // that share a line, never at the start of one.
    const values = texts
      .filter((txt) => txt.text)
      .map((txt) => ({ ...txt, font: txt.font || 'regular', justify: 'left' as const }));
    if (!values.length) return { height: 0, width: containerWidth, nextX: x, nextY: y, pageIndex };

    const space = this.spacing(gap);
    const right = x + containerWidth;
    const textOf = (i: number, startsLine: boolean) =>
      startsLine ? values[i].text : separator + values[i].text;
    const widthOf = (i: number, startsLine: boolean) =>
      this.lineWidth({ ...values[i], text: textOf(i, startsLine) }) + 2 * pad.x;
    const lineHeights = values.map((value) =>
      this.lineHeight(this.fontSize(value.fontSize), value.leading),
    );
    const descents = values.map((value) => (chip ? this.descent(value.fontSize) : 0));
    const rowLineHeight = Math.max(...lineHeights) + 2 * pad.y + Math.max(...descents);
    // Lines of chips are spaced like the chips themselves.
    const lineGap = chip ? space : 0;

    let top = y;
    let currentPageIndex = pageIndex;

    // The row's first line stays together: if it doesn't fit, the whole row moves to the next page.
    if (this.isOverflowing(top - rowLineHeight - (values[0].offset ?? 0))) {
      currentPageIndex = await this.nextPage(currentPageIndex);
      top = this.pageTop;
    }

    let bottom = top;

    /** Writes value `i` with its first line's top at `lineTop`, aligned to the row's baseline. */
    const write = async (
      i: number,
      startsLine: boolean,
      atX: number,
      lineTop: number,
      maxWidth: number,
      justify: Justify = 'left',
    ) => {
      const result = await this.writeMultiLine({
        ...values[i],
        text: textOf(i, startsLine),
        justify,
        x: atX + pad.x,
        y: lineTop - pad.y - (rowLineHeight - 2 * pad.y - Math.max(...descents) - lineHeights[i]),
        pageIndex: currentPageIndex,
        maxWidth: maxWidth - 2 * pad.x,
      });
      if (chip) {
        this.addBackground({
          pageIndex: result.pageIndex,
          x: atX,
          y: result.nextY - pad.y - descents[i],
          width: Math.min(widthOf(i, startsLine), maxWidth),
          height: result.height + 2 * pad.y + descents[i],
          background: chip.background,
        });
      }
      const resultBottom = result.nextY - pad.y - descents[i];
      if (result.pageIndex !== currentPageIndex) {
        currentPageIndex = result.pageIndex;
        bottom = resultBottom;
      } else {
        bottom = Math.min(bottom, resultBottom);
      }
    };

    /**
     * Writes values between `left` and `left + width`, as many per line as fit, with each line
     * aligned by `align`. A value wider than the whole width gets a line of its own and wraps.
     */
    const flow = async (indices: number[], left: number, width: number, align: Justify) => {
      const lines: number[][] = [];
      let used = 0;
      for (const i of indices) {
        const line = lines[lines.length - 1];
        const extra = space + widthOf(i, false);
        if (line && used + extra <= width) {
          line.push(i);
          used += extra;
        } else {
          lines.push([i]);
          used = widthOf(i, true);
        }
      }

      let lineTop = top;
      for (const [lineIndex, line] of lines.entries()) {
        if (lineIndex > 0) lineTop -= lineGap;
        // A line of chips moves to the next page as a whole, so its chips stay level.
        if (chip && lineIndex > 0 && this.isOverflowing(lineTop - rowLineHeight)) {
          currentPageIndex = await this.nextPage(currentPageIndex);
          lineTop = this.pageTop;
          bottom = lineTop;
        }
        const lineWidth = line.reduce(
          (sum, i, index) => sum + widthOf(i, index === 0) + (index ? space : 0),
          0,
        );
        if (lineWidth > width) {
          // A single value too wide for the line: wrap it across the full width.
          await write(line[0], true, left, lineTop, width, align);
        } else {
          let cursor =
            left + justifyLine({ justify: align, textWidth: lineWidth, containerWidth: width });
          for (const [index, i] of line.entries()) {
            await write(i, index === 0, cursor, lineTop, left + width - cursor);
            cursor += widthOf(i, index === 0) + space;
          }
        }
        lineTop = bottom;
      }
    };

    const all = values.map((_, i) => i);
    const last = values.length - 1;
    const total = all.reduce((sum, i) => sum + widthOf(i, i === 0) + (i ? space : 0), 0);

    if (justify === 'between' && last > 0 && total <= containerWidth) {
      // Everything fits on one line: first value on the left, last on the right, the rest spread between.
      const between = (containerWidth - (total - space * last)) / last;
      let cursor = x;
      for (const i of all) {
        const width = widthOf(i, i === 0);
        const atX = i === last ? right - width : cursor;
        await write(i, i === 0, atX, top, right - atX);
        cursor += width + between;
      }
    } else if (
      (justify === 'between' || justify === 'split') &&
      last > 0 &&
      widthOf(last, justify === 'split') <= containerWidth / 2
    ) {
      // Keep the last value (usually a date) on the right of the first line and wrap the rest in the
      // space left. In a `split` row the last value stands apart, so it gets no separator.
      const alone = justify === 'split';
      const lastWidth = widthOf(last, alone);
      await write(last, alone, right - lastWidth, top, lastWidth);
      await flow(all.slice(0, last), x, containerWidth - lastWidth - space, 'left');
    } else {
      const align = justify === 'center' ? 'center' : justify === 'end' ? 'right' : 'left';
      await flow(all, x, containerWidth, align);
    }

    return {
      height: top - bottom,
      width: containerWidth,
      nextX: x,
      nextY: bottom,
      pageIndex: currentPageIndex,
    };
  }

  drawStreightLine({
    x,
    y,
    width,
    size = 'sm',
    color: colorType = 'secondary',
    page,
  }: DrawLineParams) {
    const thickness = this.separator(size);
    const color = this.color(colorType);

    page.drawLine({
      thickness,
      color,
      start: { x, y },
      end: { y, x: x + width },
    });

    return y;
  }

  drawCircle({ x, y, size: fontSizeType, color: colorType, page }: DrawCircleParams) {
    const fontSize = this.fontSize(fontSizeType);
    const color = this.color(colorType);
    const circleSize = fontSize / 5;

    page.drawCircle({
      x,
      y: y - fontSize / 2 - circleSize,
      size: circleSize,
      color,
    });
  }

  drawIcon({ x, y, color: colorType, icon, page, size }: DrawIconParams) {
    const { path, translateY = 0, scale } = getIconPath(icon);
    const color = this.color(colorType);
    const fontSize = this.fontSize(size);

    const iconScale = (fontSize / 10) * iconScaleMap[size];
    page.drawSvgPath(path, {
      x,
      y: y - translateY,
      color,
      scale: iconScale * scale,
    });

    return { width: iconScale * 10, height: iconScale * 10 };
  }

  /**
   * Records a box to draw behind the content of a page. Boxes are drawn in the order recorded; pass
   * `at` (from `backgroundMark()`) to put a box before others, such as a group's box before the
   * boxes of the chips inside it, which are recorded first because the group's size is known last.
   */
  addBackground(box: BackgroundBox, at?: number) {
    if (box.width <= 0 || box.height <= 0) return;
    if (at === undefined) this.$backgrounds.push(box);
    else this.$backgrounds.splice(at, 0, box);
  }

  /** Where the next recorded box would go, to draw a container's box under what is inside it. */
  backgroundMark() {
    return this.$backgrounds.length;
  }

  /**
   * Records a box behind content that runs from `top` (on page `from`) to `bottom` (on page `to`),
   * one box per page. With `bleed`, each box reaches the page edges it touches the margins of.
   */
  addBackgroundSpan({
    from,
    to,
    top,
    bottom,
    x,
    width,
    background,
    at,
  }: {
    from: number;
    to: number;
    top: number;
    bottom: number;
    x: number;
    width: number;
    background: Background;
    /** From `backgroundMark()`: draw these boxes under the ones recorded since. */
    at?: number;
  }) {
    const [left, right] = this.bleedX(x, width, background.bleed);
    for (let pageIndex = from; pageIndex <= to; pageIndex++) {
      let boxTop = pageIndex === from ? top : this.pageTop;
      let boxBottom = pageIndex === to ? bottom : this.$safeArea;
      if (background.bleed && boxTop >= this.pageTop - 0.5) boxTop = this.$height;
      if (background.fullHeight) {
        boxTop = this.$height;
        boxBottom = 0;
      }
      this.addBackground(
        {
          pageIndex,
          x: left,
          y: boxBottom,
          width: right - left,
          height: boxTop - boxBottom,
          background,
        },
        at === undefined ? undefined : at + (pageIndex - from),
      );
    }
    // A full-height column's colour continues on every later page, even where it has no content.
    if (background.fullHeight)
      this.$fullHeight.push({ from: to + 1, x: left, width: right - left, background });
  }

  /** Left and right edges of a box, moved out to the page edge where it touches the margin. */
  protected bleedX(x: number, width: number, bleed?: boolean) {
    let left = x;
    let right = x + width;
    if (bleed) {
      if (left <= this.$paddingX + 0.5) left = 0;
      if (right >= this.$width - this.$paddingX - 0.5) right = this.$width;
    }
    return [left, right];
  }

  /** Full-height backgrounds to repeat on pages added after their content ended. */
  protected $fullHeight: Array<{
    from: number;
    x: number;
    width: number;
    background: Background;
  }> = [];

  /** Operators that draw a background box. */
  protected backgroundOperators({ x, y, width, height, background }: BackgroundBox) {
    const { color, border, radius = 0 } = background;
    const ops: PDFOperator[] = [pushGraphicsState()];
    const r = Math.min(radius, width / 2, height / 2);
    const path = (inset: number) => {
      const [l, b, w, h] = [x + inset, y + inset, width - 2 * inset, height - 2 * inset];
      if (r <= 0) return [rectangle(l, b, w, h)];
      // A rounded rectangle; k places the Bézier control points for a quarter circle.
      const k = 0.5523 * r;
      return [
        moveTo(l + r, b),
        lineTo(l + w - r, b),
        appendBezierCurve(l + w - r + k, b, l + w, b + r - k, l + w, b + r),
        lineTo(l + w, b + h - r),
        appendBezierCurve(l + w, b + h - r + k, l + w - r + k, b + h, l + w - r, b + h),
        lineTo(l + r, b + h),
        appendBezierCurve(l + r - k, b + h, l, b + h - r + k, l, b + h - r),
        lineTo(l, b + r),
        appendBezierCurve(l, b + r - k, l + r - k, b, l + r, b),
        closePath(),
      ];
    };

    if (color) {
      const { red, green, blue } = this.color(color);
      ops.push(setFillingRgbColor(red, green, blue), ...path(0), fill());
    }

    if (border) {
      const { red, green, blue } = this.color(border.color);
      const lineWidth = border.width ?? 0.5;
      // Lines sit inside the box, so a box's outline never pokes past its edges.
      const inset = lineWidth / 2;
      ops.push(setStrokingRgbColor(red, green, blue), setLineWidth(lineWidth));
      const sides = border.sides ?? ['top', 'right', 'bottom', 'left'];
      if (sides.length === 4) {
        ops.push(...path(inset), stroke());
      } else {
        const [l, b, rt, t] = [x + inset, y + inset, x + width - inset, y + height - inset];
        const lines = {
          top: [x, t, x + width, t],
          bottom: [x, b, x + width, b],
          left: [l, y, l, y + height],
          right: [rt, y, rt, y + height],
        };
        for (const side of sides) {
          const [x1, y1, x2, y2] = lines[side];
          ops.push(moveTo(x1, y1), lineTo(x2, y2), stroke());
        }
      }
    }

    ops.push(popGraphicsState());
    return ops;
  }

  /**
   * Draws the recorded backgrounds behind each page's content: in a content stream placed before
   * the page's other streams, so text and lines drawn earlier stay on top.
   */
  protected drawBackgrounds() {
    if (!this.$document) throw new Error('Initialise document first');
    const doc = this.$document;

    for (const { from, x, width, background } of this.$fullHeight) {
      for (let pageIndex = from; pageIndex < this.$pages.length; pageIndex++) {
        this.addBackground({ pageIndex, x, y: 0, width, height: this.$height, background });
      }
    }
    this.$fullHeight = [];

    const byPage = new Map<number, PDFOperator[]>();
    // Page-height column fills go underneath every other box.
    const boxes = [...this.$backgrounds].sort(
      (a, b) => Number(Boolean(b.background.fullHeight)) - Number(Boolean(a.background.fullHeight)),
    );
    for (const box of boxes) {
      const ops = byPage.get(box.pageIndex) ?? [];
      ops.push(...this.backgroundOperators(box));
      byPage.set(box.pageIndex, ops);
    }
    this.$backgrounds = [];

    for (const [pageIndex, ops] of byPage) {
      const page = this.$pages[pageIndex];
      if (!page) continue;
      const ref = doc.context.register(doc.context.contentStream(ops));
      const contents = page.node.Contents();
      if (contents instanceof PDFArray) contents.insert(0, ref);
      else page.node.addContentStream(ref);
    }
  }

  save() {
    if (!this.$document) throw new Error('Initialise document first');

    this.drawBackgrounds();

    return this.$document.save();
  }

  removeAllPages() {
    if (!this.$document) throw new Error('Initialise document first');

    const count = this.$document.getPageCount();

    if (count === 0) {
      this.$pages = [];
      return;
    }

    this.$document.removePage(0);

    this.removeAllPages();
  }
}
