import type { ResumeData } from '../types';
import { base } from './base';
import { edu, exp, project, rec } from './helpers';

/** Recent graduate with an internship. Matches the web app's entry-level preview. */
export const entry: ResumeData = {
  ...base,
  name: 'Maya Lindqvist',
  role: 'Junior Frontend Developer',
  description:
    'Recent computer science graduate who builds accessible web interfaces in React and TypeScript. Shipped two production features during a six-month internship and contributes to open-source component libraries.',
  skills: ['TypeScript', 'React', 'HTML & CSS', 'Accessibility', 'Testing Library', 'Git'],
  tools: ['VS Code', 'Figma', 'GitHub Actions', 'Storybook'],
  experience: [
    exp('Brightline Studio', 'Internship', 'Frontend Developer Intern', 'Jan 2026 - Jun 2026', [
      'Built the onboarding checklist used by 4,000 monthly sign-ups, with keyboard navigation and screen-reader labels.',
      'Reduced bundle size by 18% by replacing a date library and lazy-loading the settings page.',
      'Wrote component tests that caught three regressions before release.',
      'Presented the checklist redesign to the product team and shipped two follow-up improvements from their feedback.',
    ]),
    exp('University Web Society', 'Volunteer', 'Web Lead', 'Sep 2024 - Dec 2025', [
      'Ran weekly workshops on React fundamentals for 30 members.',
      'Rebuilt the society site with a static generator, cutting hosting costs to zero.',
      'Organised a 48-hour hackathon with 60 participants and three sponsor companies.',
    ]),
  ],
  education: [
    edu(
      'University of Edinburgh',
      'BSc Computer Science, First Class',
      'Sep 2022 - Jun 2026',
      'Dissertation on measuring interface accessibility with automated audits.',
    ),
    edu('freeCodeCamp', 'Responsive Web Design Certification', 'Jan 2023 - Mar 2023'),
  ],
  projects: [
    project(
      'Pocket Budget',
      'https://github.com/mayalq/pocket-budget',
      'Offline-first budgeting app with sync; 1,200 downloads.',
    ),
    project(
      'A11y Lint',
      'https://github.com/mayalq/a11y-lint',
      'ESLint rules that flag missing labels and colour contrast issues.',
    ),
    project(
      'Study Buddy',
      'https://studybuddy.lindqvist.dev',
      'Flashcard web app with spaced repetition, built with Next.js and used by 150 students.',
    ),
  ],
  recommendations: [
    rec(
      'Priya Shah, Engineering Manager at Brightline Studio',
      'https://linkedin.com/in/priyashah',
      'Maya shipped production features in her first month and raised accessibility questions before anyone else on the team did.',
    ),
  ],
};
