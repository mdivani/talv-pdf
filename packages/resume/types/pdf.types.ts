import { PDFFont, PDFPage } from 'pdf-lib';
import { Align, Justify, Size, Colors, IconTypes } from './config.types';
import { LineParamStyles, RowBaseParam } from './resume.types';

// Params
export type Coords = { x: number; y: number };

export interface TextWidthParams {
  size: Size;
  leading: Size;
  font: PDFFont;
  text: string;
}

export interface TextLinesParams extends TextWidthParams {
  maxWidth: number;
  wordBreaks?: string[];
}

export interface WordWrapHeightParams extends TextWidthParams {
  maxWidth: number;
}

export interface JustifyLineParams {
  justify: Justify;
  textWidth: number;
  containerWidth: number;
}

export interface JustifyTextParams extends Omit<JustifyLineParams, 'textWidth'>, TextLinesParams {
  text: string;
}

export interface AlignLineParams {
  align: Align;
  textHeight: number;
  containerHeight: number;
}

export interface WriteTextParams extends TextLinesParams, Coords {
  color: Colors;
  lineHeight: number;
  page: PDFPage;
}

export interface WriteLineParams extends LineParamStyles, Coords {
  text: string;
  pageIndex: number;
}

export interface WriteRowParams extends RowBaseParam, Coords {
  texts: WriteLineParams[];
  pageIndex: number;
}

export interface DrawCircleParams extends Coords {
  color: Colors;
  page: PDFPage;
  size: Size;
}

export interface DrawIconParams extends Coords {
  color: Colors;
  icon: IconTypes;
  page: PDFPage;
  size: Size;
}

export interface DrawLineParams extends Coords {
  color: Colors;
  page: PDFPage;
  size: Size;
  width: number;
}

export interface WriteLineResponse {
  height: number;
  width: number;
  nextY: number;
  nextX: number;
  pageIndex: number;
}
