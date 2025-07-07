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
    return (containerWidth + textWidth) / 2;
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
export function mapDataToTemplate(data: ResumeData, template: Template): PDFData {
  const { groups } = template;

  return {
    groups: groups && mapTemplateGroups(groups, data),
  };
}

function mapTemplateGroups(groups: Group<ItemStyle>[], data: Record<string, string | any>): Group<Item>[] {
  return groups.map(({ fields, groups, ...group }) => ({
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

function mapTemplateFields(fields: Field<ItemStyle>[], data: Record<string, string | any>): Field<Item>[] {
  return fields.reduce<Field<Item>[]>((acc, field) => {
    const dataField = mapFieldItems(field, data);

    return [...acc, ...dataField];
  }, []);
}

function convertItem<T extends Record<string, string | any> | string>(item: ItemStyle, data: T): Item {
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
    default:
      return item;
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
      const keyItems = item.keys.reduce<string[]>((acc, key) => (dataItem[key] ? [...acc, dataItem[key]] : acc), []);
      joinedItems = [...joinedItems, ...keyItems];
    }
  });

  return joinDataItems(item, joinedItems);
}

function mapTextItems(items: ItemStyle[], data: Record<string, string | any>) {
  return items.map<Item>((item) => convertItem(item, data));
}

function mapRowItems(item: RowItem<RowParamStyles>, data: Record<string, string | any>): RowItem<RowParams> {
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
  const { separator, output, item, width, justify = 'start', gap } = join;

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
