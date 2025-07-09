import { getIconPath } from './utils';
import { BasePDFService, DEFAULT_CONFIG } from './pdf.service';
import { DrawIconParams } from './types';
import { iconScaleMap } from './constants';

export class PDFIcons extends BasePDFService {
  constructor(config = DEFAULT_CONFIG) {
    super(config);
  }

  drawIcon({ icon, ...params }: DrawIconParams) {
    if (icon === 'email') return this.emailIcon(params);
    if (icon === 'linkedin') return this.linkedinIcon(params);
    if (icon === 'pin') return this.pinIcon(params);
    if (icon === 'phone') return this.phoneIcon(params);
    if (icon === 'link') return this.linkIcon(params);
    if (icon === 'cap') return this.capIcon(params);

    const { color: colorType, size, x, y, page } = params;

    const { path, translateY = 0, scale } = getIconPath(icon);
    const color = this.color(colorType);
    const fontSize = this.fontSize(size);

    const iconScale = (fontSize / 10) * iconScaleMap[size];
    page.drawSvgPath(path, {
      x,
      y: y - translateY,
      color,
      scale: iconScale * scale,
    });

    return { width: iconScale * 10, height: iconScale * 10 };
  }

  emailIcon({ y, x, color: colorType, size, page }: Omit<DrawIconParams, 'icon'>) {
    const { path } = getIconPath('email');
    const color = this.color(colorType);

    const iconScale = iconScaleMap[size];

    let currentY = y;
    if (this.$fontScale === 'sm') {
      currentY -= 3;
    }

    if (this.$fontScale === 'md') {
      currentY -= 4;
    }

    if (this.$fontScale === 'lg') {
      currentY -= 5;
    }

    page.drawSvgPath(path, {
      x,
      y: currentY,
      color,
      scale: iconScale,
    });

    return { width: 10 * iconScale + 2, height: 6 * iconScale };
  }

  linkedinIcon({ y, x, color: colorType, size, page }: Omit<DrawIconParams, 'icon'>) {
    const { path, translateY = 2 } = getIconPath('linkedin');
    const color = this.color(colorType);
    const iconScale = iconScaleMap[size];

    let currentY = y - translateY;
    if (this.$fontScale === 'sm') {
      currentY += 1;
    }

    if (this.$fontScale === 'md') {
      currentY -= 0;
    }

    if (this.$fontScale === 'lg') {
      currentY -= 1;
    }

    page.drawSvgPath(path, {
      x: x + 1,
      y: currentY,
      color,
      scale: iconScale,
    });

    return { width: 10 * iconScale + 2, height: 6 * iconScale };
  }

  pinIcon({ y, x, color: colorType, size, page }: Omit<DrawIconParams, 'icon'>) {
    const { path, translateY = 0.5 } = getIconPath('pin');
    const color = this.color(colorType);
    const iconScale = iconScaleMap[size];

    let currentY = y - translateY;
    if (this.$fontScale === 'sm') {
      currentY += 0.5;
    }

    if (this.$fontScale === 'md') {
      currentY += 1;
    }

    if (this.$fontScale === 'lg') {
      currentY -= 0.5;
    }

    page.drawSvgPath(path, {
      x: x + 1,
      y: currentY,
      color,
      scale: iconScale * 1.1,
    });

    return { width: 10 * iconScale + 2, height: 6 * iconScale };
  }

  phoneIcon({ y, x, color: colorType, size, page }: Omit<DrawIconParams, 'icon'>) {
    const { path, translateY = 1 } = getIconPath('phone');
    const color = this.color(colorType);
    const iconScale = iconScaleMap[size];

    let currentY = y - translateY;
    if (this.$fontScale === 'sm') {
      currentY += 0;
    }

    if (this.$fontScale === 'md') {
      currentY += 1;
    }

    if (this.$fontScale === 'lg') {
      currentY -= 1;
    }

    page.drawSvgPath(path, {
      x,
      y: currentY,
      color,
      scale: iconScale * 1.1,
    });

    return { width: 10 * iconScale + 2, height: 6 * iconScale };
  }

  linkIcon({ y, x, color: colorType, size, page }: Omit<DrawIconParams, 'icon'>) {
    const { path, translateY = 1 } = getIconPath('link');
    const color = this.color(colorType);
    const iconScale = iconScaleMap[size];

    let currentY = y - translateY;
    if (this.$fontScale === 'sm') {
      currentY += 1;
    }

    if (this.$fontScale === 'md') {
      currentY -= 0;
    }

    if (this.$fontScale === 'lg') {
      currentY -= 1;
    }

    page.drawSvgPath(path, {
      x,
      y: currentY,
      color,
      scale: iconScale * 1.1,
    });

    return { width: 10 * iconScale + 4, height: 6 * iconScale };
  }

  capIcon({ y, x, color: colorType, size, page }: Omit<DrawIconParams, 'icon'>) {
    const { path, translateY = 2 } = getIconPath('cap');
    const color = this.color(colorType);
    const iconScale = iconScaleMap[size];

    let currentY = y - translateY;
    if (this.$fontScale === 'sm') {
      currentY += 1;
    }

    if (this.$fontScale === 'md') {
      currentY -= 0;
    }

    if (this.$fontScale === 'lg') {
      currentY -= 1;
    }

    page.drawSvgPath(path, {
      x,
      y: currentY,
      color,
      scale: iconScale * 1.1,
    });

    return { width: 10 * iconScale + 2, height: 6 * iconScale };
  }
}
