import type { ResumeData } from '../types';
import { edu, exp } from './helpers';

/**
 * Accented Latin, Greek and Cyrillic, which the default Inter font covers, plus Georgian, which it does not.
 * Unsupported scripts show which characters need a custom font.
 */
export const international: ResumeData = {
  name: 'Zoë Ångström-Müller',
  role: 'Ingénieure logicielle',
  description: 'Français, Deutsch, Ελληνικά, Русский. Georgian is not in Inter: ქართული.',
  location: 'Zürich, Schweiz',
  email: 'zoe@example.ch',
  languages: [
    'Français - Langue maternelle',
    'Deutsch - Fließend',
    'Ελληνικά - Βασικά',
    'Русский - Средний',
    'ქართული - საბაზისო',
  ],
  skills: ['Résumé parsing', 'Ünïcödé handling', 'Типографика'],
  experience: [
    exp('Société Générale Ünïcode', 'CDI', 'Ingénieure logicielle', 'Jan 2022 - Present', [
      'Développé un moteur de rendu PDF multilingue.',
      'Разработала систему поиска с поддержкой нескольких языков.',
    ]),
  ],
  education: [
    edu('Eidgenössische Technische Hochschule Zürich', 'MSc Informatik', 'Sep 2019 - Jun 2021'),
  ],
};
