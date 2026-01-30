import React, { useRef, useMemo, useCallback, useEffect, useState } from 'react';
import { Box, Typography, useTheme, Chip, IconButton, Tooltip, Paper, List, ListItem, ListItemText } from '@mui/material';
import {
    Code as CodeIcon,
    PlayArrow as RunIcon,
    Save as SaveIcon,
} from '@mui/icons-material';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import { jsEditorCompletions } from '../../utils/completions';

// Register JavaScript language
hljs.registerLanguage('javascript', javascript);

function JsQueryEditor({ jsQuery, setJsQuery, projectId, collectionPath, fieldNames = [] }) {
    const theme = useTheme();
    const textareaRef = useRef(null);
    const highlightRef = useRef(null);
    const lineNumbersRef = useRef(null);
    const isDark = theme.palette.mode === 'dark';
    const editorColors = theme.custom.editor;
    const syntaxColors = theme.custom.syntax;

    // Autocomplete state
    const [showAutocomplete, setShowAutocomplete] = useState(false);
    const [autocompleteItems, setAutocompleteItems] = useState([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [autocompletePosition, setAutocompletePosition] = useState({ top: 0, left: 0 });
    const [currentTrigger, setCurrentTrigger] = useState('');

    // Undo/Redo history
    const [undoStack, setUndoStack] = useState([]);
    const [redoStack, setRedoStack] = useState([]);
    const lastValueRef = useRef(jsQuery || '');

    // Count lines
    const lineCount = (jsQuery || '').split('\n').length;

    // Highlighted code using highlight.js
    const highlightedCode = useMemo(() => {
        if (!jsQuery) return '';
        try {
            const result = hljs.highlight(jsQuery, { language: 'javascript' });
            return result.value;
        } catch {
            return jsQuery.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        }
    }, [jsQuery]);

    // Sync scroll between textarea, highlighted code, and line numbers
    const handleScroll = useCallback((e) => {
        if (lineNumbersRef.current) {
            lineNumbersRef.current.scrollTop = e.target.scrollTop;
        }
        if (highlightRef.current) {
            highlightRef.current.scrollTop = e.target.scrollTop;
            highlightRef.current.scrollLeft = e.target.scrollLeft;
        }
        // Hide autocomplete on scroll
        setShowAutocomplete(false);
    }, []);

    // Generate line numbers
    const lineNumbers = Array.from({ length: Math.max(lineCount, 8) }, (_, i) => i + 1);

    // Get word at cursor for autocomplete (includes quotes for field names)
    const getWordAtCursor = useCallback((text, cursorPos) => {
        const textBefore = text.substring(0, cursorPos);
        // Find the start of current word/trigger (include ' for quoted strings)
        const match = textBefore.match(/['"]?[\w.]*$/);
        return match ? match[0] : '';
    }, []);

    // Generate dynamic completions from field names
    const dynamicCompletions = useMemo(() => {
        const completions = [];

        // Add field name completions (for use in where, orderBy, select)
        fieldNames.forEach(field => {
            // Field as string with single quote
            completions.push({
                trigger: `'${field}`,
                suggestion: `'`,
                cursorOffset: 0,
                description: `Field: ${field}`,
                fullMatch: `'${field}'`,
                isField: true,
            });
            // Field as string with double quote
            completions.push({
                trigger: `"${field}`,
                suggestion: `"`,
                cursorOffset: 0,
                description: `Field: ${field}`,
                fullMatch: `"${field}"`,
                isField: true,
            });
            // Field without quotes (for property access)
            completions.push({
                trigger: field,
                suggestion: '',
                cursorOffset: 0,
                description: `Field: ${field}`,
                fullMatch: field,
                isField: true,
            });
        });

        // Add current collection as suggestion (single and double quotes)
        if (collectionPath) {
            completions.push({
                trigger: `'${collectionPath}`,
                suggestion: `'`,
                cursorOffset: 0,
                description: `Current collection`,
                fullMatch: `'${collectionPath}'`,
                isCollection: true,
            });
            completions.push({
                trigger: `"${collectionPath}`,
                suggestion: `"`,
                cursorOffset: 0,
                description: `Current collection`,
                fullMatch: `"${collectionPath}"`,
                isCollection: true,
            });
        }

        return completions;
    }, [fieldNames, collectionPath]);

    // Filter completions based on current input
    const filterCompletions = useCallback((trigger, textBefore = '') => {
        if (!trigger || trigger.length < 1) return [];

        const lowerTrigger = trigger.toLowerCase();

        // Combine static and dynamic completions
        const allCompletions = [...jsEditorCompletions, ...dynamicCompletions];

        // Detect context - are we inside quotes (field/collection name)?
        const insideQuotes = (textBefore.match(/'/g) || []).length % 2 === 1;
        const afterWhere = /\.where\s*\(\s*$/.test(textBefore) || /\.where\s*\(\s*['"]$/.test(textBefore);
        const afterOrderBy = /\.orderBy\s*\(\s*$/.test(textBefore) || /\.orderBy\s*\(\s*['"]$/.test(textBefore);
        const afterCollection = /\.collection\s*\(\s*$/.test(textBefore) || /\.collection\s*\(\s*['"]$/.test(textBefore);

        // If inside quotes after where/orderBy, prioritize field names
        const shouldPrioritizeFields = insideQuotes && (afterWhere || afterOrderBy);
        const shouldPrioritizeCollections = insideQuotes && afterCollection;

        // First, find exact trigger matches
        const exactMatches = allCompletions.filter(c =>
            c.trigger.toLowerCase() === lowerTrigger
        );

        // Then find partial matches
        const partialMatches = allCompletions.filter(c => {
            const lowerT = c.trigger.toLowerCase();
            if (lowerT === lowerTrigger) return false;
            return lowerT.startsWith(lowerTrigger) ||
                (c.fullMatch && c.fullMatch.toLowerCase().includes(lowerTrigger)) ||
                (c.description && c.description.toLowerCase().includes(lowerTrigger));
        });

        // Combine and deduplicate
        let combined = [...exactMatches, ...partialMatches];

        // Sort to prioritize context-specific items
        combined.sort((a, b) => {
            // Prioritize fields/collections based on context
            if (shouldPrioritizeFields) {
                if (a.isField && !b.isField) return -1;
                if (!a.isField && b.isField) return 1;
            }
            if (shouldPrioritizeCollections) {
                if (a.isCollection && !b.isCollection) return -1;
                if (!a.isCollection && b.isCollection) return 1;
            }
            return 0;
        });

        // Deduplicate by fullMatch
        const seen = new Set();
        const deduped = combined.filter(c => {
            const key = c.fullMatch || c.trigger;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        return deduped.slice(0, 12); // Limit to 12 items
    }, [dynamicCompletions]);

    // Calculate autocomplete position based on cursor
    const calculatePosition = useCallback(() => {
        const textarea = textareaRef.current;
        if (!textarea) return { top: 0, left: 0 };

        const cursorPos = textarea.selectionStart;
        const textBefore = (jsQuery || '').substring(0, cursorPos);
        const lines = textBefore.split('\n');
        const currentLineIndex = lines.length - 1;
        const currentLineText = lines[currentLineIndex];

        // Approximate position (character-based)
        const charWidth = 7.8; // Approximate character width in pixels
        const lineHeight = 19.5; // 1.5em * 13px
        const paddingTop = 8;
        const paddingLeft = 16;

        const top = paddingTop + (currentLineIndex * lineHeight) + lineHeight - textarea.scrollTop;
        const left = paddingLeft + (currentLineText.length * charWidth) - textarea.scrollLeft;

        return { top: Math.max(0, top), left: Math.max(0, Math.min(left, 300)) };
    }, [jsQuery]);

    // Push to undo stack (debounced to avoid too many entries)
    const pushToUndoStack = useCallback((value) => {
        if (value !== lastValueRef.current) {
            setUndoStack(prev => [...prev.slice(-50), lastValueRef.current]); // Keep last 50
            setRedoStack([]); // Clear redo on new change
            lastValueRef.current = value;
        }
    }, []);

    // Undo function
    const handleUndo = useCallback(() => {
        if (undoStack.length > 0) {
            const prevValue = undoStack[undoStack.length - 1];
            setUndoStack(prev => prev.slice(0, -1));
            setRedoStack(prev => [...prev, jsQuery || '']);
            lastValueRef.current = prevValue;
            setJsQuery(prevValue);
        }
    }, [undoStack, jsQuery, setJsQuery]);

    // Redo function
    const handleRedo = useCallback(() => {
        if (redoStack.length > 0) {
            const nextValue = redoStack[redoStack.length - 1];
            setRedoStack(prev => prev.slice(0, -1));
            setUndoStack(prev => [...prev, jsQuery || '']);
            lastValueRef.current = nextValue;
            setJsQuery(nextValue);
        }
    }, [redoStack, jsQuery, setJsQuery]);

    // Handle input change
    const handleChange = useCallback((e) => {
        const newValue = e.target.value;

        // Push current value to undo stack before changing
        pushToUndoStack(newValue);

        setJsQuery(newValue);

        // Check for autocomplete
        const cursorPos = e.target.selectionStart;
        const textBefore = newValue.substring(0, cursorPos);
        const trigger = getWordAtCursor(newValue, cursorPos);

        if (trigger && trigger.length >= 1) {
            const items = filterCompletions(trigger, textBefore);
            if (items.length > 0) {
                setAutocompleteItems(items);
                setSelectedIndex(0);
                setCurrentTrigger(trigger);
                setAutocompletePosition(calculatePosition());
                setShowAutocomplete(true);
            } else {
                setShowAutocomplete(false);
            }
        } else {
            setShowAutocomplete(false);
        }
    }, [setJsQuery, getWordAtCursor, filterCompletions, calculatePosition, pushToUndoStack]);

    // Apply selected completion
    const applyCompletion = useCallback((completion) => {
        const textarea = textareaRef.current;
        if (!textarea || !completion) return;

        const cursorPos = textarea.selectionStart;
        const triggerLen = currentTrigger.length;

        // Replace the trigger with full completion
        const fullText = completion.trigger + completion.suggestion;
        const before = (jsQuery || '').substring(0, cursorPos - triggerLen);
        const after = (jsQuery || '').substring(cursorPos);
        const newText = before + fullText + after;

        setJsQuery(newText);
        setShowAutocomplete(false);

        // Set cursor position after completion
        setTimeout(() => {
            const newPos = cursorPos - triggerLen + fullText.length + completion.cursorOffset;
            textarea.selectionStart = newPos;
            textarea.selectionEnd = newPos;
            textarea.focus();
        }, 0);
    }, [jsQuery, setJsQuery, currentTrigger]);

    // Handle keyboard events
    const handleKeyDown = useCallback((e) => {
        if (showAutocomplete) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(prev => Math.min(prev + 1, autocompleteItems.length - 1));
                return;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => Math.max(prev - 1, 0));
                return;
            }
            if (e.key === 'Tab' || e.key === 'Enter') {
                e.preventDefault();
                if (autocompleteItems[selectedIndex]) {
                    applyCompletion(autocompleteItems[selectedIndex]);
                }
                return;
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                setShowAutocomplete(false);
                return;
            }
        } else {
            // Tab without autocomplete - insert spaces
            if (e.key === 'Tab') {
                e.preventDefault();
                const textarea = textareaRef.current;
                if (!textarea) return;

                const cursorPos = textarea.selectionStart;
                const newText = (jsQuery || '').substring(0, cursorPos) + '  ' + (jsQuery || '').substring(cursorPos);
                setJsQuery(newText);

                setTimeout(() => {
                    textarea.selectionStart = cursorPos + 2;
                    textarea.selectionEnd = cursorPos + 2;
                    textarea.focus();
                }, 0);
            }
        }
    }, [showAutocomplete, autocompleteItems, selectedIndex, applyCompletion, jsQuery, setJsQuery]);

    // Save query function
    const saveQuery = useCallback(() => {
        if (jsQuery?.trim()) {
            window.dispatchEvent(new CustomEvent('save-query', {
                detail: { query: jsQuery, projectId, collectionPath }
            }));
        }
    }, [jsQuery, projectId, collectionPath]);

    // Ctrl/Cmd+S, Ctrl+Z, Ctrl+Y keyboard shortcuts
    useEffect(() => {
        const handleGlobalKeyDown = (e) => {
            // Save
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                saveQuery();
            }
            // Undo
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                // Only handle if our editor is focused
                if (document.activeElement === textareaRef.current) {
                    e.preventDefault();
                    handleUndo();
                }
            }
            // Redo (Ctrl+Y or Ctrl+Shift+Z)
            if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
                if (document.activeElement === textareaRef.current) {
                    e.preventDefault();
                    handleRedo();
                }
            }
        };

        window.addEventListener('keydown', handleGlobalKeyDown);
        return () => window.removeEventListener('keydown', handleGlobalKeyDown);
    }, [saveQuery, handleUndo, handleRedo]);

    // Close autocomplete when clicking outside
    useEffect(() => {
        const handleClickOutside = () => setShowAutocomplete(false);
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    return (
        <Box sx={{
            borderBottom: 1,
            borderColor: 'divider',
            bgcolor: editorColors.bg,
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            overflow: 'visible',
        }}>
            {/* Syntax highlighting styles */}
            <style>{`
                .js-editor-highlight .hljs-keyword { color: ${syntaxColors.keyword}; }
                .js-editor-highlight .hljs-string { color: ${syntaxColors.string}; }
                .js-editor-highlight .hljs-number { color: ${syntaxColors.number}; }
                .js-editor-highlight .hljs-function { color: ${syntaxColors.function}; }
                .js-editor-highlight .hljs-title { color: ${syntaxColors.function}; }
                .js-editor-highlight .hljs-comment { color: ${syntaxColors.comment}; font-style: italic; }
                .js-editor-highlight .hljs-operator { color: ${syntaxColors.operator}; }
                .js-editor-highlight .hljs-variable { color: ${syntaxColors.variable}; }
                .js-editor-highlight .hljs-property { color: ${syntaxColors.property}; }
                .js-editor-highlight .hljs-built_in { color: ${syntaxColors.builtin}; }
                .js-editor-highlight .hljs-params { color: ${syntaxColors.variable}; }
                .js-editor-highlight .hljs-literal { color: ${syntaxColors.keyword}; }
                .js-editor-highlight .hljs-attr { color: ${syntaxColors.property}; }
            `}</style>

            {/* Editor Header */}
            <Box sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                px: 2,
                py: 0.75,
                bgcolor: editorColors.gutter,
                borderBottom: 1,
                borderColor: 'divider',
            }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CodeIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                    <Typography sx={{
                        fontSize: '0.75rem',
                        color: 'text.secondary',
                        fontFamily: '"Cascadia Code", "Fira Code", Consolas, monospace',
                        fontWeight: 500,
                    }}>
                        JS Query Editor
                    </Typography>
                    <Chip
                        label="JavaScript"
                        size="small"
                        sx={{
                            height: 18,
                            fontSize: '0.65rem',
                            bgcolor: isDark ? '#3c3c3c' : '#e0e0e0',
                            color: 'text.secondary',
                        }}
                    />
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography sx={{
                        fontSize: '0.7rem',
                        color: 'text.disabled',
                    }}>
                        {lineCount} lines
                    </Typography>
                    <Tooltip title="Save Query (Ctrl+S)">
                        <IconButton
                            size="small"
                            onClick={saveQuery}
                            disabled={!jsQuery?.trim()}
                            sx={{
                                p: 0.5,
                                color: 'text.secondary',
                                cursor: 'pointer',
                                '&:hover': {
                                    color: 'primary.main',
                                    bgcolor: 'action.hover',
                                },
                            }}
                        >
                            <SaveIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                    </Tooltip>
                </Box>
            </Box>

            {/* Editor Body with Line Numbers */}
            <Box sx={{
                display: 'flex',
                height: 160,
                overflow: 'visible',
                position: 'relative',
            }}>
                {/* Line Numbers Gutter */}
                <Box
                    ref={lineNumbersRef}
                    sx={{
                        width: 45,
                        minWidth: 45,
                        bgcolor: editorColors.gutter,
                        borderRight: 1,
                        borderColor: 'divider',
                        overflow: 'hidden',
                        pt: 1,
                        userSelect: 'none',
                    }}
                >
                    {lineNumbers.map((num) => (
                        <Box
                            key={num}
                            sx={{
                                height: '1.5em',
                                lineHeight: '1.5em',
                                textAlign: 'right',
                                pr: 1.5,
                                fontSize: '13px',
                                fontFamily: '"Cascadia Code", "Fira Code", Consolas, monospace',
                                color: editorColors.lineNumber,
                            }}
                        >
                            {num}
                        </Box>
                    ))}
                </Box>

                {/* Code Editor with Syntax Highlighting Overlay */}
                <Box sx={{
                    position: 'relative',
                    flexGrow: 1,
                    overflow: 'visible',
                }}>
                    {/* Highlighted code (background layer) */}
                    <pre
                        ref={highlightRef}
                        className="js-editor-highlight"
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            margin: 0,
                            padding: '8px 16px',
                            fontFamily: '"Cascadia Code", "Fira Code", "JetBrains Mono", Consolas, "Courier New", monospace',
                            fontSize: '13px',
                            lineHeight: '1.5em',
                            backgroundColor: editorColors.bg,
                            color: theme.palette.text.primary,
                            overflow: 'auto',
                            whiteSpace: 'pre',
                            pointerEvents: 'none',
                        }}
                        dangerouslySetInnerHTML={{ __html: highlightedCode || '&nbsp;' }}
                    />

                    {/* Textarea (foreground layer - transparent text) */}
                    <textarea
                        ref={textareaRef}
                        value={jsQuery || ''}
                        onChange={handleChange}
                        onScroll={handleScroll}
                        onKeyDown={handleKeyDown}
                        spellCheck={false}
                        placeholder={`// Write your query here
async function run() {
    // Use 'db' for Firestore reference
    const snapshot = await db
        .collection('users')
        .where('active', '==', true)
        .limit(50)
        .get();
    return snapshot;
}`}
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            fontFamily: '"Cascadia Code", "Fira Code", "JetBrains Mono", Consolas, "Courier New", monospace',
                            fontSize: '13px',
                            lineHeight: '1.5em',
                            border: 'none',
                            outline: 'none',
                            padding: '8px 16px',
                            resize: 'none',
                            backgroundColor: 'transparent',
                            color: 'transparent',
                            caretColor: theme.palette.primary.main,
                            tabSize: 2,
                            whiteSpace: 'pre',
                            overflow: 'auto',
                        }}
                    />

                    {/* Autocomplete Dropdown */}
                    {showAutocomplete && autocompleteItems.length > 0 && (
                        <Paper
                            elevation={16}
                            sx={{
                                position: 'fixed',
                                top: (() => {
                                    const textarea = textareaRef.current;
                                    if (!textarea) return 0;
                                    const rect = textarea.getBoundingClientRect();
                                    return rect.top + autocompletePosition.top;
                                })(),
                                left: (() => {
                                    const textarea = textareaRef.current;
                                    if (!textarea) return 0;
                                    const rect = textarea.getBoundingClientRect();
                                    return rect.left + autocompletePosition.left;
                                })(),
                                minWidth: 300,
                                maxWidth: 450,
                                maxHeight: 220,
                                overflow: 'auto',
                                zIndex: 99999,
                                border: 1,
                                borderColor: 'divider',
                                boxShadow: 8,
                            }}
                        >
                            <List dense sx={{ py: 0.5 }}>
                                {autocompleteItems.map((item, index) => (
                                    <ListItem
                                        key={item.trigger}
                                        onClick={() => applyCompletion(item)}
                                        sx={{
                                            py: 0.5,
                                            px: 1,
                                            cursor: 'pointer',
                                            bgcolor: index === selectedIndex ? 'action.selected' : 'transparent',
                                            '&:hover': {
                                                bgcolor: 'action.hover',
                                            },
                                        }}
                                    >
                                        <ListItemText
                                            primary={
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <Typography
                                                        component="span"
                                                        sx={{
                                                            fontFamily: '"Cascadia Code", monospace',
                                                            fontSize: '0.8rem',
                                                            color: 'primary.main',
                                                            fontWeight: 600,
                                                        }}
                                                    >
                                                        {item.trigger}
                                                    </Typography>
                                                    <Typography
                                                        component="span"
                                                        sx={{
                                                            fontFamily: '"Cascadia Code", monospace',
                                                            fontSize: '0.75rem',
                                                            color: 'text.disabled',
                                                        }}
                                                    >
                                                        {item.suggestion}
                                                    </Typography>
                                                </Box>
                                            }
                                            secondary={item.description}
                                            secondaryTypographyProps={{
                                                sx: { fontSize: '0.7rem', color: 'text.secondary' }
                                            }}
                                        />
                                    </ListItem>
                                ))}
                            </List>
                        </Paper>
                    )}
                </Box>
            </Box>

            {/* Footer with hints */}
            <Box sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                px: 2,
                py: 0.75,
                bgcolor: editorColors.gutter,
                borderTop: 1,
                borderColor: 'divider',
                gap: 2,
            }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <RunIcon sx={{ fontSize: 14, color: theme.palette.success.main }} />
                        <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
                            <kbd style={{
                                backgroundColor: isDark ? '#3c3c3c' : '#e0e0e0',
                                padding: '1px 6px',
                                borderRadius: 3,
                                fontSize: '0.65rem',
                                fontWeight: 600,
                                color: theme.palette.warning.main,
                            }}>F5</kbd> Run
                        </Typography>
                    </Box>
                    <Typography sx={{ fontSize: '0.7rem', color: 'text.disabled' }}>|</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <SaveIcon sx={{ fontSize: 14, color: theme.palette.primary.main }} />
                        <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary' }}>
                            <kbd style={{
                                backgroundColor: isDark ? '#3c3c3c' : '#e0e0e0',
                                padding: '1px 6px',
                                borderRadius: 3,
                                fontSize: '0.65rem',
                                fontWeight: 600,
                                color: theme.palette.primary.main,
                            }}>Ctrl+S</kbd> Save
                        </Typography>
                    </Box>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Box sx={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        bgcolor: theme.palette.success.main,
                    }} />
                    <Typography sx={{ fontSize: '0.65rem', color: theme.palette.success.main }}>
                        Tab/Enter to complete
                    </Typography>
                </Box>
            </Box>
        </Box>
    );
}

export default JsQueryEditor;
