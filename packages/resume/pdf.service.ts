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

    const lines = breakTextIntoLines(text, wordBreaks, maxWidth, getTextWidth);

    return lines;
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
        async ({ type, arrayBuffer }) => [type, await doc.embedFont(arrayBuffer)] as const,
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

  addText({ text = '', page, ...options }: WriteTextParams) {
    const fontSize = this.fontSize(options.size);
    const color = this.color(options.color);

    page.drawText(text, {
      ...options,
      size: fontSize,
      color,
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

    const { height: textHeight, width: textWidth } = this.getTextDimensions({
      text,
      font,
      maxWidth,
      size,
      wordBreaks,
      leading: leading || this.$leading,
    });

    currentWidth = textWidth;
    currentY = currentY - textHeight;
    const positionX =
      x + justifyLine({ justify, textWidth: currentWidth, containerWidth: maxWidth });

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
      maxWidth,
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

    const lines = this.getTextLines({
      text,
      maxWidth,
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

  async writeRow(options: WriteRowParams): Promise<WriteLineResponse> {
    const {
      texts,
      justify,
      containerWidth,
      x,
      y,
      gap,
      dynamicGap = 0,
      separator = '',
      pageIndex = this.currentPageIndex,
    } = options;

    const filteredTexts = texts.filter((txt) => txt.text);
    const space = dynamicGap ? dynamicGap : this.spacing(gap);
    let height = 0;
    let positionY = y;

    let currentPageIndex = pageIndex;

    if (justify === 'start') {
      let positionX = x;
      let previousLineHeight = 0;

      // A row is one line: if its tallest value doesn't fit, move the whole row to the next page
      // rather than letting values split across pages.
      const rowHeight = Math.max(
        0,
        ...filteredTexts.map((txt) => this.lineHeight(this.fontSize(txt.fontSize), txt.leading)),
      );
      if (
        filteredTexts.length &&
        this.isOverflowing(positionY - rowHeight - (filteredTexts[0].offset ?? 0))
      ) {
        currentPageIndex = await this.nextPage(currentPageIndex);
        positionY = this.pageTop;
      }

      for (const [index, txt] of filteredTexts.entries()) {
        const currentFontSize = this.fontSize(txt.fontSize);
        const currentLineHeight = this.lineHeight(currentFontSize, txt.leading);

        if (previousLineHeight) {
          positionY =
            positionY -
            (currentLineHeight > previousLineHeight
              ? currentLineHeight - previousLineHeight
              : previousLineHeight > currentLineHeight
                ? previousLineHeight - currentLineHeight
                : 0);
        }

        const result = await this.writeMultiLine({
          ...txt,
          text: index === 0 ? txt.text : separator + txt.text,
          x: positionX,
          y: positionY,
          pageIndex: currentPageIndex,
          maxWidth: containerWidth,
        });

        previousLineHeight = currentLineHeight;
        positionX = result.nextX + result.width + space;
        positionY = result.nextY > positionY ? result.nextY + result.height : positionY;
        height = result.height > height ? result.height : height;
        currentPageIndex = result.pageIndex;
      }
    }

    if (justify === 'center') {
      let totalWidth = space * (texts.length - 1);
      filteredTexts.forEach((txt) => {
        const font = this.getFont(txt.font || 'regular');

        const dimensions = this.getWriteLineDimensions({
          ...txt,
          x,
          y,
          size: txt.fontSize || 'sm',
          font,
          maxWidth: txt.maxWidth || containerWidth,
          leading: txt.leading || this.$leading,
        });

        totalWidth = totalWidth + dimensions.width;
      });

      const startX = (containerWidth - totalWidth) / 2 + this.$paddingX / 2;

      return this.writeRow({
        ...options,
        pageIndex: currentPageIndex,
        gap,
        justify: 'start',
        x: startX,
      });
    }

    if (justify === 'between') {
      const totalWidth = filteredTexts.reduce(
        (acc, txt) =>
          acc +
          this.getWriteLineDimensions({
            ...txt,
            x,
            y,
            size: txt.fontSize || 'sm',
            font: this.getFont(txt.font || 'regular'),
            maxWidth: txt.maxWidth || containerWidth,
            leading: txt.leading || this.$leading,
          }).width,
        0,
      );

      const dynamicGap = (containerWidth - totalWidth) / (texts.length - 1);

      return this.writeRow({
        ...options,
        gap,
        dynamicGap,
        justify: 'start',
        x,
        pageIndex: currentPageIndex,
      });
    }

    return {
      height,
      width: containerWidth,
      nextX: x,
      nextY: positionY - height,
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
