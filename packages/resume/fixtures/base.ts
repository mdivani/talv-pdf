import type { ResumeData } from '../types';
import { formatUrl } from '../utils';

/** Contact details shared by the entry, mid and senior fixtures. */
export const base: Omit<ResumeData, 'name' | 'role'> = {
  email: 'maya@lindqvist.dev',
  phone: '+44 20 7946 0958',
  location: 'London, United Kingdom',
  primaryProfile: formatUrl('https://linkedin.com/in/mayalq'),
  links: [{ url: formatUrl('https://github.com/mayalq') }],
  languages: ['English - Native', 'Swedish - Fluent', 'German - Intermediate'],
};
