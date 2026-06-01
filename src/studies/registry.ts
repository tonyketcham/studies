import { Study } from '@/studies/study';
import { studyLSystem } from '@/studies/l-systems/index';
import { studyTreeGrowth } from '@/studies/tree-growth/index';

export interface RegisteredStudy extends Study {
  id: string;
}

/** The ordered set of studies available in the app. */
export const studies: RegisteredStudy[] = [
  { id: 'tree-growth', ...studyTreeGrowth },
  { id: 'l-systems', ...studyLSystem },
];

export const DEFAULT_STUDY_ID = studies[0].id;

export function getStudy(id: string): RegisteredStudy {
  return studies.find((s) => s.id === id) ?? studies[0];
}
