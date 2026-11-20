import { PDFDocument, PDFPage, StandardFonts, PDFFont, RGB, breakTextIntoLines } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { fromHexStr, getIconPath, getLinkIconType } from './utils';
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
  TextLinesParams,
  TextWidthParams,
  Coords,
  JustifyTextParams,
  CustomFont,
  Watermark,
  IconTypes,
} from './types';
import { getFontSize, getLineHeight, getSeparatorSize, getSpacing, justifyLine } from './utils';
import { iconScaleMap } from './constants';

/** Hex colors (for example `'#00549F'`) for any of the template color slots. */
export type ColorOverrides = Partial<Record<Colors, string>>;

export type Config = {
  customFont?: CustomFont;
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
  Pick<Config, 'color' | 'colors' | 'fontSize' | 'leading' | 'customFont'>
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
const STANDARD_FONTS: Record<FontType, StandardFonts> = {
  regular: StandardFonts.Helvetica,
  semibold: StandardFonts.HelveticaBold,
  bold: StandardFonts.HelveticaBold,
  italic: StandardFonts.HelveticaOblique,
  'bold-italic': StandardFonts.HelveticaBoldOblique,
};

const fontCacheKey = (font: CustomFont) => JSON.stringify([font.name, font.fonts]);

/** Folds the `color` shorthand into `colors` so layers can be merged key by key. */
const normalizeColors = ({
  color,
  colors,
}: Pick<Partial<Config>, 'color' | 'colors'>): ColorOverrides => ({
  ...(color ? { secondary: color } : {}),
  ...colors,
});

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
  protected $fonts: Partial<Record<FontType, PDFFont>> = {};
  protected $fontScale: Size = 'md';
  protected $leading: Size = 'md';
  protected $colors: Record<Colors, RGB> = {
    primary: fromHexStr(DEFAULT_COLORS.primary),
    secondary: fromHexStr(DEFAULT_COLORS.secondary),
    neutral: fromHexStr(DEFAULT_COLORS.neutral),
  };
  protected $paddingX = 20;
  protected $paddingY = 20;
  protected $safeArea = 40;
  protected $watermark?: Watermark;

  protected $isPreview = true;
  protected $fontFamily = 'Helvetica';

  protected $document: PDFDocument | null = null;
  protected $pages: PDFPage[] = [];
  protected $defaultFont?: PDFFont;
  /** Characters the standard fonts can encode. Text drawn with them is limited to this set. */
  private $standardCharset?: Set<number>;

  /** Settings from the constructor or `init()`. Per-render overrides are layered on top and never written back. */
  protected $baseConfig: Config;
  /** Typeface embedded into every new document unless a render overrides it. */
  protected $baseFont?: CustomFont;
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

  getFont(type: FontType = 'regular') {
    const font = this.$fonts?.[type] || this.defaultFont;

    if (!font) throw new Error('Font is not initialised');

    return font;
  }

  fontSize(size: Size) {
    return getFontSize(size, this.$fontScale);
  }

  lineHeight(fontSize: number, leading: Size = this.$leading) {
    return getLineHeight(fontSize, leading);
  }

  color(color: Colors) {
    return this.$colors[color];
  }

  spacing(size?: Size) {
    return size ? getSpacing(size, this.$fontScale) : 0;
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
    this.$colors = {
      primary: fromHexStr(hex.primary),
      secondary: fromHexStr(hex.secondary),
      neutral: fromHexStr(hex.neutral),
    };
  }

  /** Layers per-render options over the base config without mutating it. Undefined options are ignored. */
  protected resolveConfig(options: RenderOptions = {}): Config {
    const base = this.$baseConfig;

    return {
      ...base,
      fontSize: options.fontSize ?? base.fontSize,
      leading: options.leading ?? base.leading,
      customFont: options.customFont ?? base.customFont,
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
      (Object.keys(STANDARD_FONTS) as FontType[]).map(
        async (type) => [type, await doc.embedFont(STANDARD_FONTS[type])] as const,
      ),
    );
    this.$fonts = Object.fromEntries(standard) as Partial<Record<FontType, PDFFont>>;
    this.$defaultFont = this.$fonts.regular;
    this.$fontFamily = 'Helvetica';
    this.$pages = [];
  }

  /** True while the document uses the standard fonts, that is when no custom font is embedded. */
  protected get usesStandardFonts() {
    return this.$fontFamily === 'Helvetica';
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
    this.$baseFont = this.$baseConfig.customFont;
    this.applyConfig(this.$baseConfig);

    await this.newDocument();
  }

  /**
   * Starts a new render in a fresh document. `options` apply to this render only; the next call
   * starts again from the values given to `init()`.
   */
  async update(options: RenderOptions = {}) {
    if (!this.$document) throw new Error('Initialise document first');

    const config = this.resolveConfig(options);
    this.applyConfig(config);

    await this.newDocument();

    const font = options.customFont ?? this.$baseFont;
    if (font) await this.embedFonts(font);

    await this.addPage();
  }

  /** Downloads a font family once and keeps it for later documents. Only the base font and the most recent other font are kept. */
  protected async loadFonts(customFont: CustomFont): Promise<FontBytes> {
    const key = fontCacheKey(customFont);
    const cached = this.$fontCache.get(key);
    if (cached) return cached;

    const bytes = await fetchCustomFont(customFont.fonts);

    const baseKey = this.$baseFont ? fontCacheKey(this.$baseFont) : undefined;
    for (const existing of this.$fontCache.keys()) {
      if (existing !== baseKey) this.$fontCache.delete(existing);
    }
    this.$fontCache.set(key, bytes);

    return bytes;
  }

  async embedFonts(customFont: CustomFont) {
    if (!this.$document) throw new Error('Initialise document first');

    const doc = this.$document; // ts workaround to avoid type error

    const fontBytes = await this.loadFonts(customFont);
    const embedded = await Promise.all(
      fontBytes.map(
        async ({ type, arrayBuffer }) =>
          [type, await doc.embedFont(arrayBuffer, { subset: customFont.subset === true })] as const,
      ),
    );

    this.$fonts = Object.fromEntries(embedded) as Partial<Record<FontType, PDFFont>>;
    this.$fontFamily = customFont.name;

    return this.$fonts;
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

    const font = this.getFont(fontStyle);

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
        color: 'secondary',
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
      leading,
      maxWidth = this.$maxWidth,
      wordBreaks = [' '],
      y = this.$paddingY,
      x = this.$paddingX,
      pageIndex,
    } = options;

    let currentPageIndex = pageIndex;

    const font = this.getFont(fontStyle);

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
  protected lineWidth({ text, font = 'regular', fontSize, icon, leading }: WriteLineParams) {
    const textWidth = this.getTextWidth({
      text,
      font: this.getFont(font),
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
      separator = '',
      pageIndex = this.currentPageIndex,
    } = options;

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
      this.lineWidth({ ...values[i], text: textOf(i, startsLine) });
    const lineHeights = values.map((value) =>
      this.lineHeight(this.fontSize(value.fontSize), value.leading),
    );
    const rowLineHeight = Math.max(...lineHeights);

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
      justify: 'left' | 'center' = 'left',
    ) => {
      const result = await this.writeMultiLine({
        ...values[i],
        text: textOf(i, startsLine),
        justify,
        x: atX,
        y: lineTop - (rowLineHeight - lineHeights[i]),
        pageIndex: currentPageIndex,
        maxWidth,
      });
      if (result.pageIndex !== currentPageIndex) {
        currentPageIndex = result.pageIndex;
        bottom = result.nextY;
      } else {
        bottom = Math.min(bottom, result.nextY);
      }
    };

    /**
     * Writes values between `left` and `left + width`, as many per line as fit. Lines are centered
     * when `center` is set. A value wider than the whole width gets a line of its own and wraps.
     */
    const flow = async (indices: number[], left: number, width: number, center: boolean) => {
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
      for (const line of lines) {
        const lineWidth = line.reduce(
          (sum, i, index) => sum + widthOf(i, index === 0) + (index ? space : 0),
          0,
        );
        if (lineWidth > width) {
          // A single value too wide for the line: wrap it across the full width.
          await write(line[0], true, left, lineTop, width, center ? 'center' : 'left');
        } else {
          let cursor = center ? left + (width - lineWidth) / 2 : left;
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
    } else if (justify === 'between' && last > 0 && widthOf(last, false) <= containerWidth / 2) {
      // Keep the last value (usually a date) on the right of the first line and wrap the rest in the
      // space left.
      const lastWidth = widthOf(last, false);
      await write(last, false, right - lastWidth, top, lastWidth);
      await flow(all.slice(0, last), x, containerWidth - lastWidth - space, false);
    } else {
      await flow(all, x, containerWidth, justify === 'center');
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

  save() {
    if (!this.$document) throw new Error('Initialise document first');

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
