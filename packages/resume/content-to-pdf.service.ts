import { hasText, parseMarksForFonts } from './utils';
import { DEFAULT_CONFIG } from './pdf.service';
import { WriteLineParams, WriteLineResponse, FontType, Content } from './types';
import { PDFIcons } from './pdf.icons';

export class ContentToPdfService extends PDFIcons {
  constructor({ screen, fontSize, leading, color, isPreview = true, fonts } = DEFAULT_CONFIG) {
    super({
      screen,
      fontSize,
      leading,
      isPreview,
      fonts,
      color,
    });
  }

  contentToRowParams(params: Content, isBullet = false) {
    const fontType = params.marks ? parseMarksForFonts(params.marks) : 'regular';
    return {
      text: params.text || '',
      font: this.$fonts[fontType],
      bullet: isBullet,
    };
  }

  async writeContent(
    { content = [], type, text, marks }: Content,
    options: Omit<WriteLineParams, 'text'>,
  ): Promise<WriteLineResponse> {
    let dimensions: WriteLineResponse = {
      height: 0,
      width: 0,
      nextX: options.x || 0,
      nextY: options.y || 0,
      pageIndex: options.pageIndex || 0,
    };

    if (!hasText({ type: 'content', content: { content }, name: '' })) return dimensions;

    const font: FontType = !marks ? 'regular' : parseMarksForFonts(marks);

    if (type === 'text' && text) {
      return this.writeLine({ ...options, text, font });
    }

    if (type === 'paragraph' && content.length) {
      return this.writeParagraph(content, options);
    }

    if (type === 'bulletList' && content.length) {
      return this.writeBulletList(content, options);
    }

    if (content) {
      for (const params of content) {
        const d = await this.writeContent(params, {
          ...options,
          y: dimensions.nextY,
          pageIndex: dimensions.pageIndex,
          bullet: params.type === 'bulletList' || options.bullet,
        });

        dimensions = { ...d, height: dimensions.height + d.height };
      }
    }

    if (type === 'paragraph' && content.length === 0) {
      dimensions.nextY = dimensions.nextY - this.fontSize('md');
    }

    return dimensions;
  }

  async writeBulletList(content: Content[], options: Omit<WriteLineParams, 'text'>) {
    const indent = 12;
    const maxWidth = options.maxWidth || this.$maxWidth;
    const positionX = options.x || this.$paddingX;
    let currentPageIndex = options.pageIndex || 0;

    let result: WriteLineResponse = {
      height: 0,
      width: maxWidth,
      nextX: positionX > maxWidth ? this.$paddingX : positionX,
      nextY: options.y || this.$paddingY,
      pageIndex: currentPageIndex,
    };

    for (const c of content) {
      if (c.type === 'bulletList' && c.content) {
        const d = await this.writeBulletList(c.content, {
          ...options,
          y: result.nextY,
          pageIndex: result.pageIndex,
          x: positionX + indent,
          maxWidth: maxWidth - indent,
        });

        result = {
          ...d,
          height: result.height + d.height,
          width: result.width + d.width,
        };
        currentPageIndex = d.pageIndex;
      }

      if (c.type === 'listItem' && c.content) {
        const d = await this.writeBulletList(c.content, {
          ...options,
          y: result.nextY,
          pageIndex: currentPageIndex,
          x: positionX,
          maxWidth,
        });

        result = {
          ...d,
          height: result.height + d.height,
          width: result.width + d.width,
        };

        currentPageIndex = d.pageIndex;
      }

      if (c.type === 'paragraph' && c?.content?.length) {
        const d = await this.writeParagraph(c.content, {
          ...options,
          y: result.nextY,
          pageIndex: currentPageIndex,
          x: positionX,
          maxWidth: maxWidth,
        });

        result = {
          ...d,
          height: result.height + d.height,
          width: result.width + d.width,
        };

        currentPageIndex = d.pageIndex;
      }
    }

    return { ...result, pageIndex: currentPageIndex };
  }

  async writeParagraph(content: Content[], options: Omit<WriteLineParams, 'text'>) {
    const maxWidth = options.maxWidth || this.$maxWidth;

    let dimensions: WriteLineResponse = {
      height: 0,
      width: maxWidth,
      nextX: options.x || this.$paddingX,
      nextY: options.y || this.$paddingY,
      pageIndex: options.pageIndex || 0,
    };

    const contentLines = content.reduce<Array<{ params?: WriteLineParams[]; break?: boolean }>>(
      (accumulator, params) => {
        const lastIndex = accumulator.length - 1;
        const last = accumulator[lastIndex];
        const font: FontType = !params.marks ? 'regular' : parseMarksForFonts(params.marks);

        if (!last && params.text) {
          accumulator.push({
            params: [
              {
                ...options,
                text: params.text,
                font,
              },
            ],
          });

          return accumulator;
        }

        if (last?.break && params.text) {
          accumulator.push({
            params: [
              {
                ...options,
                text: params.text,
                font,
              },
            ],
          });

          return accumulator;
        }

        if (params.type !== 'hardbreak' && params.text) {
          accumulator[lastIndex].params = [
            ...(last.params || []),
            {
              ...options,
              text: params.text,
              bullet: false,
              font,
            },
          ];
          return accumulator;
        }

        return [...accumulator, { break: true }];
      },
      [],
    );

    for (const { params, break: isBreak } of contentLines) {
      const fontSize = this.fontSize('md');

      if (isBreak) {
        dimensions.nextY = dimensions.nextY - fontSize;
        dimensions.nextX = options.x || this.$paddingX;
      }

      if (params) {
        const [first, ...writeParams] = params;

        let d = await this.writeMultiLine({
          ...first,
          y: dimensions.nextY,
          x: dimensions.nextX,
          pageIndex: dimensions.pageIndex,
        });

        dimensions = { ...d, height: dimensions.height + d.height };

        const availableWidth = maxWidth - d.width;

        for (const p of writeParams) {
          const restOfTheTextLines = this.getTextLines({
            text: p.text,
            font: this.getFont(p.font),
            size: 'md',
            maxWidth: availableWidth,
            leading: this.$leading,
            wordBreaks: p.wordBreaks || [' '],
          });

          if (restOfTheTextLines.length > 1) {
            const [secondLine, ...rest] = restOfTheTextLines;

            d = await this.writeLine({
              ...options,
              font: p.font || this.defaultFont,
              text: secondLine,
              y: d.nextY + fontSize,
              x: d.nextX + fontSize,
              fontSize: 'md',
              pageIndex: dimensions.pageIndex,
              maxWidth: availableWidth,
              bullet: false,
            });

            dimensions = { ...d, height: dimensions.height + d.height };

            d = await this.writeMultiLine({
              ...options,
              font: p.font || this.defaultFont,
              text: rest.join(''),
              y: dimensions.nextY,
              fontSize: 'md',
              maxWidth: options.maxWidth,
              bullet: false,
              pageIndex: dimensions.pageIndex,
            });

            dimensions = { ...d, height: dimensions.height + d.height };
          }
        }
      }
    }

    return dimensions;
  }
}
