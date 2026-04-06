import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  IconButton,
  CircularProgress,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';

interface AddFirestoreDatabaseDialogProps {
  open: boolean;
  onClose: () => void;
  /** GCP / Firebase project id (for context) */
  projectIdLabel: string;
  onSubmit: (databaseId: string, label: string) => void | Promise<void>;
  loading?: boolean;
}

/**
 * Add a named Firestore database to an existing service-account project.
 * Database IDs match Firebase (e.g. "(default)" or a custom name like "prod-db").
 */
function AddFirestoreDatabaseDialog({
  open,
  onClose,
  projectIdLabel,
  onSubmit,
  loading = false,
}: AddFirestoreDatabaseDialogProps) {
  const [databaseId, setDatabaseId] = useState('');
  const [label, setLabel] = useState('');

  const handleClose = () => {
    if (!loading) {
      setDatabaseId('');
      setLabel('');
      onClose();
    }
  };

  const handleSubmit = async () => {
    const id = databaseId.trim();
    if (!id) return;
    await onSubmit(id, label.trim());
    setDatabaseId('');
    setLabel('');
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 0 }}>
        <span>Add Firestore database</span>
        <IconButton onClick={handleClose} disabled={loading} size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mb: 2, color: 'text.secondary' }}>
          Project <strong>{projectIdLabel}</strong> — use the same database ID as in Firebase Console (Firestore →
          database picker).
        </Typography>
        <TextField
          fullWidth
          label="Database ID"
          value={databaseId}
          onChange={(e) => setDatabaseId(e.target.value)}
          placeholder="(default) or my-database-id"
          helperText='Required. Use "(default)" for the default database, or your named database ID.'
          size="small"
          disabled={loading}
          autoFocus
        />
        <TextField
          fullWidth
          label="Label (optional)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. Production, Dev"
          helperText="Shown in the sidebar to tell databases apart."
          size="small"
          disabled={loading}
          sx={{ mt: 2 }}
        />
      </DialogContent>
      <DialogActions sx={{ p: 2, pt: 0 }}>
        <Button onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!databaseId.trim() || loading}
          startIcon={loading ? <CircularProgress size={16} /> : null}
        >
          {loading ? 'Adding…' : 'Add database'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default AddFirestoreDatabaseDialog;
