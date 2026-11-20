import { hasText, parseMarksForFonts } from './utils';
import { DEFAULT_CONFIG, splitLongLine } from './pdf.service';
import { WriteLineParams, WriteLineResponse, FontType, Content } from './types';
import { PDFIcons } from './pdf.icons';

type TextRun = { text: string; font: FontType };

export class ContentToPdfService extends PDFIcons {
  constructor({ screen, fontSize, leading, color, isPreview = true } = DEFAULT_CONFIG) {
    super({
      screen,
      fontSize,
      leading,
      isPreview,
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
      // An empty paragraph between two others is a blank line, as in the editor. Leading and
      // trailing empty paragraphs (often left behind by editors) are ignored.
      const filled = content.map((params) =>
        hasText({ type: 'content', content: params, name: '' }),
      );
      const first = filled.indexOf(true);
      const last = filled.lastIndexOf(true);

      for (const [index, params] of content.entries()) {
        if (!filled[index]) {
          if (params.type === 'paragraph' && index > first && index < last) {
            const gap = this.lineHeight(this.fontSize(options.fontSize), options.leading);
            dimensions = {
              ...dimensions,
              nextY: dimensions.nextY - gap,
              height: dimensions.height + gap,
            };
          }
          continue;
        }

        const d = await this.writeContent(params, {
          ...options,
          y: dimensions.nextY,
          pageIndex: dimensions.pageIndex,
          bullet: params.type === 'bulletList' || options.bullet,
        });

        dimensions = { ...d, height: dimensions.height + d.height };
      }
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

  /**
   * Writes a paragraph of text runs (TipTap/ProseMirror text nodes, each with its own marks).
   * Runs in one font are joined and wrapped as one text. Runs in different fonts are wrapped word by
   * word across the lines, and each line is drawn as consecutive segments, one per font. A hard
   * break (Shift+Enter) starts a new line.
   */
  async writeParagraph(content: Content[], options: Omit<WriteLineParams, 'text'>) {
    const maxWidth = options.maxWidth || this.$maxWidth;
    const x = options.x || this.$paddingX;

    // Split at hard breaks; each block is a list of runs.
    const blocks: TextRun[][] = [[]];
    for (const node of content) {
      if (node.type === 'hardBreak' || node.type === 'hardbreak') blocks.push([]);
      else if (node.text) {
        const font: FontType = node.marks ? parseMarksForFonts(node.marks) : 'regular';
        blocks[blocks.length - 1].push({ text: node.text, font });
      }
    }

    let result: WriteLineResponse = {
      height: 0,
      width: maxWidth,
      nextX: x,
      nextY: options.y || this.$paddingY,
      pageIndex: options.pageIndex || 0,
    };

    for (const [index, runs] of blocks.entries()) {
      // Only the paragraph's first line gets the bullet (and the caller's page-break look-ahead).
      const lineOptions = index === 0 ? options : { ...options, bullet: false, offset: 0 };

      if (!runs.length) {
        // An empty line between two hard breaks.
        const lineHeight = this.lineHeight(this.fontSize(options.fontSize), options.leading);
        result = {
          ...result,
          nextY: result.nextY - lineHeight,
          height: result.height + lineHeight,
        };
        continue;
      }

      const d = runs.every((run) => run.font === runs[0].font)
        ? await this.writeMultiLine({
            ...lineOptions,
            text: runs.map((run) => run.text).join(''),
            font: runs[0].font,
            x,
            y: result.nextY,
            pageIndex: result.pageIndex,
          })
        : await this.writeRuns(runs, {
            ...lineOptions,
            x,
            y: result.nextY,
            pageIndex: result.pageIndex,
          });

      result = { ...d, width: maxWidth, nextX: x, height: result.height + d.height };
    }

    return result;
  }

  /** Wraps runs in different fonts word by word and draws each line as one segment per font. */
  protected async writeRuns(runs: TextRun[], options: Omit<WriteLineParams, 'text'>) {
    const { fontSize, bullet } = options;
    const maxWidth = options.maxWidth || this.$maxWidth;
    const x = options.x || this.$paddingX;
    // Every line wraps in the width left after the bullet, like single-font text does.
    const prefix = this.prefixWidth({ text: '', bullet, fontSize });
    const available = Math.max(maxWidth - prefix, 1) + 0.5;
    const widthOf = (text: string, font: FontType) =>
      this.getTextWidth({ text, font: this.getFont(font), size: fontSize, leading: this.$leading });

    // Fill lines greedily, word by word. Each line is a list of segments; neighbours with the same
    // font are merged.
    const lines: TextRun[][] = [[]];
    let used = 0;
    const append = (text: string, font: FontType) => {
      const line = lines[lines.length - 1];
      const last = line[line.length - 1];
      if (last?.font === font) last.text += text;
      else line.push({ text, font });
      used += widthOf(text, font);
    };
    const newLine = () => {
      const line = lines[lines.length - 1];
      const last = line[line.length - 1];
      if (last) last.text = last.text.trimEnd();
      lines.push([]);
      used = 0;
    };

    for (const run of runs) {
      for (const token of run.text.split(/(\s+)/)) {
        if (!token) continue;
        if (/^\s+$/.test(token)) {
          if (used > 0) append(' ', run.font);
          continue;
        }
        const width = widthOf(token, run.font);
        if (used + width <= available) {
          append(token, run.font);
          continue;
        }
        if (used > 0) newLine();
        if (width <= available) {
          append(token, run.font);
          continue;
        }
        // A word wider than the line breaks by character.
        const pieces = splitLongLine(token, available, (text) => widthOf(text, run.font));
        pieces.forEach((piece, i) => {
          append(piece, run.font);
          if (i < pieces.length - 1) newLine();
        });
      }
    }
    newLine();
    lines.pop();

    let result: WriteLineResponse = {
      height: 0,
      width: maxWidth,
      nextX: x,
      nextY: options.y || this.$paddingY,
      pageIndex: options.pageIndex || 0,
    };

    for (const [lineIndex, segments] of lines.entries()) {
      const firstLine = lineIndex === 0;
      let segmentX = x;
      let lineTop = result.nextY;
      let pageIndex = result.pageIndex;
      let last: WriteLineResponse | undefined;

      for (const [i, segment] of segments.entries()) {
        const width = widthOf(segment.text, segment.font);
        const withBullet = firstLine && i === 0 && Boolean(bullet);
        // The first segment decides the line's page and position; the rest follow it.
        last = await this.writeLine({
          ...options,
          text: segment.text,
          font: segment.font,
          justify: 'left',
          bullet: withBullet,
          offset: firstLine && i === 0 ? options.offset : 0,
          x: segmentX,
          y: lineTop,
          pageIndex,
          maxWidth: width + (withBullet ? prefix : 0) + 1,
        });
        if (i === 0) {
          lineTop = last.nextY + last.height;
          pageIndex = last.pageIndex;
          segmentX += withBullet ? prefix : 0;
        }
        segmentX += width;
      }

      if (last) {
        result = { ...last, width: maxWidth, nextX: x, height: result.height + last.height };
      }
    }

    return result;
  }
}
