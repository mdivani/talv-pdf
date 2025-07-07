import { PDFDocument, rgb, PDFPage, StandardFonts, PDFFont, breakTextIntoLines } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { getIconPath, getLinkIconType } from './utils';
import { fetchCustomFont, fetchDefaultFont } from './assets';
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
} from './types';
import { getFontSize, getLineHeight, getSeparatorSize, getSpacing, justifyLine } from './utils';
import { iconScaleMap } from './constants';

export const DEFAULT_CONFIG = {
  screen: {
    width: 595,
    height: 842,
    paddingX: 20,
    paddingY: 20,
  },
  fontSize: 'lg',
  leading: 'md',
  fonts: ['regular', 'semibold', 'bold', 'italic', 'bold-italic'],
  isPreview: true,
  color: rgb(0, 0.36, 0.64),
};

export class BasePDFService {
  protected $width = 595;
  protected $height = 842;
  protected $maxWidth = 515;
  protected $maxHeight = 762;
  protected $fonts: Partial<Record<FontType, PDFFont>> = {};
  protected $fontScale: Size = 'md';
  protected $leading: Size = 'md';
  protected $colors = {
    primary: rgb(0.11, 0.11, 0.11),
    secondary: rgb(0, 0.36, 0.64),
    neutral: rgb(0.48, 0.48, 0.48),
  };
  protected $paddingX = 20;
  protected $paddingY = 20;
  protected $safeArea = 40;

  protected $isPreview = true;

  protected $document: PDFDocument | null = null;
  protected $pages: PDFPage[] = [];
  protected $defaultFont?: PDFFont;

  constructor({ screen, fontSize, leading, color, isPreview = true } = DEFAULT_CONFIG) {
    this.$fontScale = fontSize as Size;
    this.$leading = leading as Size;
    this.$width = screen.width;
    this.$maxWidth = screen.width - 2 * screen.paddingX;
    this.$height = screen.height;
    this.$maxHeight = screen.height - 2 * screen.paddingY;
    this.$paddingX = screen.paddingX;
    this.$paddingY = screen.paddingY;
    this.$isPreview = isPreview;
    this.$colors.secondary = color;
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

  justifyText({ justify, text, containerWidth, maxWidth, size, font, wordBreaks, leading }: JustifyTextParams) {
    const lines = this.getTextLines({ text, maxWidth, size, font, wordBreaks, leading });

    const widths = lines.map((line) => this.getTextWidth({ text: line, size, font, leading }));

    return widths.map((width) => {
      const positionX = justifyLine({ justify, textWidth: width, containerWidth });

      return { positionX, text };
    });
  }

  async init({ fontSize, leading, screen, color } = DEFAULT_CONFIG) {
    this.$fontScale = fontSize as Size;
    this.$leading = leading as Size;
    this.$width = screen.width;
    this.$height = screen.height;
    this.$paddingX = screen.paddingX;
    this.$paddingY = screen.paddingY;
    this.$colors.secondary = color;

    this.$document = await PDFDocument.create();
    this.$defaultFont = await this.$document.embedFont(StandardFonts.Helvetica);
    this.$pages = [];

    await this.addPage();
  }

  async embedFonts(fonts: FontType[], customFont?: Record<FontType, string>) {
    if (!this.$document) throw new Error('Initialise document first');

    this.$document.registerFontkit(fontkit);
    const doc = this.$document;

    if (customFont) {
      const customFonts = await fetchCustomFont(customFont);
      const promise = customFonts.map(async (font) => {
        return {
          [font.type]: await doc.embedFont(font.arrayBuffer),
        };
      });

      const customFontsArr = await Promise.all(promise);

      this.$fonts = { ...this.$fonts, ...customFontsArr };
    } else {
      const promise = fonts.map(async (type) => {
        const font = await fetchDefaultFont(type);
        return {
          [type]: await doc.embedFont(font),
        };
      });

      const fontsArr = await Promise.all(promise);

      const customFonts = fontsArr.reduce<Partial<Record<FontType, PDFFont>>>(
        (accumulator, font) => ({ ...accumulator, ...font }),
        {},
      );

      this.$fonts = { ...this.$fonts, ...customFonts };
      return customFonts;
    }

    return this.$fonts;
  }

  async addPage() {
    if (!this.$document) throw new Error('Initialise class first');

    const page = await this.$document.addPage([this.$width, this.$height]);

    // if (this.$isPreview) {
    //   const logoBytes = await fetchImage('/public/logo.png');
    //   const logo = await this.$document.embedPng(logoBytes as unknown as Uint8Array);

    //   page.drawImage(logo, {
    //     x: 10,
    //     y: 5,
    //     width: 14,
    //     height: 16,
    //   });
    //   page.drawText('talvio.co', {
    //     x: 28,
    //     y: 10,
    //     size: this.fontSize('sm'),
    //     color: rgb(0, 0.36, 0.64),
    //   });
    // }

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
    console.log('text', text, leading, lineHeight);
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
    const positionX = x + justifyLine({ justify, textWidth: currentWidth, containerWidth: maxWidth });

    if (this.isOverflowing(currentY - offset)) {
      if (this.currentPageIndex > currentPageIndex) {
        currentPageIndex += 1;
        currentY = this.$height - this.$paddingY;
      } else {
        currentPageIndex += 1;
        currentY = await this.addPage();
      }
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
        y,
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
      const prefixes = index === 0 ? { icon: options.icon, bullet: options.bullet } : { icon: null, bullet: false };

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
          pageIndex,
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

  drawStreightLine({ x, y, width, size = 'sm', color: colorType = 'secondary', page }: DrawLineParams) {
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
}
