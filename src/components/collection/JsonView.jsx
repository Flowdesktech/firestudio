import React from 'react';
import { Box, Button } from '@mui/material';
import { Save as SaveIcon } from '@mui/icons-material';

function JsonView({
    jsonEditData,
    setJsonEditData,
    jsonHasChanges,
    setJsonHasChanges,
    onSave,
    borderColor,
    bgColor,
}) {
    return (
        <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ p: 1, borderBottom: `1px solid ${borderColor}`, display: 'flex', justifyContent: 'flex-end', backgroundColor: bgColor }}>
                <Button
                    variant="contained"
                    size="small"
                    startIcon={<SaveIcon />}
                    onClick={onSave}
                    disabled={!jsonHasChanges}
                >
                    Save Changes
                </Button>
            </Box>
            <textarea
                value={jsonEditData}
                onChange={(e) => { setJsonEditData(e.target.value); setJsonHasChanges(true); }}
                style={{
                    flexGrow: 1,
                    fontFamily: 'monospace',
                    fontSize: '0.8rem',
                    border: 'none',
                    outline: 'none',
                    padding: 16,
                    resize: 'none',
                    backgroundColor: '#1e1e1e',
                    color: '#d4d4d4',
                }}
            />
        </Box>
    );
}

export default JsonView;
