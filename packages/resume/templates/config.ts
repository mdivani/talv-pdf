import { rgb } from 'pdf-lib';

export const defaultConfig = {
  page: {
    width: 595,
    height: 842,
    gapX: 20,
    gapY: 10,
  },
  colors: {
    primary: rgb(0.27, 0.27, 0.27),
    secondary: rgb(0, 0.36, 0.64),
    neutral: rgb(0.7, 0.7, 0.7),
  },
  fontSize: {
    sm: 10,
    md: 12,
    lg: 16,
    xl: 24,
  },
  leadings: {
    default: 1.15,
    sm: 1.1,
    lg: 1.3,
  },
};

export const brand_color = {
  talvio: rgb(0, 0.36, 0.64),
  ember: rgb(0.4, 0, 0),
  mint: rgb(0, 0.33, 0.03),
};
