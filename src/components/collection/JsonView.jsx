import React, { useRef, useEffect } from 'react';
import { Box, Typography, useTheme } from '@mui/material';

function JsonView({
    jsonEditData,
    setJsonEditData,
    setJsonHasChanges,
}) {
    const theme = useTheme();
    const textareaRef = useRef(null);
    const lineNumbersRef = useRef(null);
    const isDark = theme.palette.mode === 'dark';
    const editorColors = theme.custom.editor;

    // Count lines
    const lineCount = (jsonEditData || '').split('\n').length;

    // Sync scroll between textarea and line numbers
    const handleScroll = (e) => {
        if (lineNumbersRef.current) {
            lineNumbersRef.current.scrollTop = e.target.scrollTop;
        }
    };

    // Generate line numbers
    const lineNumbers = Array.from({ length: Math.max(lineCount, 20) }, (_, i) => i + 1);

    return (
        <Box sx={{
            flexGrow: 1,
            display: 'flex',
            flexDirection: 'column',
            bgcolor: editorColors.bg,
            borderTop: 1,
            borderColor: 'divider',
        }}>
            {/* Editor Header */}
            <Box sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                px: 2,
                py: 0.5,
                bgcolor: editorColors.gutter,
                borderBottom: 1,
                borderColor: 'divider',
            }}>
                <Typography sx={{
                    fontSize: '0.75rem',
                    color: 'text.secondary',
                    fontFamily: '"Cascadia Code", "Fira Code", Consolas, monospace',
                }}>
                    JSON Editor
                </Typography>
                <Typography sx={{
                    fontSize: '0.7rem',
                    color: 'text.disabled',
                }}>
                    {lineCount} lines
                </Typography>
            </Box>

            {/* Editor Body with Line Numbers */}
            <Box sx={{
                flexGrow: 1,
                display: 'flex',
                overflow: 'hidden',
                position: 'relative',
            }}>
                {/* Line Numbers Gutter */}
                <Box
                    ref={lineNumbersRef}
                    sx={{
                        width: 50,
                        minWidth: 50,
                        bgcolor: editorColors.gutter,
                        borderRight: 1,
                        borderColor: 'divider',
                        overflow: 'hidden',
                        py: 1,
                        userSelect: 'none',
                    }}
                >
                    {lineNumbers.map((num) => (
                        <Box
                            key={num}
                            sx={{
                                height: '1.4em',
                                lineHeight: '1.4em',
                                textAlign: 'right',
                                pr: 1.5,
                                fontSize: '0.8rem',
                                fontFamily: '"Cascadia Code", "Fira Code", Consolas, monospace',
                                color: editorColors.lineNumber,
                            }}
                        >
                            {num}
                        </Box>
                    ))}
                </Box>

                {/* Text Editor */}
                <textarea
                    ref={textareaRef}
                    value={jsonEditData}
                    onChange={(e) => {
                        setJsonEditData(e.target.value);
                        setJsonHasChanges(true);
                    }}
                    onScroll={handleScroll}
                    spellCheck={false}
                    style={{
                        flexGrow: 1,
                        fontFamily: '"Cascadia Code", "Fira Code", "JetBrains Mono", Consolas, "Courier New", monospace',
                        fontSize: '0.8rem',
                        lineHeight: '1.4em',
                        border: 'none',
                        outline: 'none',
                        padding: '8px 16px',
                        resize: 'none',
                        backgroundColor: editorColors.bg,
                        color: theme.palette.text.primary,
                        caretColor: theme.palette.primary.main,
                        tabSize: 2,
                        whiteSpace: 'pre',
                        overflowX: 'auto',
                        overflowY: 'auto',
                    }}
                    placeholder="Enter JSON data..."
                />
            </Box>
        </Box>
    );
}

export default JsonView;
