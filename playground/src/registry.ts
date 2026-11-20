// Everything that comes from the package source. main.ts hot-accepts this module, so an edit to any
// template, fixture or engine file re-runs it and the preview re-renders without a page reload.
import * as templateExports from '@resume/templates';
import { fixtures } from '@resume/fixtures';
import { ResumePDFService } from '@resume/resume-pdf.service';
import { interFont } from '@resume/assets';
import type { Template } from '@resume/types';

const isTemplate = (value: unknown): value is Template =>
  typeof value === 'object' && value !== null && Array.isArray((value as Template).groups);

/** Every template exported from `templates/index.ts`. */
export const templates: Record<string, Template> = Object.fromEntries(
  Object.entries(templateExports).filter(([, value]) => isTemplate(value)),
);

export { fixtures, ResumePDFService, interFont };
