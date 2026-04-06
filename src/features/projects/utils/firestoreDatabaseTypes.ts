/** Named Firestore database under a service-account project */
export interface FirestoreDatabase {
  id: string;
  /** Firestore database ID as in GCP: "(default)" or a custom name */
  databaseId: string;
  /** Sidebar / tab label */
  label?: string;
  collections?: { id: string; path: string }[];
}
