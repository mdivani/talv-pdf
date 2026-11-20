import type { ResumeData } from '../types';
import { formatUrl } from '../utils';
import { edu, exp, project, rec } from './helpers';

/**
 * Values much longer than the sample resumes, to catch text that runs past its column or gets clipped.
 * Narrow sidebars (education dates, contact details, skills) are where this usually shows first.
 */
export const longText: ResumeData = {
  name: 'Maximiliana Alexandrovna Konstantinopoulou-Fairweather',
  role: 'Principal Site Reliability Engineer, Payments Infrastructure and Developer Platform',
  description:
    'Infrastructure engineer focused on payment systems that cannot go down. Designed multi-region failover for a ledger processing four billion euros a year, wrote the internal standard for idempotent APIs, and led the incident review programme across eleven teams. Comfortable moving between kernel-level performance work, capacity planning spreadsheets and board-level risk reports.',
  email: 'maximiliana.konstantinopoulou-fairweather@payments-infrastructure.example.com',
  phone: '+44 (0) 20 7946 0958 ext. 4471',
  location: 'Royal Leamington Spa, Warwickshire, United Kingdom',
  primaryProfile: formatUrl(
    'https://www.linkedin.com/in/maximiliana-konstantinopoulou-fairweather-sre',
  ),
  links: [
    { url: formatUrl('https://github.com/maximiliana-konstantinopoulou-fairweather') },
    { url: formatUrl('https://maximiliana-konstantinopoulou-fairweather.engineering.blog') },
  ],
  languages: [
    'English - Native',
    'Greek - Native',
    'Portuguese (Brazilian) - Professional working proficiency',
  ],
  skills: [
    'Site reliability engineering',
    'Distributed consensus (Raft, Paxos)',
    'Capacity planning and load forecasting',
    'PostgreSQL logical replication',
    'Incident command',
  ],
  tools: [
    'Kubernetes',
    'Terraform Enterprise',
    'Prometheus and Alertmanager',
    'OpenTelemetry Collector',
  ],
  experience: [
    exp(
      'International Settlement and Clearing Infrastructure Holdings',
      'Full-time permanent',
      'Principal Site Reliability Engineer, Payments Infrastructure',
      'September 2019 - Present',
      [
        'Designed and rolled out active-active multi-region failover for the core ledger, taking recovery time from forty minutes to under ninety seconds without any change to the client-facing API contracts.',
        'Supercalifragilisticexpialidociously-long-unbroken-token-to-check-word-wrapping-behaviour-in-narrow-columns',
      ],
      'Hybrid - three days a week in office',
    ),
  ],
  education: [
    edu(
      'École Polytechnique Fédérale de Lausanne (Swiss Federal Institute of Technology)',
      'MSc Computer Science, Distributed Systems and Networking Specialisation',
      'September 2012 - June 2014',
      'Thesis on Byzantine fault-tolerant replication under partial synchrony.',
    ),
  ],
  projects: [
    project(
      'Open-source idempotency key middleware for high-throughput payment APIs',
      'https://github.com/maximiliana-konstantinopoulou-fairweather/idempotency-middleware',
      'Drop-in middleware used by twelve fintech companies to make retries safe.',
    ),
  ],
  recommendations: [
    rec(
      'Professor Dr Jean-Baptiste Delacroix-Montgomery, Head of Distributed Systems Research Laboratory',
      'https://www.linkedin.com/in/jean-baptiste-delacroix-montgomery-research',
      'One of the most careful systems thinkers I have supervised.',
    ),
  ],
};
