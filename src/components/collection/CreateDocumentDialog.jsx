import React from 'react';
import {
    Button,
    TextField,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
} from '@mui/material';

function CreateDocumentDialog({
    open,
    onClose,
    newDocId,
    setNewDocId,
    newDocData,
    setNewDocData,
    onCreate,
}) {
    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>Create Document</DialogTitle>
            <DialogContent>
                <TextField
                    fullWidth
                    label="Document ID (optional)"
                    value={newDocId}
                    onChange={(e) => setNewDocId(e.target.value)}
                    size="small"
                    sx={{ mb: 2, mt: 1 }}
                />
                <TextField
                    fullWidth
                    label="Data (JSON)"
                    value={newDocData}
                    onChange={(e) => setNewDocData(e.target.value)}
                    multiline
                    rows={8}
                    sx={{ '& .MuiInputBase-input': { fontFamily: 'monospace', fontSize: '0.85rem' } }}
                />
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button variant="contained" onClick={onCreate}>Create</Button>
            </DialogActions>
        </Dialog>
    );
}

export default CreateDocumentDialog;
