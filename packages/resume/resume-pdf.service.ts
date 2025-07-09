import { ResumeData } from './types';
import { Template, Group, Item, Field, Coords, Size, LabelItem, SeparatorVariant } from './types';
import { ContentToPdfService } from './content-to-pdf.service';
import { Config, DEFAULT_CONFIG } from './pdf.service';
import { getWidth, mapDataToTemplate, hasContent, hasText } from './utils';
import { defaultFontMap } from './assets';
export { formatTextWithAffixes, getWidth, mapDataToTemplate } from './utils';

type CreateParams = Partial<Config>;

type GenerateParams = {
  data: ResumeData;
  template: Template;
  options?: CreateParams;
};

export class ResumePDFService extends ContentToPdfService {
  private $ready = false;

  constructor() {
    super();
  }

  async create({
    screen = DEFAULT_CONFIG.screen,
    fontSize = DEFAULT_CONFIG.fontSize,
    leading = DEFAULT_CONFIG.leading,
    color = DEFAULT_CONFIG.color,
    isPreview = DEFAULT_CONFIG.isPreview,
    watermark,
  }: CreateParams = DEFAULT_CONFIG) {
    await super.init({ screen, fontSize, leading, color, isPreview, watermark });

    this.$fonts = await super.embedFonts(defaultFontMap);

    this.$ready = true;
  }

  get isInitialised() {
    return this.$ready;
  }

  async generate({ data, template, options = {} }: GenerateParams) {
    await this.update(options);

    const fields = mapDataToTemplate(data, template);

    await this.writeToPDF(fields.groups);

    return this.save();
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
    { y, x, containerWidth = this.$maxWidth, pageIndex }: Coords & { containerWidth?: number; pageIndex: number },
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
      const horizontalY = currentY;

      for (const subGroup of groups) {
        const result = await this.writeGroup(subGroup, {
          y: direction === 'horizontal' ? horizontalY : currentY,
          x: currentX,
          containerWidth: maxWidth - (direction === 'horizontal' ? space : 0),
          pageIndex: direction === 'horizontal' ? pageIndex : currentPageIndex,
        });

        currentY = currentY > result.currentY ? result.currentY - space : currentY;
        currentX = direction === 'horizontal' ? result.width + space : result.currentX;
        currentPageIndex = result.pageIndex;
      }
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

  async writeField(field: Field<Item>, { y, x, pageIndex }: { y: number; x: number; pageIndex: number }) {
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

  async writeItem(item: Item, { y, x, pageIndex, maxWidth }: Coords & { pageIndex: number; maxWidth: number }) {
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
      currentMaxWidth = label.direction === 'horizontal' ? currentMaxWidth - labelWidth : currentMaxWidth;
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
