import { CustomFont, FontMap, FontType } from './types';

const fontUrlMap: FontMap = {
  bold: 'https://fonts.gstatic.com/s/inter/v19/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYMZhrib2Bg-4.ttf',
  semibold: 'https://fonts.gstatic.com/s/inter/v19/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuGKYMZhrib2Bg-4.ttf',
  italic: 'https://fonts.gstatic.com/s/inter/v19/UcCM3FwrK3iLTcvneQg7Ca725JhhKnNqk4j1ebLhAm8SrXTc2dthjZ-Ek-7MeA.ttf',
  'bold-italic':
    'https://fonts.gstatic.com/s/inter/v19/UcCM3FwrK3iLTcvneQg7Ca725JhhKnNqk4j1ebLhAm8SrXTcPtxhjZ-Ek-7MeA.ttf',
  regular: 'https://fonts.gstatic.com/s/inter/v19/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfMZhrib2Bg-4.ttf',
};

export const defaultFontMap: CustomFont = {
  name: 'Inter',
  fonts: fontUrlMap,
};

export async function fetchDefaultFont(font: FontType) {
  const response = await fetch(fontUrlMap[font]);
  const blob = await response.blob();
  const arrayBuffer = await blob.arrayBuffer();
  return arrayBuffer;
}

export async function fetchCustomFont(font: FontMap) {
  const types = Object.keys(font) as FontType[];
  const promises = types.map(async (type) => {
    const response = await fetch(font[type]);
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    return { type, arrayBuffer };
  });

  return Promise.all(promises);
}

export async function fetchImage(imageUrl: string) {
  const response = await fetch(imageUrl);
  const blob = await response.blob();
  const arrayBuffer = await blob.arrayBuffer();
  return arrayBuffer;
}
