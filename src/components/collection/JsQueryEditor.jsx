import React from 'react';
import { Box, Typography } from '@mui/material';

function JsQueryEditor({ jsQuery, setJsQuery, isDark, borderColor }) {
    return (
        <Box sx={{ borderBottom: `1px solid ${borderColor}`, backgroundColor: isDark ? '#1e1e1e' : '#f8f8f8' }}>
            <textarea
                value={jsQuery}
                onChange={(e) => setJsQuery(e.target.value)}
                style={{
                    width: '100%',
                    height: 160,
                    fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                    fontSize: '13px',
                    lineHeight: '1.5',
                    border: 'none',
                    outline: 'none',
                    padding: 16,
                    resize: 'none',
                    backgroundColor: isDark ? '#1e1e1e' : '#f8f8f8',
                    color: isDark ? '#d4d4d4' : '#333333',
                }}
                spellCheck={false}
            />
            <Box sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                px: 2,
                py: 0.5,
                backgroundColor: isDark ? '#252526' : '#e8e8e8',
                borderTop: `1px solid ${isDark ? '#333' : '#ddd'}`,
            }}>
                <Typography sx={{ fontSize: '0.7rem', color: isDark ? '#888' : '#666' }}>
                    💡 Press <strong style={{ color: isDark ? '#4ec9b0' : '#0d7377' }}>F5</strong> to run your JS Query • Define an <code style={{ color: isDark ? '#dcdcaa' : '#795e26' }}>async function run()</code> that returns a QuerySnapshot
                </Typography>
                <Typography sx={{ fontSize: '0.7rem', color: '#4caf50' }}>
                    ✓ Works with Google OAuth & Service Account
                </Typography>
            </Box>
        </Box>
    );
}

export default JsQueryEditor;
