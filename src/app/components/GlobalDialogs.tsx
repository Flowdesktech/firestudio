import { useSelector, useDispatch } from 'react-redux';
import { closeDialog, selectActiveDialog, addTab, DialogState } from '../../app/store/slices/uiSlice';
import {
  selectGoogleSignInLoading,
  selectProjectsLoading,
  connectServiceAccount,
  signInWithGoogle,
  addFirestoreDatabase,
  addGoogleFirestoreDatabase,
} from '../../features/projects/store/projectsSlice';
import {
  getActiveFirestoreDatabase,
  getFirestoreDatabaseDisplay,
} from '../../features/projects/utils/firestoreDatabaseUtils';
import { AppDispatch } from '../store';
import { Project } from '../../features/projects/store/projectsSlice';
import { addLog } from '../../app/store/slices/logsSlice';
import { getErrorMessage } from '../../shared/utils/commonUtils';

// Dialog Components
import AddCollectionDialog from '../../features/collections/components/dialogs/AddCollectionDialog';
import AddDocumentDialog from '../../features/collections/components/dialogs/AddDocumentDialog';
import RenameCollectionDialog from '../../features/collections/components/dialogs/RenameCollectionDialog';
import DeleteCollectionDialog from '../../features/collections/components/dialogs/DeleteCollectionDialog';
import ApiDisabledDialog from '../../features/collections/components/dialogs/ApiDisabledDialog';
import ConnectionDialog from '../../features/projects/components/ConnectionDialog';
import AddFirestoreDatabaseDialog from '../../features/projects/components/AddFirestoreDatabaseDialog';
import SettingsDialog from './SettingsDialog';

// We need to import the hooks logic for actions that execute inside dialogs
// Or better, we define the submit handlers here that dispatch thunks/actions.
// For now, to minimize friction, I'll inline the handlers or use the hook if available
// Let's rely on passing "onSubmit" props that might call thunks.
import {
  createCollection,
  addDocument,
  renameCollection,
  deleteCollection,
} from '../../features/collections/store/collectionSlice';

interface GlobalDialogsProps {
  onShowMessage: (msg: string, type: 'success' | 'error' | 'warning') => void;
}

interface GlobalDialogProps {
  project?: Project;
  collection?: string;
  projectId?: string;
  apiUrl?: string;
  firestoreDatabaseId?: string;
}

export default function GlobalDialogs({ onShowMessage: _onShowMessage }: GlobalDialogsProps) {
  // onShowMessage unused here currently but kept for interface consistency or future use
  const dispatch = useDispatch<AppDispatch>();
  const activeDialog = useSelector(selectActiveDialog);
  const googleSignInLoading = useSelector(selectGoogleSignInLoading);
  const projectsLoading = useSelector(selectProjectsLoading);

  if (!activeDialog) return null;

  const handleClose = () => {
    dispatch(closeDialog());
  };

  const { type, props = {} } = activeDialog as DialogState & { props?: GlobalDialogProps };

  // Helper to open a collection tab after creation (mimicking original App.jsx behavior)
  // Used for AddCollection which also opens the tab
  const handleOpenCollection = (project: Project, collection: string) => {
    const fd =
      project.authMethod === 'serviceAccount' || project.authMethod === 'google'
        ? getActiveFirestoreDatabase(project)
        : null;
    const id = fd ? `${project.id}-${fd.id}-${collection}` : `${project.id}-${collection}`;
    const databaseLabel = fd ? getFirestoreDatabaseDisplay(fd) : undefined;
    dispatch(
      addTab({
        id,
        projectId: project.id,
        projectName: project.projectId,
        collectionPath: collection,
        label: databaseLabel ? `${databaseLabel} · ${collection}` : collection,
        type: 'collection',
        firestoreDatabaseId: fd?.id,
        databaseLabel,
      }),
    );
  };

  return (
    <>
      {/* Connection Dialog - Handle internally or via props */}
      <ConnectionDialog
        open={type === 'CONNECTION'}
        onClose={handleClose}
        onConnect={async (path: string) => {
          try {
            const result = await dispatch(connectServiceAccount({ serviceAccountPath: path })).unwrap();
            if (result.mode === 'create') {
              dispatch(addLog({ type: 'success', message: `Connected to ${result.project.projectId}` }));
            } else {
              dispatch(
                addLog({
                  type: 'success',
                  message: `Added Firestore database "${result.newDatabase.databaseId}" to ${result.projectId}`,
                }),
              );
            }
            handleClose();
          } catch (err: unknown) {
            dispatch(addLog({ type: 'error', message: getErrorMessage(err) }));
          }
        }}
        onGoogleSignIn={async () => {
          try {
            const account = await dispatch(signInWithGoogle()).unwrap();
            if (account.email) {
              dispatch(addLog({ type: 'success', message: `Signed in as ${account.email}` }));
            }
            handleClose();
          } catch (error: unknown) {
            dispatch(addLog({ type: 'error', message: getErrorMessage(error) }));
          }
        }}
        loading={googleSignInLoading || projectsLoading}
      />

      <AddFirestoreDatabaseDialog
        open={type === 'ADD_FIRESTORE_DATABASE'}
        onClose={handleClose}
        projectIdLabel={(props.project as Project)?.projectId ?? ''}
        loading={projectsLoading}
        onSubmit={async (databaseId: string, label: string) => {
          const project = props.project as Project;
          try {
            if (project.authMethod === 'google') {
              await dispatch(addGoogleFirestoreDatabase({ projectId: project.id, databaseId, label })).unwrap();
            } else {
              await dispatch(addFirestoreDatabase({ projectId: project.id, databaseId, label })).unwrap();
            }
            dispatch(addLog({ type: 'success', message: `Added Firestore database "${databaseId}"` }));
            handleClose();
          } catch (err: unknown) {
            dispatch(addLog({ type: 'error', message: getErrorMessage(err) }));
          }
        }}
      />

      <SettingsDialog open={type === 'SETTINGS'} onClose={handleClose} />

      <AddCollectionDialog
        open={type === 'ADD_COLLECTION'}
        onClose={handleClose}
        project={props.project as Project}
        onSubmit={async (name: string, docId: string, docData: string) => {
          const project = props.project as Project;
          try {
            const createdName = await dispatch(
              createCollection({
                project,
                name,
                docId,
                docData,
                firestoreDatabaseId: getActiveFirestoreDatabase(project)?.id,
              }),
            ).unwrap();
            if (createdName) {
              dispatch(addLog({ type: 'success', message: `Created collection "${createdName}"` }));
              handleOpenCollection(project, createdName);
              handleClose();
            }
          } catch (error: unknown) {
            dispatch(addLog({ type: 'error', message: getErrorMessage(error) }));
          }
        }}
      />

      <AddDocumentDialog
        open={type === 'ADD_DOCUMENT'}
        onClose={handleClose}
        project={props.project as Project}
        collection={props.collection as string}
        onSubmit={async (docId: string, docData: string) => {
          const project = props.project as Project;
          const collection = props.collection as string;
          try {
            const createdId = await dispatch(
              addDocument({
                project,
                collection,
                docId,
                docData,
                firestoreDatabaseId: props.firestoreDatabaseId ?? getActiveFirestoreDatabase(project)?.id,
              }),
            ).unwrap();
            if (createdId) {
              dispatch(addLog({ type: 'success', message: `Created document ${createdId}` }));
            }
            handleClose();
          } catch (error: unknown) {
            dispatch(addLog({ type: 'error', message: getErrorMessage(error) }));
          }
        }}
      />

      <RenameCollectionDialog
        open={type === 'RENAME_COLLECTION'}
        onClose={handleClose}
        project={props.project as Project}
        collection={props.collection as string}
        onSubmit={async (targetPath: string) => {
          const project = props.project as Project;
          const collection = props.collection as string;
          try {
            await dispatch(
              renameCollection({
                project,
                currentPath: collection,
                targetPath,
                firestoreDatabaseId: getActiveFirestoreDatabase(project)?.id,
              }),
            ).unwrap();
            dispatch(addLog({ type: 'success', message: `Renamed collection to ${targetPath}` }));
            handleClose();
          } catch (error: unknown) {
            dispatch(addLog({ type: 'error', message: getErrorMessage(error) }));
          }
        }}
      />

      <DeleteCollectionDialog
        open={type === 'DELETE_COLLECTION'}
        onClose={handleClose}
        collection={props.collection as string}
        onSubmit={async () => {
          const project = props.project as Project;
          const collection = props.collection as string;
          try {
            await dispatch(
              deleteCollection({
                project,
                collection,
                firestoreDatabaseId: props.firestoreDatabaseId ?? getActiveFirestoreDatabase(project)?.id,
              }),
            ).unwrap();
            dispatch(addLog({ type: 'success', message: `Deleted collection "${collection}"` }));
            handleClose();
          } catch (error: unknown) {
            dispatch(addLog({ type: 'error', message: getErrorMessage(error) }));
          }
        }}
      />

      <ApiDisabledDialog
        open={type === 'API_DISABLED'}
        onClose={handleClose}
        projectId={props.projectId as string}
        apiUrl={props.apiUrl as string}
      />
    </>
  );
}
