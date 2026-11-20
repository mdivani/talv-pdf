/* eslint-disable @typescript-eslint/no-explicit-any */
import { RGB, ColorTypes } from 'pdf-lib';
import {
  Size,
  JustifyLineParams,
  AlignLineParams,
  FontType,
  Template,
  PDFData,
  Width,
  Field,
  ItemStyle,
  Group,
  Item,
  RowItem,
  RowParamStyles,
  RowParams,
  LineParamStyles,
  JoinField,
  IconTypes,
  ResumeData,
  Condition,
  FontFamily,
  TemplateItem,
} from './types';
import { fontSizeMap, fontScaleMap, leadingMap, mapSeparator, SpacingMap, svg } from './constants';

export const getFontSize = (fontSize: Size, fontScale: Size = 'md') => {
  return fontSizeMap[fontSize] * fontScaleMap[fontScale];
};

export const getLineHeight = (fontSize: number, leading: Size = 'md') => {
  return fontSize * leadingMap[leading];
};

export const getSeparatorSize = (size: Size) => {
  return mapSeparator[size];
};

export const getSpacing = (size: Size, fontScale: Size = 'md') => {
  return SpacingMap[size] * fontScaleMap[fontScale];
};

export const getWidth = (width: Width, pageWidth: number) => {
  switch (width) {
    case 'full':
      return pageWidth;
    case '1/2':
      return pageWidth / 2;
    case '1/3':
      return pageWidth / 3;
    case '2/3':
      return (pageWidth / 3) * 2;
    case '2/5':
      return (pageWidth / 5) * 2;
    case '3/5':
      return (pageWidth / 5) * 3;
    default:
      return pageWidth;
  }
};

export function justifyLine({ justify, textWidth, containerWidth }: JustifyLineParams): number {
  if (justify === 'right') {
    return containerWidth - textWidth;
  }

  if (justify === 'center') {
    return (containerWidth - textWidth) / 2;
  }

  return 0;
}

export function alignLine({ align, textHeight, containerHeight }: AlignLineParams): number {
  if (align === 'bottom') {
    return containerHeight - textHeight;
  }

  if (align === 'middle') {
    return (containerHeight + textHeight) / 2;
  }

  return 0;
}

export function formatTextWithAffixes({
  append = '',
  prepend = '',
  value,
}: {
  append?: string;
  prepend?: string;
  value: string;
}) {
  return `${prepend}${value}${append}`;
}

// Content Utils
export function parseMarksForFonts(marks: Array<{ type?: string }>): FontType {
  const isBold = marks.some(({ type }) => type === 'bold');
  const isItalic = marks.some(({ type }) => type === 'italic');

  if (isBold && isItalic) {
    return 'bold-italic';
  }

  if (isBold) return 'bold';

  if (isItalic) return 'italic';

  return 'regular';
}

// Parse Data
export function mapDataToTemplate(
  data: ResumeData,
  template: Template,
  sectionOrder?: string[],
): PDFData {
  const groups =
    template.groups && orderSections(template.groups, sectionOrder, template.defaultSectionOrder);

  return {
    groups: groups && mapTemplateGroups(groups, data),
  };
}

/**
 * Puts the named groups (sections) of each list of groups in order: first the names in `order`,
 * then the rest as in `defaults`, then any others as they were. Unnamed groups keep their place, and
 * a section only moves among the groups next to it, so it never changes column.
 */
export function orderSections<T extends TemplateItem>(
  groups: Group<T>[],
  order?: string[],
  defaults?: string[],
): Group<T>[] {
  if (!order?.length && !defaults?.length) return groups;

  const rank = (section: string, index: number) => {
    const chosen = order?.indexOf(section) ?? -1;
    if (chosen >= 0) return chosen;
    const fallback = defaults?.indexOf(section) ?? -1;
    if (fallback >= 0) return 1000 + fallback;
    return 2000 + index;
  };
  const sections = groups
    .map((group, index) => ({ group, index }))
    .filter(({ group }) => group.section)
    .sort((a, b) => rank(a.group.section ?? '', a.index) - rank(b.group.section ?? '', b.index));

  let next = 0;
  return groups.map((group) => {
    const placed = group.section ? sections[next++].group : group;
    return placed.groups
      ? { ...placed, groups: orderSections(placed.groups, order, defaults) }
      : placed;
  });
}

/** True for a value worth drawing: a non-empty string or array, or any other value. */
const isFilled = (value: unknown) =>
  Array.isArray(value) ? value.length > 0 : value !== undefined && value !== null && value !== '';

/** Whether a group or field's `when` and `unless` let it be drawn with this data. */
function isShown({ when, unless }: Condition, data: Record<string, any>) {
  if (when && !isFilled(data[when])) return false;
  if (unless && isFilled(data[unless])) return false;
  return true;
}

/** The typeface roles a template draws with. */
export function templateFamilies(template: Template): FontFamily[] {
  const families = new Set<FontFamily>([template.family ?? 'body']);
  const walk = (value: unknown) => {
    if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === 'object') {
      for (const [key, item] of Object.entries(value)) {
        if (key === 'family' && typeof item === 'string') families.add(item as FontFamily);
        else walk(item);
      }
    }
  };
  walk(template.groups);
  return [...families];
}

function mapTemplateGroups(
  groups: Group<ItemStyle>[],
  data: Record<string, string | any>,
): Group<Item>[] {
  return groups
    .filter((group) => isShown(group, data))
    .map(({ fields, groups, ...group }) => ({
      ...group,
      groups: groups && mapTemplateGroups(groups, data),
      fields: fields && mapTemplateFields(fields, data),
    }));
}

function mapFieldItems(field: Field<ItemStyle>, data: Record<string, string | any>): Field<Item>[] {
  const { items, join, source, name } = field;

  const dataField = data[name];

  let joinedItem: Item | null = null;

  if (join) {
    joinedItem = mapJoinItems(join, dataField);

    return [
      {
        ...field,
        items: [joinedItem],
      },
    ];
  }

  if (Array.isArray(dataField) && source === 'objects') {
    const subFields = dataField.map((dataItem) => {
      return { ...field, items: mapTextItems(items, dataItem) };
    });

    return subFields;
  }

  if (Array.isArray(dataField) && field.source === 'strings') {
    return [
      {
        ...field,
        items: dataField.reduce((acc, data) => [...acc, ...mapTextItems(items, data)], []),
      },
    ];
  }

  return [{ ...field, items: mapTextItems(items, data) }];
}

function mapTemplateFields(
  fields: Field<ItemStyle>[],
  data: Record<string, string | any>,
): Field<Item>[] {
  return fields.reduce<Field<Item>[]>((acc, field) => {
    if (!isShown(field, data)) return acc;
    const dataField = mapFieldItems(field, data);

    return [...acc, ...dataField];
  }, []);
}

function convertItem<T extends Record<string, string | any> | string>(
  item: ItemStyle,
  data: T,
): Item {
  if (typeof data === 'string' && item.type === 'text') {
    return {
      ...item,
      item: {
        ...item.item,
        text: data,
      },
    } as Item;
  }

  if (typeof data === 'string') throw new Error(`Data is a string, ${item.type}, data: ${data}`);

  switch (item.type) {
    case 'text':
      return {
        ...item,
        item: {
          ...item.item,
          text: data[item.name],
          icon: data?.icon || item.item.icon,
        },
      };
    case 'row':
      return mapRowItems(item, data);
    case 'content':
      return {
        ...item,
        content: data[item.name],
      };
    case 'list': {
      const { name, margins, output, separator = ', ', justify, gap, chip, item: style } = item;
      const values = Array.isArray(data[name]) ? data[name].filter(Boolean) : [];
      const list = joinDataItems(
        { type: 'join', output, separator, width: 0, justify, gap, chip, item: style },
        values,
      );
      return margins ? { ...list, margins } : list;
    }
    default:
      return item as Item;
  }
}

function mapJoinItems<T extends Record<string, string | any> | string>(
  item: JoinField<LineParamStyles>,
  data: T[] = [],
) {
  let joinedItems: string[] = [];

  data.forEach((dataItem) => {
    if (typeof dataItem === 'string') {
      joinedItems.push(dataItem);
    } else if (item.keys) {
      const keyItems = item.keys.reduce<string[]>(
        (acc, key) => (dataItem[key] ? [...acc, dataItem[key]] : acc),
        [],
      );
      joinedItems = [...joinedItems, ...keyItems];
    }
  });

  return joinDataItems(item, joinedItems);
}

function mapTextItems(items: ItemStyle[], data: Record<string, string | any>) {
  return items.map<Item>((item) => convertItem(item, data));
}

function mapRowItems(
  item: RowItem<RowParamStyles>,
  data: Record<string, string | any>,
): RowItem<RowParams> {
  return {
    ...item,
    item: {
      ...item.item,
      texts: item.keys.map((key) => {
        return {
          ...item.item.texts[key],
          text: data[key],
        };
      }),
    },
  };
}

function joinDataItems(join: JoinField<LineParamStyles>, data: string[]) {
  const { separator, output, item, width, justify = 'start', gap, chip } = join;

  if (output === 'row') {
    const row = data.reduce((acc, dataItem, index) => ({ ...acc, [index]: dataItem }), {});
    const keys = Object.keys(row);
    const rowItem = mapRowItems(
      {
        type: 'row',
        keys,
        item: {
          justify,
          containerWidth: width,
          gap,
          ...(chip ? { chip } : {}),
          texts: keys.reduce((acc, key) => ({ ...acc, [key]: item }), {}),
        },
      },
      row,
    );

    return rowItem;
  }

  const text = data.join(separator);

  return convertItem({ type: 'text', name: 'joined', item }, text);
}

export function hasContent(group: Omit<Group<Item>, 'width'>): boolean {
  const { fields, groups } = group;

  if (fields) {
    return fields.some(({ items }) => items?.length && items.some((item) => hasText(item)));
  }

  if (groups) {
    return groups.some((group) => hasContent(group));
  }

  return false;
}

export function hasText(item: Item) {
  switch (item.type) {
    case 'content':
      return !!item.content?.content?.length;
    case 'row':
      return item.item.texts.some((txt) => !!txt.text);
    case 'text':
      return !!item.item.text;
    default:
      return false;
  }
}

export function getIconPath(icon: IconTypes) {
  return svg[icon] || svg.link;
}

export function getLinkIconType(url: string): IconTypes {
  // Create a URL object
  const parsedUrl = new URL(url.startsWith('http') ? url : `https://${url}`);

  // Get the hostname, which includes subdomains (e.g., www.domain.com)
  const hostname = parsedUrl.hostname;

  // Extract the main domain name (e.g., domain.com)
  // Split by '.' and filter to get the last two parts for domain
  const domainParts = hostname.split('.').filter((part) => part.length > 0);
  const domainName = domainParts.slice(domainParts.length - 2, domainParts.length - 1).join('.');

  return Object.keys(svg).includes(domainName) ? (domainName as IconTypes) : 'link';
}

/** Relative luminance of a colour, as defined by WCAG 2. */
export function luminance({ red, green, blue }: RGB) {
  const channel = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue);
}

/** WCAG 2 contrast ratio between two colours, from 1 to 21. Body text needs 4.5. */
export function contrastRatio(a: RGB, b: RGB) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/** `amount` of colour `a` mixed into colour `b`. */
export function mixColors(a: RGB, b: RGB, amount: number): RGB {
  const mix = (x: number, y: number) => x * amount + y * (1 - amount);
  return {
    type: ColorTypes.RGB,
    red: mix(a.red, b.red),
    green: mix(a.green, b.green),
    blue: mix(a.blue, b.blue),
  };
}

export function fromHexStr(hex: string): RGB {
  const [r, g, b] = hex.match(/\w\w/g)?.map((c) => parseInt(c, 16) / 255) || [0, 0, 0];
  return { red: r, green: g, blue: b, type: ColorTypes.RGB };
}

export const capitalise = (txt?: string) => {
  if (!txt) return '';

  return txt
    .split(new RegExp(/[\s-]+/))
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ');
};

export const formatUrl = (url: string) => {
  return url.replace('http://', '').replace('https://', '').replace('www.', '');
};

export const formatDate = (date: string | Date, withMonth = true) => {
  if (!date) return 'Present';

  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) return 'Present';
    return dateObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: withMonth ? 'short' : undefined,
    });
  } catch {
    return 'Present';
  }
};
