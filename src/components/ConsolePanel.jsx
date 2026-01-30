import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
    Box,
    Typography,
    IconButton,
    Button,
    TextField,
    Drawer,
    Chip,
    useTheme,
} from '@mui/material';
import {
    Close as CloseIcon,
    PlayArrow as RunIcon,
    Delete as ClearIcon,
    Terminal as TerminalIcon,
    ContentCopy as CopyIcon,
    HelpOutline as HelpIcon,
} from '@mui/icons-material';
import hljs from 'highlight.js/lib/core';
import json from 'highlight.js/lib/languages/json';
import { consoleCompletions } from '../utils/completions';
import AutocompletePopover from './AutocompletePopover';

// Register JSON language
hljs.registerLanguage('json', json);

// Highlighted JSON component
function HighlightedJson({ content, syntaxColors }) {
    const highlighted = useMemo(() => {
        try {
            const result = hljs.highlight(content, { language: 'json' });
            return result.value;
        } catch {
            return content.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        }
    }, [content]);

    return (
        <>
            <style>{`
                .console-json .hljs-string { color: ${syntaxColors.string}; }
                .console-json .hljs-number { color: ${syntaxColors.number}; }
                .console-json .hljs-literal { color: ${syntaxColors.literal}; }
                .console-json .hljs-punctuation { color: ${syntaxColors.bracket}; }
                .console-json .hljs-attr { color: ${syntaxColors.key}; }
            `}</style>
            <code
                className="console-json"
                dangerouslySetInnerHTML={{ __html: highlighted }}
            />
        </>
    );
}

function ConsolePanel({ open, onClose, projects, addLog, allCollections = [] }) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [selectedProject, setSelectedProject] = useState(null);
    const [running, setRunning] = useState(false);
    const resultsEndRef = useRef(null);
    const inputRef = useRef(null);

    // Command history
    const [commandHistory, setCommandHistory] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(-1);

    // Autocomplete state
    const [showAutocomplete, setShowAutocomplete] = useState(false);
    const [autocompleteItems, setAutocompleteItems] = useState([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [autocompletePosition, setAutocompletePosition] = useState({ top: 0, left: 0 });
    const [currentTrigger, setCurrentTrigger] = useState('');

    // Undo history
    const [queryHistory, setQueryHistory] = useState([]);
    const [historyPointer, setHistoryPointer] = useState(-1);

    // Generate dynamic collection completions (both single and double quotes)
    const collectionCompletions = useMemo(() => {
        const unique = [...new Set(allCollections)];
        const completions = [];
        unique.forEach(col => {
            // Single quote version
            completions.push({
                trigger: `'${col}`,
                suggestion: `'`,
                cursorOffset: 0,
                description: `Collection: ${col}`,
                isCollection: true,
            });
            // Double quote version
            completions.push({
                trigger: `"${col}`,
                suggestion: `"`,
                cursorOffset: 0,
                description: `Collection: ${col}`,
                isCollection: true,
            });
        });
        return completions;
    }, [allCollections]);

    // Filter completions
    const filterCompletions = useCallback((trigger, textBefore = '') => {
        if (!trigger || trigger.length < 1) return [];
        const lowerTrigger = trigger.toLowerCase();

        // Combine static and collection completions
        const allCompletions = [...consoleCompletions, ...collectionCompletions];

        // Detect context - inside quotes after .collection(
        const insideQuotes = (textBefore.match(/'/g) || []).length % 2 === 1;
        const afterCollection = /\.collection\s*\(\s*['"]?$/.test(textBefore);

        const filtered = allCompletions.filter(c => {
            const lowerT = c.trigger.toLowerCase();
            return lowerT.startsWith(lowerTrigger) || lowerT.includes(lowerTrigger);
        });

        // Sort to prioritize collections when in collection context
        if (insideQuotes && afterCollection) {
            filtered.sort((a, b) => {
                if (a.isCollection && !b.isCollection) return -1;
                if (!a.isCollection && b.isCollection) return 1;
                return 0;
            });
        }

        return filtered.slice(0, 10);
    }, [collectionCompletions]);

    // Get word at cursor (include quote for collection names)
    const getWordAtCursor = useCallback((text) => {
        const match = text.match(/['"]?[\w.]*$/);
        return match ? match[0] : '';
    }, []);

    // Apply completion
    const applyCompletion = useCallback((completion) => {
        if (!completion) return;
        const triggerLen = currentTrigger.length;
        const fullText = completion.trigger + completion.suggestion;
        const before = query.substring(0, query.length - triggerLen);
        const newQuery = before + fullText;

        setQuery(newQuery);
        setShowAutocomplete(false);

        setTimeout(() => {
            if (inputRef.current) {
                const input = inputRef.current.querySelector('input');
                if (input) {
                    const newPos = newQuery.length + completion.cursorOffset;
                    input.selectionStart = newPos;
                    input.selectionEnd = newPos;
                    input.focus();
                }
            }
        }, 0);
    }, [query, currentTrigger]);

    // Flatten all projects including nested Google OAuth projects
    const allProjects = useMemo(() => {
        const flat = [];
        projects.forEach(p => {
            if (p.type === 'googleAccount' && p.projects) {
                p.projects.forEach(proj => flat.push({ ...proj, accountEmail: p.email }));
            } else if (p.authMethod === 'serviceAccount') {
                flat.push(p);
            }
        });
        return flat;
    }, [projects]);

    useEffect(() => {
        if (allProjects.length > 0 && !selectedProject) {
            setSelectedProject(allProjects[0]);
        }
    }, [allProjects]);

    useEffect(() => {
        resultsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [results]);

    const addResult = (type, content) => {
        setResults(prev => [...prev, {
            id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type,
            content,
            timestamp: new Date().toLocaleTimeString()
        }]);
    };

    const handleRun = async () => {
        if (!query.trim() || !selectedProject) return;

        const trimmedQuery = query.trim();

        // Add to command history (avoid duplicates at the end)
        if (commandHistory.length === 0 || commandHistory[commandHistory.length - 1] !== trimmedQuery) {
            setCommandHistory(prev => [...prev, trimmedQuery]);
        }
        setHistoryIndex(-1); // Reset history navigation

        setRunning(true);
        addResult('command', query);

        try {
            if (trimmedQuery === 'help') {
                addResult('info', `Available commands:
• db.collection("path").get() - Get documents from a collection
• db.collection("path").limit(n).get() - Get n documents
• db.doc("collection/docId").get() - Get a single document
• clear - Clear console output
• help - Show this help message

Examples:
  db.collection("users").limit(10).get()
  db.doc("users/user123").get()`);
            } else if (trimmedQuery === 'clear') {
                setResults([]);
            } else if (trimmedQuery.startsWith('db.collection(')) {
                const match = trimmedQuery.match(/db\.collection\(['"](.+?)['"]\)/);
                if (match) {
                    const collectionPath = match[1];

                    if (trimmedQuery.includes('.get()')) {
                        const limitMatch = trimmedQuery.match(/\.limit\((\d+)\)/);
                        const limit = limitMatch ? parseInt(limitMatch[1]) : 50;

                        let result;
                        if (selectedProject.authMethod === 'google') {
                            // Google OAuth project
                            result = await window.electronAPI.googleGetDocuments({
                                projectId: selectedProject.projectId,
                                collectionPath,
                                limit
                            });
                        } else {
                            // Service account project - connect first
                            await window.electronAPI.disconnectFirebase();
                            await window.electronAPI.connectFirebase(selectedProject.serviceAccountPath);
                            result = await window.electronAPI.getDocuments({
                                collectionPath,
                                limit
                            });
                        }

                        if (result.success) {
                            addResult('success', `Found ${result.documents.length} documents in "${collectionPath}"`);
                            addResult('data', JSON.stringify(result.documents, null, 2));
                            addLog?.('success', `Console: Fetched ${result.documents.length} docs from ${collectionPath}`);
                        } else {
                            addResult('error', result.error);
                        }
                    } else {
                        addResult('info', `Collection reference: ${collectionPath}\nAdd .get() to fetch documents.`);
                    }
                } else {
                    addResult('error', 'Invalid collection path. Use: db.collection("path")');
                }
            } else if (trimmedQuery.startsWith('db.doc(')) {
                const match = trimmedQuery.match(/db\.doc\(['"](.+?)['"]\)/);
                if (match) {
                    const documentPath = match[1];

                    let result;
                    if (selectedProject.authMethod === 'google') {
                        // Google OAuth project
                        result = await window.electronAPI.googleGetDocument({
                            projectId: selectedProject.projectId,
                            documentPath
                        });
                    } else {
                        // Service account project - connect first
                        await window.electronAPI.disconnectFirebase();
                        await window.electronAPI.connectFirebase(selectedProject.serviceAccountPath);
                        result = await window.electronAPI.getDocument(documentPath);
                    }

                    if (result.success) {
                        addResult('success', `Document found: ${documentPath}`);
                        addResult('data', JSON.stringify(result.document, null, 2));
                    } else {
                        addResult('error', result.error);
                    }
                } else {
                    addResult('error', 'Invalid document path. Use: db.doc("collection/docId")');
                }
            } else {
                addResult('error', `Unknown command. Type 'help' for available commands.`);
            }
        } catch (error) {
            addResult('error', error.message);
        } finally {
            setRunning(false);
            setQuery('');
        }
    };

    // Handle input change with autocomplete
    const handleInputChange = useCallback((e) => {
        const newValue = e.target.value;
        setQuery(newValue);

        // Check for autocomplete
        const trigger = getWordAtCursor(newValue);
        if (trigger && trigger.length >= 1) {
            const items = filterCompletions(trigger, newValue);
            if (items.length > 0) {
                setAutocompleteItems(items);
                setSelectedIndex(0);
                setCurrentTrigger(trigger);

                // Calculate position - show above input, account for drawer height
                const rect = e.target.getBoundingClientRect();
                const popoverHeight = Math.min(items.length * 50, 220); // Estimate height
                setAutocompletePosition({
                    top: rect.top - popoverHeight - 4,
                    left: rect.left
                });
                setShowAutocomplete(true);
            } else {
                setShowAutocomplete(false);
            }
        } else {
            setShowAutocomplete(false);
        }
    }, [filterCompletions, getWordAtCursor]);

    const handleKeyDown = (e) => {
        // Handle autocomplete navigation
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
            if (e.key === 'Tab' || (e.key === 'Enter' && autocompleteItems.length > 0)) {
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
        }

        // Normal key handling
        if (e.key === 'Enter' && !e.shiftKey && !showAutocomplete) {
            e.preventDefault();
            handleRun();
        } else if (e.key === 'ArrowUp' && !showAutocomplete) {
            e.preventDefault();
            if (commandHistory.length > 0) {
                const newIndex = historyIndex === -1
                    ? commandHistory.length - 1
                    : Math.max(0, historyIndex - 1);
                setHistoryIndex(newIndex);
                setQuery(commandHistory[newIndex]);
            }
        } else if (e.key === 'ArrowDown' && !showAutocomplete) {
            e.preventDefault();
            if (historyIndex !== -1) {
                const newIndex = historyIndex + 1;
                if (newIndex >= commandHistory.length) {
                    setHistoryIndex(-1);
                    setQuery('');
                } else {
                    setHistoryIndex(newIndex);
                    setQuery(commandHistory[newIndex]);
                }
            }
        }
    };

    // Close autocomplete on click outside
    useEffect(() => {
        const handleClickOutside = () => setShowAutocomplete(false);
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
    };

    const commandColor = isDark ? '#58a6ff' : '#0969da';
    const successColor = isDark ? '#7ee787' : '#1a7f37';
    const errorColor = isDark ? '#f85149' : '#cf222e';

    return (
        <Drawer
            anchor="bottom"
            open={open}
            onClose={onClose}
            sx={{
                '& .MuiDrawer-paper': {
                    height: '50vh',
                    bgcolor: 'background.paper',
                    backgroundImage: 'none',
                },
            }}
        >
            <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                {/* Header */}
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        px: 2,
                        py: 1,
                        borderBottom: 1,
                        borderColor: 'divider',
                        bgcolor: 'background.default',
                    }}
                >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <TerminalIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
                        <Typography sx={{ fontSize: '0.9rem', fontWeight: 600 }}>
                            Console
                        </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <IconButton
                            size="small"
                            onClick={() => {
                                setQuery('help');
                                handleRun();
                            }}
                            sx={{ color: 'text.secondary' }}
                        >
                            <HelpIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                            size="small"
                            onClick={() => setResults([])}
                            disabled={results.length === 0}
                            sx={{ color: 'text.secondary' }}
                        >
                            <ClearIcon fontSize="small" />
                        </IconButton>
                        <IconButton onClick={onClose} size="small" sx={{ color: 'text.secondary' }}>
                            <CloseIcon fontSize="small" />
                        </IconButton>
                    </Box>
                </Box>

                {/* Project Selector */}
                {allProjects.length > 0 && (
                    <Box sx={{
                        px: 2,
                        py: 1,
                        borderBottom: 1,
                        borderColor: 'divider',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        flexWrap: 'wrap',
                    }}>
                        <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                            Project:
                        </Typography>
                        {allProjects.map(p => (
                            <Chip
                                key={p.id}
                                label={p.projectId}
                                size="small"
                                onClick={() => setSelectedProject(p)}
                                color={selectedProject?.id === p.id ? 'primary' : 'default'}
                                variant={selectedProject?.id === p.id ? 'filled' : 'outlined'}
                                sx={{
                                    fontSize: '0.75rem',
                                    height: 24,
                                }}
                            />
                        ))}
                    </Box>
                )}

                {/* Results */}
                <Box
                    sx={{
                        flexGrow: 1,
                        overflow: 'auto',
                        p: 2,
                        fontFamily: '"JetBrains Mono", "Fira Code", Consolas, monospace',
                        fontSize: '0.8rem',
                        bgcolor: isDark ? '#0d1117' : '#f6f8fa',
                    }}
                >
                    {results.length === 0 ? (
                        <Box sx={{ color: 'text.disabled', textAlign: 'center', mt: 4 }}>
                            <TerminalIcon sx={{ fontSize: 48, opacity: 0.3, mb: 2 }} />
                            <Typography sx={{ fontSize: '0.85rem' }}>
                                Type a command and press Enter to run
                            </Typography>
                            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mt: 1 }}>
                                Type <code style={{
                                    backgroundColor: isDark ? '#21262d' : '#eaeef2',
                                    padding: '2px 6px',
                                    borderRadius: 4,
                                }}>help</code> for available commands
                            </Typography>
                        </Box>
                    ) : (
                        results.map((result) => (
                            <Box key={result.id} sx={{ mb: 1.5 }}>
                                {result.type === 'command' && (
                                    <Box sx={{ display: 'flex', alignItems: 'flex-start', color: commandColor }}>
                                        <Typography component="span" sx={{
                                            mr: 1,
                                            fontWeight: 600,
                                            userSelect: 'none',
                                        }}>❯</Typography>
                                        <Typography component="span" sx={{ fontFamily: 'inherit' }}>
                                            {result.content}
                                        </Typography>
                                    </Box>
                                )}
                                {result.type === 'success' && (
                                    <Typography sx={{
                                        color: successColor,
                                        pl: 2.5,
                                        fontFamily: 'inherit',
                                    }}>
                                        ✓ {result.content}
                                    </Typography>
                                )}
                                {result.type === 'error' && (
                                    <Typography sx={{
                                        color: errorColor,
                                        pl: 2.5,
                                        fontFamily: 'inherit',
                                    }}>
                                        ✗ {result.content}
                                    </Typography>
                                )}
                                {result.type === 'info' && (
                                    <Typography sx={{
                                        color: 'text.secondary',
                                        whiteSpace: 'pre-wrap',
                                        pl: 2.5,
                                        fontFamily: 'inherit',
                                        lineHeight: 1.6,
                                    }}>
                                        {result.content}
                                    </Typography>
                                )}
                                {result.type === 'data' && (
                                    <Box sx={{ position: 'relative', pl: 2.5 }}>
                                        <IconButton
                                            size="small"
                                            onClick={() => copyToClipboard(result.content)}
                                            sx={{
                                                position: 'absolute',
                                                right: 8,
                                                top: 8,
                                                bgcolor: 'background.paper',
                                                '&:hover': { bgcolor: 'action.hover' },
                                            }}
                                        >
                                            <CopyIcon sx={{ fontSize: 14 }} />
                                        </IconButton>
                                        <Box
                                            component="pre"
                                            sx={{
                                                backgroundColor: isDark ? '#161b22' : '#ffffff',
                                                border: 1,
                                                borderColor: 'divider',
                                                p: 1.5,
                                                pr: 5,
                                                borderRadius: 1,
                                                overflow: 'auto',
                                                maxHeight: 250,
                                                fontSize: '0.75rem',
                                                fontFamily: '"JetBrains Mono", "Fira Code", Consolas, monospace',
                                                m: 0,
                                            }}
                                        >
                                            <HighlightedJson content={result.content} syntaxColors={theme.custom.syntax} />
                                        </Box>
                                    </Box>
                                )}
                            </Box>
                        ))
                    )}
                    <div ref={resultsEndRef} />
                </Box>

                {/* Input */}
                <Box
                    ref={inputRef}
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        p: 1.5,
                        borderTop: 1,
                        borderColor: 'divider',
                        bgcolor: 'background.default',
                        gap: 1,
                        position: 'relative',
                    }}
                >
                    <Typography sx={{
                        color: commandColor,
                        fontFamily: '"JetBrains Mono", "Fira Code", Consolas, monospace',
                        fontWeight: 600,
                        fontSize: '0.9rem',
                    }}>❯</Typography>
                    <TextField
                        fullWidth
                        size="small"
                        placeholder={selectedProject ? 'db.collection("users").limit(10).get()' : 'Connect a project first...'}
                        value={query}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        disabled={running || !selectedProject}
                        sx={{
                            '& .MuiInputBase-input': {
                                fontFamily: '"JetBrains Mono", "Fira Code", Consolas, monospace',
                                fontSize: '0.85rem',
                            },
                            '& .MuiOutlinedInput-root': {
                                bgcolor: 'background.paper',
                            },
                        }}
                    />
                    <Button
                        variant="contained"
                        size="small"
                        onClick={handleRun}
                        disabled={running || !query.trim() || !selectedProject}
                        disableElevation
                        sx={{
                            minWidth: 70,
                            textTransform: 'none',
                            fontWeight: 600,
                        }}
                    >
                        {running ? '...' : 'Run'}
                    </Button>

                    {/* Autocomplete Popover */}
                    <AutocompletePopover
                        show={showAutocomplete}
                        items={autocompleteItems}
                        selectedIndex={selectedIndex}
                        position={autocompletePosition}
                        onSelect={applyCompletion}
                        maxWidth={350}
                    />
                </Box>
            </Box>
        </Drawer>
    );
}

export default ConsolePanel;
