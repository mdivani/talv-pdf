import type { ResumeData } from '../types';
import { entry } from './entry';
import { mid } from './mid';
import { senior } from './senior';
import { minimal } from './minimal';
import { longText } from './long-text';
import { multiPage } from './multi-page';
import { richText } from './rich-text';
import { international } from './international';

export { entry, mid, senior, minimal, longText, multiPage, richText, international };

/** Every fixture by key, in the order the playground lists them. */
export const fixtures: Record<string, ResumeData> = {
  entry,
  mid,
  senior,
  minimal,
  longText,
  multiPage,
  richText,
  international,
};
