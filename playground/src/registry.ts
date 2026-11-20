// Everything that comes from the package source. main.ts hot-accepts this module, so an edit to any
// template, fixture or engine file re-runs it and the preview re-renders without a page reload.
import * as templateExports from '@resume/templates';
import * as playgroundTemplateExports from '../templates';
import { fixtures } from '@resume/fixtures';
import { ResumePDFService } from '@resume/resume-pdf.service';
import type { Template } from '@resume/types';

const isTemplate = (value: unknown): value is Template =>
  typeof value === 'object' && value !== null && Array.isArray((value as Template).groups);

/**
 * The package's templates (`packages/resume/templates`), then the playground's own
 * (`playground/templates`), which are not released with the package.
 */
export const templates: Record<string, Template> = Object.fromEntries(
  [...Object.entries(templateExports), ...Object.entries(playgroundTemplateExports)].filter(
    ([, value]) => isTemplate(value),
  ),
);

export { fixtures, ResumePDFService };
