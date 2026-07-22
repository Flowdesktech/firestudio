import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, CircularProgress } from '@mui/material';

interface DeleteCollectionDialogProps {
  open: boolean;
  onClose: () => void;
  collection: string;
  onSubmit: () => Promise<void>;
}

const DeleteCollectionDialog: React.FC<DeleteCollectionDialogProps> = ({ open, onClose, collection, onSubmit }) => {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setLoading(false);
    }
  }, [open]);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await onSubmit();
      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => !loading && onClose()}>
      <DialogTitle sx={{ color: 'error.main' }}>Delete Collection?</DialogTitle>
      <DialogContent>
        <Typography sx={{ mb: 2 }}>
          Are you sure you want to delete the collection <strong>&quot;{collection}&quot;</strong>?
        </Typography>
        <Typography variant="body2" color="text.secondary">
          This will permanently delete all documents in this collection, including their nested subcollections. This
          action cannot be undone.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          color="error"
          variant="contained"
          disabled={loading}
          startIcon={loading ? <CircularProgress size={16} /> : null}
        >
          {loading ? 'Deleting...' : 'Delete Collection'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DeleteCollectionDialog;
