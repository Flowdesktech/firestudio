import type { FirestoreDatabase } from './utils/firestoreDatabaseTypes';
import { Project, GoogleAccount } from './store/projectsSlice';

export type MenuTarget =
  | (GoogleAccount & { menuType: 'account' })
  | (Project & { menuType: 'project' | 'googleProject' })
  | { menuType: 'collection'; project: Project | GoogleAccount; collection: string; firestoreDatabaseId?: string }
  | { menuType: 'firestoreRoot'; project: Project }
  | { menuType: 'firestoreDatabase'; project: Project; firestoreDatabase: FirestoreDatabase };

export type MenuTargetType = MenuTarget['menuType'];

export const isGoogleAccount = (item: Project | GoogleAccount): item is GoogleAccount =>
  (item as GoogleAccount).type === 'googleAccount';
