import type { ResumeData } from '../types';
import { base } from './base';
import { edu, exp, withStack, project, rec } from './helpers';

/** Twelve years, four roles. Matches the web app's senior-level preview. */
export const senior: ResumeData = {
  ...base,
  name: 'Maya Lindqvist',
  role: 'Staff Software Engineer',
  description:
    'Staff engineer with twelve years of experience leading platform and product teams. Sets technical direction across multiple squads, has run two zero-downtime migrations of core systems, and has grown engineers into senior and lead roles.',
  skills: [
    'Distributed systems',
    'TypeScript',
    'Go',
    'PostgreSQL',
    'Kafka',
    'AWS',
    'Technical strategy',
    'Hiring',
    'Mentoring',
    'Incident management',
  ],
  tools: ['Kubernetes', 'Terraform', 'Datadog', 'GitHub', 'Figma', 'Linear'],
  skillGroups: [
    { name: 'Architecture', skills: ['Distributed systems', 'Event-driven design', 'Kafka'] },
    { name: 'Languages', skills: ['TypeScript', 'Go', 'SQL'] },
    {
      name: 'Leadership',
      skills: ['Technical strategy', 'Hiring', 'Mentoring', 'Incident management'],
    },
  ],
  headlineAchievements: [
    { value: '1.2 million', label: 'patients on the platform' },
    { value: '0 downtime', label: 'across two migrations of core systems' },
    { value: '14', label: 'engineers hired in 18 months' },
  ],
  experience: [
    withStack(
      exp('Northwind Health', 'Full-time', 'Staff Software Engineer', 'Jan 2024 - Present', [
        'Own the technical roadmap for the patient platform used by 1.2 million patients across 40 clinics.',
        'Led the migration from a monolith to six services with zero downtime over nine months, then retired the legacy database.',
        'Designed the event pipeline that cut data-latency for clinical dashboards from hours to under a minute.',
        'Established the engineering ladder and interview loop; hired 14 engineers in 18 months.',
      ]),
      ['TypeScript', 'Go', 'Kafka', 'PostgreSQL', 'AWS'],
    ),
    withStack(
      exp('Northwind Health', 'Full-time', 'Engineering Lead, Scheduling', 'Mar 2020 - Dec 2023', [
        'Managed a team of seven building the appointment booking service, 60,000 bookings a month.',
        'Cut p95 API latency from 1.4s to 380ms and reduced incident volume by half with SLO-driven alerting.',
        'Introduced contract testing across four teams, removing a weekly class of release bugs.',
      ]),
      ['TypeScript', 'Node.js', 'PostgreSQL', 'Datadog'],
    ),
    withStack(
      exp('Brightline Studio', 'Full-time', 'Senior Frontend Developer', 'Jul 2016 - Feb 2020', [
        'Shipped the self-serve billing flow that moved 70% of invoices off manual processing.',
        'Built the design system used by four product teams and 30 engineers.',
        'Introduced trunk-based development and feature flags; deploys went from weekly to daily.',
        'Raised Lighthouse accessibility scores from 61 to 97 across the marketing site.',
      ]),
      ['React', 'TypeScript', 'Storybook'],
    ),
    withStack(
      exp('Fjord Analytics', 'Full-time', 'Software Engineer', 'Sep 2013 - Jun 2016', [
        'Built real-time reporting for 200 enterprise customers in Node.js and Postgres.',
        'Led the migration from MySQL to Postgres with no customer-visible downtime.',
      ]),
      ['Node.js', 'PostgreSQL', 'MySQL'],
    ),
  ],
  education: [
    edu('University of Edinburgh', 'BSc Computer Science, First Class', 'Sep 2009 - Jun 2013'),
  ],
  projects: [
    project(
      'A11y Lint',
      'https://github.com/mayalq/a11y-lint',
      'Open-source ESLint rules for accessibility; 900 weekly installs.',
    ),
    project(
      'Pocket Budget',
      'https://github.com/mayalq/pocket-budget',
      'Offline-first budgeting app with sync; 1,200 downloads.',
    ),
  ],
  recommendations: [
    rec(
      'Dr Elena Marsh, CTO at Northwind Health',
      'https://linkedin.com/in/elenamarsh',
      'Maya turned a fragile monolith into a platform the whole company builds on, and did it while raising the bar for every engineer around her.',
    ),
    rec(
      'Tom Okafor, Head of Engineering at Northwind Health',
      'https://linkedin.com/in/tomokafor',
      'Maya owns problems end to end and leaves every system better documented than she found it.',
    ),
  ],
};
