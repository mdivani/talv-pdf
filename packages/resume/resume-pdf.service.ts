import { ResumeData } from './types';
import {
  Template,
  Group,
  Item,
  Field,
  Coords,
  Size,
  LabelItem,
  SeparatorVariant,
  Color,
} from './types';
import { ContentToPdfService } from './content-to-pdf.service';
import { Config, DEFAULT_CONFIG, RenderOptions } from './pdf.service';
import { getWidth, mapDataToTemplate, hasContent, hasText, templateFamilies } from './utils';
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

/** Where a timeline marker goes: on the rule, level with the middle of the entry's first line. */
type Marker = Position & { x: number };

type FieldResult = { currentY: number; currentX: number; pageIndex: number; marker?: Marker };

type EntriesPosition = Coords & { pageIndex: number; maxWidth: number; space: number };

/**
 * The entries of one list that start at `index`: a list field becomes one field per entry, all
 * sharing the template field's options.
 */
function entriesOf(fields: Field<Item>[], index: number) {
  const first = fields[index];
  let end = index + 1;
  while (
    end < fields.length &&
    fields[end].name === first.name &&
    fields[end].source === first.source &&
    fields[end].aside === first.aside &&
    fields[end].columns === first.columns
  ) {
    end++;
  }
  return fields.slice(index, end);
}

/** True when `a` is further down the document than `b`: on a later page, or lower on the same page. */
const isFurther = (a: Position, b: Position) =>
  a.pageIndex > b.pageIndex || (a.pageIndex === b.pageIndex && a.y < b.y);

type GenerateParams = {
  data: ResumeData;
  template: Template;
  options?: RenderOptions;
  /**
   * Order of the template's sections, by `section` name, such as `['education', 'experience']`.
   * Unknown names are ignored; sections left out follow in the template's default order.
   */
  sectionOrder?: string[];
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
    fonts,
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
      fonts,
    });

    // Download custom fonts now so the first render doesn't wait for them. Only the bytes are
    // cached: each render embeds them into its own document. Without custom fonts, nothing is fetched.
    await Promise.all(Object.values(this.$baseFonts).map((font) => this.loadFonts(font)));

    this.$ready = true;
  }

  get isInitialised() {
    return this.$ready;
  }

  /**
   * Renders one resume into a brand-new document and returns its bytes. Calls on the same
   * instance run one at a time, so a render never sees another render's pages or settings.
   */
  generate({ data, template, options = {}, sectionOrder }: GenerateParams): Promise<Uint8Array> {
    const render = this.$queue.then(async () => {
      await this.update(options, templateFamilies(template));
      this.$family = template.family ?? 'body';

      // With the standard fonts, characters they can't encode are replaced before layout, so text is
      // measured and drawn the same way. Template strings (labels, separators) go through it too.
      const encodable = (text: string) => this.encodable(text);
      const fields = mapDataToTemplate(
        mapStrings(data, encodable),
        mapStrings(template, encodable),
        sectionOrder,
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

  /** Room a box needs at its top to start on this page: its padding and two lines of text. */
  protected boxStartHeight(paddingY: number) {
    return 2 * paddingY + 2 * this.lineHeight(this.fontSize('md'));
  }

  /**
   * Height of one entry of a list drawn at `width`, padding included. Text items are measured; rich
   * text counts as two lines. Used to keep small boxes (a row of achievements, a skill group) whole.
   */
  protected entryHeight(field: Field<Item>, width: number) {
    const pad = this.padding(field.padding);
    const space = this.spacing(field.gap);
    const inner = width - 2 * pad.x;
    let height = 2 * pad.y;
    let count = 0;

    for (const item of field.items ?? []) {
      if (!hasText(item)) continue;
      height += this.spacing(item.margins?.top) + this.spacing(item.margins?.bottom);
      if (item.type === 'text') {
        const { text, fontSize, font = 'regular', family, leading, icon, bullet } = item.item;
        const lines = this.getTextLines({
          text,
          size: fontSize,
          font: this.getFont(font, family),
          leading: leading || this.$leading,
          maxWidth:
            Math.min(item.item.maxWidth || inner, inner) -
            this.prefixWidth({ text, icon, bullet, fontSize }),
        });
        height += lines.length * this.lineHeight(this.fontSize(fontSize), leading);
      } else {
        height += 2 * this.lineHeight(this.fontSize('md'));
      }
      count++;
    }

    return height + Math.max(count - 1, 0) * space;
  }

  /** True when a box this tall fits on a page but not in the room left below `y`. */
  protected needsNewPage(y: number, height: number) {
    return this.isOverflowing(y - height) && height <= this.pageTop - this.$safeArea;
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

    const { gap, direction, label, width, fields, groups, separator, background, padding } = group;
    const space = this.spacing(gap);

    const outerWidth = getWidth(width, containerWidth);
    let maxWidth = outerWidth;

    const filled = hasContent(group);
    const pad = filled ? this.padding(padding) : { x: 0, y: 0 };

    // A box starts with its content: without room for its first lines here, it starts on the next
    // page instead of leaving an empty sliver behind.
    if (
      filled &&
      background &&
      !background.fullHeight &&
      this.isOverflowing(currentY - this.boxStartHeight(pad.y))
    ) {
      currentPageIndex = await this.nextPage(currentPageIndex);
      currentY = this.pageTop;
    }

    const top: Position = { y: currentY, pageIndex: currentPageIndex };
    const mark = this.backgroundMark();
    currentY -= pad.y;
    currentX += pad.x;
    maxWidth -= 2 * pad.x;

    // Where a label in a column of its own ends, when it is longer than the content beside it.
    let labelBottom: Position | undefined;
    // The gap left below the last thing drawn, which a box's padding replaces.
    let trailing = 0;

    if (filled) {
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
      labelBottom = labelResult.bottom;
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
        // Side by side, the next column starts after this one. Stacked, every sub-group starts at
        // the same x, whatever a label column did inside the one before.
        if (horizontal) currentX = result.width + space;
      }

      if (end.y !== start.y || end.pageIndex !== start.pageIndex) trailing = space;
      currentY = end.y;
      currentPageIndex = end.pageIndex;
    }

    if (fields) {
      for (let index = 0; index < fields.length; ) {
        const field = fields[index];
        const run = entriesOf(fields, index);
        const at = { x: currentX, y: currentY, pageIndex: currentPageIndex, maxWidth, space };

        const result =
          field.columns && field.columns > 1
            ? await this.writeColumns(run, at)
            : field.aside?.rule
              ? await this.writeTimeline(run, at)
              : await this.writeEntries([field], at);

        currentY = result.currentY;
        currentPageIndex = result.pageIndex;
        index += (field.columns ?? 1) > 1 || field.aside?.rule ? run.length : 1;
        trailing = space;
      }
    }

    if (
      labelBottom &&
      isFurther(
        { ...labelBottom, y: labelBottom.y - space },
        { y: currentY, pageIndex: currentPageIndex },
      )
    ) {
      currentY = labelBottom.y - space;
      currentPageIndex = labelBottom.pageIndex;
      trailing = space;
    }

    if (pad.x || pad.y || (filled && background)) {
      // The box ends its padding below the content, and the group's gap follows the box.
      const bottom = currentY + trailing - pad.y - this.descent('md');
      if (filled && background) {
        this.addBackgroundSpan({
          from: top.pageIndex,
          to: currentPageIndex,
          top: top.y,
          bottom,
          x,
          width: outerWidth,
          background,
          at: mark,
        });
      }
      currentY = bottom - trailing;
    }

    return {
      currentY,
      currentX: currentX - pad.x,
      width: x + maxWidth + 2 * pad.x,
      pageIndex: currentPageIndex,
    };
  }

  /** Writes entries one below the other. Returns the position after the last one and its gap. */
  protected async writeEntries(
    entries: Field<Item>[],
    { x, y, pageIndex, maxWidth, space }: EntriesPosition,
  ) {
    let currentY = y;
    let currentPageIndex = pageIndex;
    const tops: Array<FieldResult> = [];

    for (const entry of entries) {
      const result = await this.writeField(
        { ...entry, maxWidth },
        { y: currentY, x, pageIndex: currentPageIndex },
      );
      tops.push(result);

      currentY = result.currentY - space;
      currentPageIndex = result.pageIndex;
    }

    return { currentY, pageIndex: currentPageIndex, results: tops };
  }

  /**
   * Writes the entries of a list side by side, `columns` to a row. The boxes in a row are all as
   * tall as the tallest.
   */
  protected async writeColumns(entries: Field<Item>[], at: EntriesPosition) {
    const { x, maxWidth, space } = at;
    const columns = entries[0].columns ?? 1;
    const filled = entries.filter((entry) => hasContent({ fields: [entry] }));
    const columnWidth = (maxWidth - (columns - 1) * space) / columns;

    let currentY = at.y;
    let currentPageIndex = at.pageIndex;

    for (let first = 0; first < filled.length; first += columns) {
      const row = filled.slice(first, first + columns);
      const rowHeight = Math.max(...row.map((entry) => this.entryHeight(entry, columnWidth)));

      if (this.needsNewPage(currentY, rowHeight)) {
        currentPageIndex = await this.nextPage(currentPageIndex);
        currentY = this.pageTop;
      }

      const top = { y: currentY, pageIndex: currentPageIndex };
      const mark = this.backgroundMark();
      let end = { ...top };
      for (const [column, entry] of row.entries()) {
        const result = await this.writeField(
          { ...entry, maxWidth: columnWidth },
          { x: x + column * (columnWidth + space), ...top },
          { drawBackground: false },
        );
        const reached = { y: result.currentY, pageIndex: result.pageIndex };
        if (isFurther(reached, end)) end = reached;
      }

      for (const [column, entry] of row.entries()) {
        if (!entry.background) continue;
        this.addBackgroundSpan({
          from: top.pageIndex,
          to: end.pageIndex,
          top: top.y,
          bottom: end.y,
          x: x + column * (columnWidth + space),
          width: columnWidth,
          background: entry.background,
          at: mark,
        });
      }

      currentY = end.y - space;
      currentPageIndex = end.pageIndex;
    }

    return { currentY, pageIndex: currentPageIndex };
  }

  /**
   * Writes entries with a vertical rule between their left column and their content, and a marker
   * where each entry starts. The rule runs from the first marker to the end of the last entry.
   */
  protected async writeTimeline(entries: Field<Item>[], at: EntriesPosition) {
    const result = await this.writeEntries(entries, at);
    const drawn = result.results.filter((entry) => entry.marker);
    const rule = entries[0].aside?.rule ?? {};

    for (const [index, entry] of drawn.entries()) {
      const marker = entry.marker as Marker;
      const next = drawn[index + 1]?.marker;
      this.drawVerticalRule({
        x: marker.x,
        from: { y: marker.y, pageIndex: marker.pageIndex },
        to: next
          ? { y: next.y, pageIndex: next.pageIndex }
          : { y: entry.currentY, pageIndex: entry.pageIndex },
        color: rule.color ?? 'neutral',
      });
    }

    // Markers go on top of the rule.
    for (const entry of drawn) {
      const marker = entry.marker as Marker;
      this.$pages[marker.pageIndex].drawCircle({
        x: marker.x,
        y: marker.y,
        size: 3,
        color: this.color(rule.marker ?? 'secondary'),
      });
    }

    return result;
  }

  /** A vertical line at `x` from one point down to another, across pages. */
  protected drawVerticalRule({
    x,
    from,
    to,
    color,
  }: {
    x: number;
    from: Position;
    to: Position;
    color: Color;
  }) {
    for (let pageIndex = from.pageIndex; pageIndex <= to.pageIndex; pageIndex++) {
      const top = pageIndex === from.pageIndex ? from.y : this.pageTop;
      const bottom = pageIndex === to.pageIndex ? to.y : this.$safeArea;
      if (top <= bottom) continue;
      this.$pages[pageIndex].drawLine({
        start: { x, y: top },
        end: { x, y: bottom },
        thickness: 1,
        color: this.color(color),
      });
    }
  }

  async writeField(
    field: Field<Item>,
    { y, x, pageIndex }: { y: number; x: number; pageIndex: number },
    { drawBackground = true }: { drawBackground?: boolean } = {},
  ): Promise<FieldResult> {
    const {
      items,
      gap,
      maxWidth = this.$maxWidth,
      label,
      separator,
      aside,
      background,
      padding,
    } = field;

    let currentY = y;
    let currentX = x;
    let currentMaxWidth = maxWidth;
    let currentPageIndex = pageIndex;

    const space = this.spacing(gap);
    const filled = hasContent({ fields: [field] });
    const boxed = filled && Boolean(background || padding);
    const pad = boxed ? this.padding(padding) : { x: 0, y: 0 };

    if (
      boxed &&
      drawBackground &&
      background &&
      (this.needsNewPage(currentY, this.entryHeight(field, maxWidth)) ||
        this.isOverflowing(currentY - this.boxStartHeight(pad.y)))
    ) {
      currentPageIndex = await this.nextPage(currentPageIndex);
      currentY = this.pageTop;
    }

    const top: Position = { y: currentY, pageIndex: currentPageIndex };
    const mark = this.backgroundMark();
    currentY -= pad.y;
    currentX += pad.x;
    currentMaxWidth -= 2 * pad.x;

    if (filled) {
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

    let marker: Marker | undefined;
    let wroteItems = false;

    if (items?.length) {
      // With an aside, one item goes in a column on the left and the rest beside it.
      const asideItem =
        aside && filled
          ? items.find((item) => item.type === 'text' && item.name === aside.name && hasText(item))
          : undefined;
      let itemX = currentX;
      let itemWidth = currentMaxWidth;
      let asideEnd: Position | undefined;

      if (aside && filled) {
        const columnGap = this.spacing(aside.gap ?? 'md');
        const gutter = aside.rule ? 2 * columnGap : columnGap;
        itemX = currentX + aside.width + gutter;
        itemWidth = currentMaxWidth - aside.width - gutter;

        // Both columns start together, so the entry moves to the next page as a whole when its
        // first lines don't fit here.
        const first = items.find((item) => item !== asideItem && hasText(item));
        const firstLine = this.lineHeight(
          this.fontSize(first?.type === 'text' ? first.item.fontSize : 'md'),
        );
        const need = first ? firstLine + this.entryHeadHeight(first, itemWidth) : firstLine;
        if (this.isOverflowing(currentY - need)) {
          currentPageIndex = await this.nextPage(currentPageIndex);
          currentY = this.pageTop;
        }

        if (aside.rule) {
          marker = {
            x: currentX + aside.width + columnGap,
            y: currentY - firstLine / 2,
            pageIndex: currentPageIndex,
          };
        }

        if (asideItem) {
          const result = await this.writeItem(asideItem, {
            y: currentY,
            x: currentX,
            pageIndex: currentPageIndex,
            maxWidth: aside.width,
          });
          asideEnd = { y: result.currentY - space, pageIndex: result.pageIndex };
        }
      }

      // An entry (one object of a list, such as a job) keeps its heading with the start of its
      // content: its first line only goes on this page if the rest of it and a little of what
      // follows fit too.
      const rest = asideItem ? items.filter((item) => item !== asideItem) : items;
      const head = field.source === 'objects' && rest.length > 1 ? rest.findIndex(hasText) : -1;

      for (const [index, item] of rest.entries()) {
        // A missing optional value (no description, say) takes no space: no margins, no gap.
        if (!hasText(item)) continue;

        const { top: marginTop, bottom } = item.margins || {};

        if (marginTop) {
          currentY -= this.spacing(marginTop);
        }

        const result = await this.writeItem(item, {
          y: currentY,
          x: itemX,
          pageIndex: currentPageIndex,
          maxWidth: itemWidth,
          keepWithNext: index === head ? this.entryHeadHeight(item, itemWidth) : 0,
        });

        currentY = result.currentY - this.spacing(bottom) - space;
        itemX = result.currentX;
        currentPageIndex = result.pageIndex;
        wroteItems = true;
      }

      if (asideEnd && isFurther(asideEnd, { y: currentY, pageIndex: currentPageIndex })) {
        currentY = asideEnd.y;
        currentPageIndex = asideEnd.pageIndex;
        wroteItems = true;
      }
    }

    if (boxed) {
      // The box's padding takes the place of the gap after the last item.
      const bottom = currentY + (wroteItems ? space : 0) - pad.y - this.descent('md');
      if (background && drawBackground) {
        this.addBackgroundSpan({
          from: top.pageIndex,
          to: currentPageIndex,
          top: top.y,
          bottom,
          x,
          width: maxWidth,
          background,
          at: mark,
        });
      }
      currentY = bottom;
    }

    return { currentY, currentX: x, pageIndex: currentPageIndex, marker };
  }

  /**
   * Room an entry's heading needs below its first line: the heading's remaining lines plus two lines
   * of the entry's content.
   */
  entryHeadHeight(item: Item, maxWidth: number) {
    const content = 2 * this.lineHeight(this.fontSize('md'));
    if (item.type !== 'text') return content;

    const { text, fontSize, font = 'regular', family, leading, icon } = item.item;
    const lines = this.getTextLines({
      text,
      size: fontSize,
      font: this.getFont(font, family),
      leading: leading || this.$leading,
      maxWidth:
        Math.min(item.item.maxWidth || maxWidth, maxWidth) -
        this.prefixWidth({ text, icon, fontSize }),
    });
    return (lines.length - 1) * this.lineHeight(this.fontSize(fontSize), leading) + content;
  }

  async writeItem(
    item: Item,
    {
      y,
      x,
      pageIndex,
      maxWidth,
      keepWithNext = 0,
    }: Coords & { pageIndex: number; maxWidth: number; keepWithNext?: number },
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
        // A template's maxWidth can narrow a text item, never widen it past its column.
        maxWidth: Math.min(item.item.maxWidth || maxWidth, maxWidth),
        font: item.item.font || 'regular',
        offset: Math.max(item.item.offset ?? 0, keepWithNext),
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
        color: item.item?.color ?? 'primary',
        fontSize: item.item?.fontSize ?? 'md',
        ...(item.item?.family ? { family: item.item.family } : {}),
        ...(item.item?.leading ? { leading: item.item.leading } : {}),
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
        texts: item.item.texts.map((text, index) => ({
          ...text,
          offset: index === 0 ? Math.max(text.offset ?? 0, keepWithNext) : text.offset,
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
  }): Promise<{
    currentY: number;
    currentX: number;
    pageIndex: number;
    width: number;
    bottom?: Position;
  }> {
    let currentMaxWidth = maxWidth;

    if (label && (label.column || label.background || label.padding)) {
      return this.writeLabelBlock({ currentY, currentX, currentPageIndex, maxWidth, label });
    }

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

      // A horizontal label's value starts at `label.maxWidth` from the page edge, the column the
      // template lines values up on, or right after the label if the label is wider than that.
      const valueX = Math.max(label.maxWidth || 0, currentX + result.width + this.spacing('sm'));

      currentY = result.pageIndex === currentPageIndex ? currentY : result.nextY + result.height;
      currentY = label.direction === 'horizontal' ? currentY : result.nextY - this.spacing(bottom);
      currentMaxWidth =
        label.direction === 'horizontal' ? currentMaxWidth - valueX : currentMaxWidth;
      currentX = label.direction === 'horizontal' ? valueX : currentX;
      currentPageIndex = result.pageIndex;
    }

    return { currentY, currentX, pageIndex: currentPageIndex, width: currentMaxWidth };
  }

  /**
   * A label with a background bar, padding, or a column of its own. In a column, the content starts
   * level with the label's top, beside it, and `bottom` says where the label ends.
   */
  protected async writeLabelBlock({
    currentY,
    currentX,
    currentPageIndex,
    maxWidth,
    label,
  }: {
    currentY: number;
    currentX: number;
    currentPageIndex: number;
    maxWidth: number;
    label: LabelItem;
  }) {
    const { top, bottom } = label.margins || {};
    const pad = this.padding(label.padding);
    const columnGap = label.column ? this.spacing('md') : 0;
    const width = label.column ? Math.min(label.column, maxWidth) : maxWidth;

    const result = await this.writeMultiLine({
      ...label,
      maxWidth: Math.max(width - columnGap - 2 * pad.x, 1),
      y: currentY - this.spacing(top) - pad.y,
      x: currentX + pad.x,
      font: label.font || 'semibold',
      pageIndex: currentPageIndex,
      offset: 70,
    });

    // Measured on the page the label ended up on.
    const boxTop = result.nextY + result.height + pad.y;
    const boxBottom = result.nextY - pad.y - this.descent(label.fontSize);

    if (label.background) {
      this.addBackgroundSpan({
        from: result.pageIndex,
        to: result.pageIndex,
        top: boxTop,
        bottom: boxBottom,
        x: currentX,
        width: width - columnGap,
        background: label.background,
      });
    }

    const after = boxBottom - this.spacing(bottom);

    if (label.column) {
      return {
        currentY: boxTop,
        currentX: currentX + width,
        pageIndex: result.pageIndex,
        width: maxWidth - width,
        bottom: { y: after, pageIndex: result.pageIndex },
      };
    }

    return { currentY: after, currentX, pageIndex: result.pageIndex, width: maxWidth };
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
