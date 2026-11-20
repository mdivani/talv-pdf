import type { ResumeData } from '../types';
import { base } from './base';
import { edu, exp, project } from './helpers';

const roles = [
  ['Northwind Health', 'Staff Software Engineer', 'Jan 2024 - Present'],
  ['Northwind Health', 'Engineering Lead', 'Mar 2020 - Dec 2023'],
  ['Brightline Studio', 'Senior Frontend Developer', 'Jul 2016 - Feb 2020'],
  ['Fjord Analytics', 'Software Engineer', 'Sep 2013 - Jun 2016'],
  ['Fjord Analytics', 'Junior Software Engineer', 'Sep 2011 - Aug 2013'],
  ['Copperfield Labs', 'Web Developer', 'Jun 2009 - Aug 2011'],
  ['Copperfield Labs', 'Developer Intern', 'Jan 2009 - May 2009'],
];

const bullets = [
  'Owned a service end to end, from design review to on-call, and kept it inside its error budget for every quarter.',
  'Cut p95 latency by more than half by profiling hot paths and adding targeted caching.',
  'Mentored engineers through promotion and ran the team interview loop.',
  'Wrote the runbooks and dashboards the team still uses for incident response.',
  'Partnered with product and design on quarterly planning and roadmap trade-offs.',
];

/** Enough content to run onto two or three pages, to check page breaks and repeated sidebars. */
export const multiPage: ResumeData = {
  ...base,
  name: 'Maya Lindqvist',
  role: 'Staff Software Engineer',
  description:
    'Engineer with fifteen years across product and platform teams. This fixture repeats realistic content to force page breaks.',
  skills: [
    'TypeScript',
    'Go',
    'PostgreSQL',
    'Kafka',
    'AWS',
    'Kubernetes',
    'System design',
    'Mentoring',
  ],
  tools: ['Terraform', 'Datadog', 'GitHub', 'Figma'],
  experience: roles.map(([company, title, dates]) =>
    exp(company, 'Full-time', title, dates, bullets),
  ),
  education: [
    edu('University of Edinburgh', 'MSc Software Engineering', 'Sep 2007 - Jun 2008'),
    edu('University of Edinburgh', 'BSc Computer Science', 'Sep 2003 - Jun 2007'),
  ],
  projects: Array.from({ length: 4 }, (_, i) =>
    project(
      `Side project ${i + 1}`,
      `https://github.com/mayalq/project-${i + 1}`,
      'A small open-source tool with a short description.',
    ),
  ),
};
