import type { FontFiles } from '@resume/pdf.service';
import type { CustomFont } from '@resume/types';
import { interFont } from '@resume/assets';

/**
 * Open-licence (SIL OFL) fonts, downloaded for trying templates with real typefaces. The package
 * ships no fonts: without these, templates use Helvetica, Times and Courier.
 *
 * Source Serif 4 and IBM Plex Mono come from their makers' releases, pinned, through jsDelivr. The
 * Google Fonts builds of both don't load: `@pdf-lib/fontkit` fails on their italic (Source Serif)
 * and on every file (Plex Mono) with "Trying to access beyond buffer length".
 */
const adobe = (file: string) =>
  `https://cdn.jsdelivr.net/gh/adobe-fonts/source-serif@4.005R/TTF/SourceSerif4-${file}.ttf`;
const ibm = (file: string) =>
  `https://cdn.jsdelivr.net/npm/@ibm/plex-mono@2.5.0/fonts/complete/woff/IBMPlexMono-${file}.woff`;

const sourceSerif: CustomFont = {
  name: 'Source Serif 4',
  fonts: {
    regular: adobe('Regular'),
    semibold: adobe('Semibold'),
    bold: adobe('Bold'),
    italic: adobe('It'),
    'bold-italic': adobe('BoldIt'),
  },
};

const plexMono: CustomFont = {
  name: 'IBM Plex Mono',
  fonts: {
    regular: ibm('Regular'),
    semibold: ibm('SemiBold'),
    bold: ibm('Bold'),
    italic: ibm('Italic'),
    'bold-italic': ibm('BoldItalic'),
  },
};

export type Font = 'standard' | 'inter' | 'google';

/** Font files for each choice in the sidebar. */
export const FONT_CHOICES: Record<Font, FontFiles> = {
  standard: {},
  inter: { body: interFont },
  google: { body: interFont, serif: sourceSerif, mono: plexMono },
};
