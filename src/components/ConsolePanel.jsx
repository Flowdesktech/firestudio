import React, { useState, useRef, useEffect } from 'react';
import {
    Box,
    Typography,
    IconButton,
    Button,
    TextField,
    Drawer,
    Divider,
    Chip,
    useTheme,
} from '@mui/material';
import {
    Close as CloseIcon,
    PlayArrow as RunIcon,
    Delete as ClearIcon,
    Terminal as TerminalIcon,
    ContentCopy as CopyIcon,
} from '@mui/icons-material';

function ConsolePanel({ open, onClose, projects, addLog }) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const [selectedProject, setSelectedProject] = useState(null);
    const [running, setRunning] = useState(false);
    const resultsEndRef = useRef(null);

    useEffect(() => {
        if (projects.length > 0 && !selectedProject) {
            setSelectedProject(projects[0]);
        }
    }, [projects]);

    useEffect(() => {
        resultsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [results]);

    const addResult = (type, content) => {
        setResults(prev => [...prev, {
            id: Date.now(),
            type,
            content,
            timestamp: new Date().toLocaleTimeString()
        }]);
    };

    const handleRun = async () => {
        if (!query.trim() || !selectedProject) return;

        setRunning(true);
        addResult('command', query);

        try {
            // Parse and execute simple commands
            const trimmedQuery = query.trim();

            // Handle different query types
            if (trimmedQuery.startsWith('db.collection(')) {
                // Parse collection query
                const match = trimmedQuery.match(/db\.collection\(['"](.+?)['"]\)/);
                if (match) {
                    const collectionPath = match[1];

                    // Check for .get()
                    if (trimmedQuery.includes('.get()')) {
                        // Extract limit if present
                        const limitMatch = trimmedQuery.match(/\.limit\((\d+)\)/);
                        const limit = limitMatch ? parseInt(limitMatch[1]) : 50;

                        // Switch to this project
                        await window.electronAPI.disconnectFirebase();
                        await window.electronAPI.connectFirebase(selectedProject.serviceAccountPath);

                        const result = await window.electronAPI.getDocuments({
                            collectionPath,
                            limit
                        });

                        if (result.success) {
                            addResult('success', `Found ${result.documents.length} documents`);
                            addResult('data', JSON.stringify(result.documents, null, 2));
                            addLog?.('success', `Console: Fetched ${result.documents.length} docs from ${collectionPath}`);
                        } else {
                            addResult('error', result.error);
                        }
                    } else {
                        addResult('info', `Collection reference: ${collectionPath}`);
                    }
                }
            } else if (trimmedQuery.startsWith('db.doc(')) {
                // Parse document query
                const match = trimmedQuery.match(/db\.doc\(['"](.+?)['"]\)/);
                if (match) {
                    const documentPath = match[1];

                    await window.electronAPI.disconnectFirebase();
                    await window.electronAPI.connectFirebase(selectedProject.serviceAccountPath);

                    const result = await window.electronAPI.getDocument(documentPath);

                    if (result.success) {
                        addResult('success', `Document found: ${documentPath}`);
                        addResult('data', JSON.stringify(result.document, null, 2));
                    } else {
                        addResult('error', result.error);
                    }
                }
            } else if (trimmedQuery === 'help') {
                addResult('info', `Available commands:
• db.collection("path").get() - Get documents from a collection
• db.collection("path").limit(n).get() - Get n documents
• db.doc("path").get() - Get a single document
• clear - Clear console output
• help - Show this help message`);
            } else if (trimmedQuery === 'clear') {
                setResults([]);
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

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleRun();
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
    };

    return (
        <Drawer
            anchor="bottom"
            open={open}
            onClose={onClose}
            sx={{
                '& .MuiDrawer-paper': {
                    height: '50vh',
                    backgroundColor: isDark ? '#1e1e1e' : '#fff',
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
                        borderBottom: `1px solid ${isDark ? '#333' : '#e0e0e0'}`,
                    }}
                >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <TerminalIcon sx={{ color: isDark ? '#888' : '#666' }} />
                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                            Console
                        </Typography>
                        {selectedProject && (
                            <Chip
                                label={selectedProject.projectId}
                                size="small"
                                sx={{ ml: 1 }}
                            />
                        )}
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Button
                            size="small"
                            startIcon={<ClearIcon />}
                            onClick={() => setResults([])}
                            disabled={results.length === 0}
                        >
                            Clear
                        </Button>
                        <IconButton onClick={onClose} size="small">
                            <CloseIcon />
                        </IconButton>
                    </Box>
                </Box>

                {/* Project Selector */}
                {projects.length > 1 && (
                    <Box sx={{ px: 2, py: 1, borderBottom: `1px solid ${isDark ? '#333' : '#e0e0e0'}` }}>
                        <Typography variant="caption" sx={{ color: isDark ? '#888' : '#666', mr: 1 }}>
                            Project:
                        </Typography>
                        {projects.map(p => (
                            <Chip
                                key={p.id}
                                label={p.projectId}
                                size="small"
                                onClick={() => setSelectedProject(p)}
                                variant={selectedProject?.id === p.id ? 'filled' : 'outlined'}
                                sx={{ mr: 0.5 }}
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
                        fontFamily: 'monospace',
                        fontSize: '0.85rem',
                    }}
                >
                    {results.length === 0 ? (
                        <Box sx={{ color: isDark ? '#666' : '#999', textAlign: 'center', mt: 4 }}>
                            <Typography variant="body2">
                                Type a command and press Enter to run
                            </Typography>
                            <Typography variant="caption" sx={{ display: 'block', mt: 1 }}>
                                Type 'help' for available commands
                            </Typography>
                        </Box>
                    ) : (
                        results.map((result) => (
                            <Box key={result.id} sx={{ mb: 1 }}>
                                {result.type === 'command' && (
                                    <Box sx={{ display: 'flex', alignItems: 'center', color: '#4fc3f7' }}>
                                        <Typography component="span" sx={{ mr: 1 }}>{'>'}</Typography>
                                        <Typography component="span">{result.content}</Typography>
                                    </Box>
                                )}
                                {result.type === 'success' && (
                                    <Typography sx={{ color: '#81c784' }}>{result.content}</Typography>
                                )}
                                {result.type === 'error' && (
                                    <Typography sx={{ color: '#e57373' }}>Error: {result.content}</Typography>
                                )}
                                {result.type === 'info' && (
                                    <Typography sx={{ color: isDark ? '#aaa' : '#666', whiteSpace: 'pre-wrap' }}>
                                        {result.content}
                                    </Typography>
                                )}
                                {result.type === 'data' && (
                                    <Box sx={{ position: 'relative' }}>
                                        <IconButton
                                            size="small"
                                            onClick={() => copyToClipboard(result.content)}
                                            sx={{ position: 'absolute', right: 0, top: 0 }}
                                        >
                                            <CopyIcon fontSize="small" />
                                        </IconButton>
                                        <Box
                                            component="pre"
                                            sx={{
                                                backgroundColor: isDark ? '#2d2d2d' : '#f5f5f5',
                                                p: 1,
                                                borderRadius: 1,
                                                overflow: 'auto',
                                                maxHeight: 200,
                                                fontSize: '0.8rem',
                                                color: isDark ? '#d4d4d4' : '#333',
                                            }}
                                        >
                                            {result.content}
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
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        p: 1,
                        borderTop: `1px solid ${isDark ? '#333' : '#e0e0e0'}`,
                        backgroundColor: isDark ? '#252526' : '#fafafa',
                    }}
                >
                    <Typography sx={{ color: '#4fc3f7', mr: 1, fontFamily: 'monospace' }}>{'>'}</Typography>
                    <TextField
                        fullWidth
                        size="small"
                        placeholder='db.collection("users").limit(10).get()'
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={running || !selectedProject}
                        sx={{
                            '& .MuiInputBase-input': {
                                fontFamily: 'monospace',
                                fontSize: '0.9rem',
                            },
                        }}
                    />
                    <Button
                        variant="contained"
                        size="small"
                        onClick={handleRun}
                        disabled={running || !query.trim() || !selectedProject}
                        startIcon={<RunIcon />}
                        sx={{ ml: 1 }}
                    >
                        Run
                    </Button>
                </Box>
            </Box>
        </Drawer>
    );
}

export default ConsolePanel;
