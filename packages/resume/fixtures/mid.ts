import type { ResumeData } from '../types';
import { base } from './base';
import { edu, exp, withStack, project, rec } from './helpers';

/** Five years in, three roles. Matches the web app's mid-level preview. */
export const mid: ResumeData = {
  ...base,
  name: 'Maya Lindqvist',
  role: 'Software Engineer',
  description:
    'Full-stack engineer with five years building and running customer-facing products in TypeScript, Node.js and Postgres. Owns features end to end, from discovery with product to monitoring in production.',
  skills: [
    'TypeScript',
    'Node.js',
    'React',
    'PostgreSQL',
    'GraphQL',
    'AWS',
    'System design',
    'Mentoring',
  ],
  tools: ['Next.js', 'Terraform', 'Docker', 'Datadog', 'Playwright', 'Figma'],
  skillGroups: [
    { name: 'Frontend', skills: ['React', 'TypeScript', 'Accessibility'] },
    { name: 'Backend', skills: ['Node.js', 'PostgreSQL', 'REST APIs'] },
  ],
  experience: [
    withStack(
      exp('Northwind Health', 'Full-time', 'Software Engineer', 'Mar 2023 - Present', [
        'Lead developer on the appointment booking service handling 60,000 bookings a month across three clinics.',
        'Cut p95 API latency from 1.4s to 380ms by adding read replicas and query-level caching.',
        'Introduced contract tests between the web app and the scheduling API, removing a weekly class of release bugs.',
        "Mentor two junior engineers and run the team's design review.",
        'Ran the on-call rota and wrote the incident playbook that cut mean time to recovery by 40%.',
      ]),
      ['TypeScript', 'React', 'Next.js', 'PostgreSQL'],
    ),
    withStack(
      exp('Brightline Studio', 'Full-time', 'Frontend Developer', 'Jul 2021 - Feb 2023', [
        'Shipped the self-serve billing flow that moved 70% of invoices off manual processing.',
        'Built the shared component library used by four product teams.',
        'Raised Lighthouse accessibility scores from 61 to 97 across the marketing site.',
        'Paired with design on the component API; adopted by every product team within a quarter.',
      ]),
      ['React', 'TypeScript', 'Playwright'],
    ),
    exp('Brightline Studio', 'Internship', 'Frontend Developer Intern', 'Jan 2021 - Jun 2021', [
      'Built the onboarding checklist with keyboard navigation and screen-reader labels.',
      'Reduced bundle size by 18% by replacing a date library and lazy-loading the settings page.',
    ]),
  ],
  education: [
    edu('University of Edinburgh', 'BSc Computer Science, First Class', 'Sep 2017 - Jun 2021'),
  ],
  projects: [
    project(
      'A11y Lint',
      'https://github.com/mayalq/a11y-lint',
      'ESLint rules for missing labels and contrast issues; 900 weekly installs.',
    ),
    project(
      'Pocket Budget',
      'https://github.com/mayalq/pocket-budget',
      'Offline-first budgeting app with sync; 1,200 downloads.',
    ),
  ],
  recommendations: [
    rec(
      'Tom Okafor, Head of Engineering at Northwind Health',
      'https://linkedin.com/in/tomokafor',
      'Maya owns problems end to end and leaves every system better documented than she found it.',
    ),
  ],
};
