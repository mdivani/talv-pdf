import { ResumeData } from './types';
import { Template, Group, Item, Field, Coords, Size, LabelItem, SeparatorVariant } from './types';
import { ContentToPdfService } from './content-to-pdf.service';
import { Config, DEFAULT_CONFIG, RenderOptions } from './pdf.service';
import { getWidth, mapDataToTemplate, hasContent, hasText } from './utils';
export { formatTextWithAffixes, getWidth, mapDataToTemplate } from './utils';

type CreateParams = Partial<Config>;

/** Copies plain data (objects, arrays, strings), passing every string through `fn`. */
function mapStrings<T>(value: T, fn: (text: string) => string): T {
  if (typeof value === 'string') return fn(value) as T;
  if (Array.isArray(value)) return value.map((item) => mapStrings(item, fn)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, mapStrings(item, fn)]),
    ) as T;
  }
  return value;
}

type Position = { y: number; pageIndex: number };

/** True when `a` is further down the document than `b`: on a later page, or lower on the same page. */
const isFurther = (a: Position, b: Position) =>
  a.pageIndex > b.pageIndex || (a.pageIndex === b.pageIndex && a.y < b.y);

type GenerateParams = {
  data: ResumeData;
  template: Template;
  options?: RenderOptions;
};

export class ResumePDFService extends ContentToPdfService {
  private $ready = false;
  /** Tail of the render queue. Renders share one document, so they must not interleave. */
  private $queue: Promise<unknown> = Promise.resolve();

  constructor() {
    super();
  }

  async create({
    screen = DEFAULT_CONFIG.screen,
    fontSize = DEFAULT_CONFIG.fontSize,
    leading = DEFAULT_CONFIG.leading,
    color = DEFAULT_CONFIG.color,
    colors,
    isPreview = DEFAULT_CONFIG.isPreview,
    watermark,
    customFont,
  }: CreateParams = DEFAULT_CONFIG) {
    await super.init({
      screen,
      fontSize,
      leading,
      color,
      colors,
      isPreview,
      watermark,
      customFont,
    });

    // Download a custom font now so the first render doesn't wait for it. Only the bytes are cached:
    // each render embeds them into its own document. Without a custom font, nothing is fetched.
    if (customFont) await this.loadFonts(customFont);

    this.$ready = true;
  }

  get isInitialised() {
    return this.$ready;
  }

  /**
   * Renders one resume into a brand-new document and returns its bytes. Calls on the same
   * instance run one at a time, so a render never sees another render's pages or settings.
   */
  generate({ data, template, options = {} }: GenerateParams): Promise<Uint8Array> {
    const render = this.$queue.then(async () => {
      await this.update(options);

      // With the standard fonts, characters they can't encode are replaced before layout, so text is
      // measured and drawn the same way. Template strings (labels, separators) go through it too.
      const encodable = (text: string) => this.encodable(text);
      const fields = mapDataToTemplate(
        mapStrings(data, encodable),
        mapStrings(template, encodable),
      );

      await this.writeToPDF(fields.groups);

      return this.save();
    });

    this.$queue = render.catch(() => undefined);

    return render;
  }

  async writeToPDF(groups: Group<Item>[]) {
    let currentY = this.$height - this.$paddingY;
    let currentPageIndex = 0;
    const currentX = this.$paddingX;

    for (const group of groups) {
      const result = await this.writeGroup(group, {
        y: currentY,
        x: currentX,
        pageIndex: currentPageIndex,
      });

      currentY = result.currentY;
      currentPageIndex = result.pageIndex;
    }
  }

  async writeGroup(
    group: Group<Item>,
    {
      y,
      x,
      containerWidth = this.$maxWidth,
      pageIndex,
    }: Coords & { containerWidth?: number; pageIndex: number },
  ): Promise<{ currentY: number; currentX: number; width: number; pageIndex: number }> {
    let currentY = y;
    let currentX = x;
    let currentPageIndex = pageIndex;

    const { gap, direction, label, width, fields, groups, separator } = group;
    const space = this.spacing(gap);

    let maxWidth = getWidth(width, containerWidth);

    if (hasContent(group)) {
      currentY = await this.drawSeparator({
        x: currentX,
        y: currentY,
        pageIndex: currentPageIndex,
        width: maxWidth,
        separator,
      });

      const labelResult = await this.writeLabel({
        currentY,
        currentX,
        currentPageIndex,
        maxWidth,
        label,
        y: currentY,
        x: currentX,
      });

      currentY = labelResult.currentY;
      currentX = labelResult.currentX;
      currentPageIndex = labelResult.pageIndex;
      maxWidth = labelResult.width;
    }

    if (groups) {
      const horizontal = direction === 'horizontal';
      // Columns side by side all start where the group's content starts.
      const start = { y: currentY, pageIndex: currentPageIndex };
      // Where the group ends: the furthest point any sub-group reached.
      let end = { ...start };

      for (const subGroup of groups) {
        const from = horizontal ? start : { y: currentY, pageIndex: currentPageIndex };
        const result = await this.writeGroup(subGroup, {
          y: from.y,
          x: currentX,
          containerWidth: maxWidth - (horizontal ? space : 0),
          pageIndex: from.pageIndex,
        });

        // A sub-group that drew nothing leaves the position where it was, without adding the gap.
        const drewSomething = result.pageIndex !== from.pageIndex || result.currentY !== from.y;
        const reached = { y: result.currentY - space, pageIndex: result.pageIndex };
        if (drewSomething && isFurther(reached, end)) end = reached;

        if (!horizontal) {
          currentY = end.y;
          currentPageIndex = end.pageIndex;
        }
        currentX = horizontal ? result.width + space : result.currentX;
      }

      currentY = end.y;
      currentPageIndex = end.pageIndex;
    }

    if (fields) {
      for (const field of fields) {
        const result = await this.writeField(
          { ...field, maxWidth },
          { y: currentY, x: currentX, pageIndex: currentPageIndex },
        );

        currentY = result.currentY - space;
        currentX = result.currentX;
        currentPageIndex = result.pageIndex;
      }
    }

    return { currentY, currentX, width: maxWidth + this.$paddingX, pageIndex: currentPageIndex };
  }

  async writeField(
    field: Field<Item>,
    { y, x, pageIndex }: { y: number; x: number; pageIndex: number },
  ) {
    const { items, gap, maxWidth = this.$maxWidth, label, separator } = field;

    let currentY = y;
    let currentX = x;
    let currentMaxWidth = maxWidth;
    let currentPageIndex = pageIndex;

    const space = this.spacing(gap);

    if (hasContent({ fields: [field] })) {
      currentY = this.drawSeparator({
        x: currentX,
        y: currentY,
        pageIndex: currentPageIndex,
        width: currentMaxWidth,
        separator,
      });

      const labelResult = await this.writeLabel({
        currentY,
        currentX,
        currentPageIndex,
        maxWidth: currentMaxWidth,
        label,
        y: currentY,
        x: currentX,
      });

      currentY = labelResult.currentY;
      currentX = labelResult.currentX;
      currentPageIndex = labelResult.pageIndex;
      currentMaxWidth = labelResult.width;
    }

    if (items?.length) {
      for (const item of items) {
        const { top, bottom } = item.margins || {};

        if (top) {
          currentY -= this.spacing(top);
        }

        const result = await this.writeItem(item, {
          y: currentY,
          x: currentX,
          pageIndex: currentPageIndex,
          maxWidth: currentMaxWidth,
        });

        currentY = result.currentY - this.spacing(bottom) - space;
        currentX = result.currentX;
        currentPageIndex = result.pageIndex;
      }
    }

    return { currentY, currentX: x, pageIndex: currentPageIndex };
  }

  async writeItem(
    item: Item,
    { y, x, pageIndex, maxWidth }: Coords & { pageIndex: number; maxWidth: number },
  ) {
    let currentY = y;
    let currentX = x;
    let currentPageIndex = pageIndex;

    const { top, bottom } = item.margins || {};

    if (!hasText(item))
      return {
        currentX,
        currentY,
        pageIndex,
      };

    if (top) {
      currentY -= this.spacing(top);
    }

    if (item.type === 'text') {
      const result = await this.writeMultiLine({
        ...item.item,
        maxWidth: item.item.maxWidth || maxWidth,
        font: item.item.font || 'regular',
        pageIndex: currentPageIndex,
        y: currentY,
        x: currentX,
      });

      currentY = result.nextY;
      currentX = result.nextX;
      currentPageIndex = result.pageIndex;
    }

    if (item.type === 'content' && item.content) {
      const result = await this.writeContent(item.content, {
        ...item,
        y: currentY,
        x: currentX,
        maxWidth,
        pageIndex: currentPageIndex,
        color: 'primary',
        fontSize: 'md',
        font: 'regular',
      });

      currentY = result.nextY;
      currentX = result.nextX;
      currentPageIndex = result.pageIndex;
    }

    if (item.type === 'row' && item.item) {
      const result = await this.writeRow({
        ...item.item,
        pageIndex: currentPageIndex,
        containerWidth: maxWidth,
        y: currentY,
        x: currentX,
        texts: item.item.texts.map((text) => ({
          ...text,
          font: text.font || 'regular',
          pageIndex: currentPageIndex,
          y: currentY,
          x: currentX,
        })),
      });

      currentY = result.nextY - this.spacing(bottom);
      currentX = result.nextX;
      currentPageIndex = result.pageIndex;
    }

    return { currentY, currentX, pageIndex: currentPageIndex };
  }

  async writeLabel({
    currentY,
    currentX,
    currentPageIndex,
    maxWidth,
    label,
  }: Coords & {
    currentY: number;
    currentX: number;
    currentPageIndex: number;
    maxWidth: number;
    label?: LabelItem;
  }) {
    let currentMaxWidth = maxWidth;

    if (label) {
      const { top, bottom } = label.margins || {};

      if (top) {
        currentY -= this.spacing(top);
      }

      const result = await this.writeLine({
        ...label,
        maxWidth: currentMaxWidth,
        y: currentY,
        x: currentX,
        font: label.font || 'semibold',
        pageIndex: currentPageIndex,
        offset: 70,
      });

      const labelWidth = label.maxWidth || result.width;

      currentY = result.pageIndex === currentPageIndex ? currentY : result.nextY + result.height;
      currentY = label.direction === 'horizontal' ? currentY : result.nextY - this.spacing(bottom);
      currentX = label.direction === 'horizontal' ? labelWidth : currentX;
      currentMaxWidth =
        label.direction === 'horizontal' ? currentMaxWidth - labelWidth : currentMaxWidth;
      currentPageIndex = result.pageIndex;
    }

    return { currentY, currentX, pageIndex: currentPageIndex, width: currentMaxWidth };
  }

  drawSeparator({
    x: currentX = this.$paddingX,
    y: currentY,
    pageIndex,
    separator,
    width: maxWidth,
    thickness = 'sm',
    offset = 100,
  }: Coords & {
    pageIndex: number;
    width: number;
    separator?: SeparatorVariant;
    thickness?: Size;
    offset?: number;
  }) {
    if (this.isOverflowing(currentY - offset)) {
      return currentY;
    }

    if (separator === 'primary') {
      return this.drawPrimarySeparator({
        x: currentX,
        y: currentY,
        pageIndex,
        width: maxWidth,
        thickness,
      });
    }

    if (separator === 'secondary') {
      return this.drawSecondarySeparator({
        x: currentX,
        y: currentY,
        pageIndex,
        width: maxWidth,
        thickness,
      });
    }

    if (separator === 'tertiary') {
      return this.drawTertiarySeparator({
        x: currentX,
        y: currentY,
        pageIndex,
        width: maxWidth,
        thickness,
      });
    }

    return currentY;
  }

  drawPrimarySeparator({
    x: currentX = this.$paddingX,
    y: currentY,
    pageIndex,
    width: maxWidth,
    thickness = 'sm',
  }: Coords & { pageIndex: number; width: number; thickness?: Size }) {
    const page = this.$pages[pageIndex];
    currentY -= this.spacing('md');

    this.drawStreightLine({
      x: currentX,
      y: currentY,
      page,
      size: 'xl',
      color: 'secondary',
      width: 20,
    });

    currentY = this.drawStreightLine({
      x: currentX + 20,
      y: currentY,
      page,
      size: thickness,
      color: 'neutral',
      width: maxWidth - 20,
    });

    currentY -= this.spacing('md');

    return currentY;
  }

  drawSecondarySeparator({
    x: currentX = this.$paddingX,
    y: currentY,
    pageIndex,
    width: maxWidth,
    thickness = 'sm',
  }: Coords & { pageIndex: number; width: number; thickness?: Size }) {
    const page = this.$pages[pageIndex];
    currentY -= this.spacing('md');

    currentY = this.drawStreightLine({
      x: currentX,
      y: currentY,
      page,
      size: thickness,
      color: 'neutral',
      width: maxWidth,
    });

    currentY -= this.spacing('md');

    return currentY;
  }

  drawTertiarySeparator({
    x: currentX = this.$paddingX,
    y: currentY,
    pageIndex,
    width: maxWidth,
    thickness = 'sm',
  }: Coords & { pageIndex: number; width: number; thickness?: Size }) {
    const page = this.$pages[pageIndex];
    currentY -= this.spacing('md');

    this.drawStreightLine({
      x: currentX,
      y: currentY,
      page,
      size: thickness,
      color: 'neutral',
      width: maxWidth,
    });

    currentY = this.drawStreightLine({
      x: currentX + 10,
      y: currentY,
      page,
      size: 'xl',
      color: 'secondary',
      width: 20,
    });

    currentY -= this.spacing('md');

    return currentY;
  }
}
