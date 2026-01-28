import React, { useState, useRef, useEffect } from 'react';
import {
    Box,
    Typography,
    IconButton,
    Tooltip,
    Chip,
    Collapse,
    useTheme,
} from '@mui/material';
import {
    Terminal as TerminalIcon,
    Delete as ClearIcon,
    ExpandMore as ExpandMoreIcon,
    ExpandLess as ExpandLessIcon,
    CheckCircle as SuccessIcon,
    Error as ErrorIcon,
    Info as InfoIcon,
    Warning as WarningIcon,
} from '@mui/icons-material';

function LogsPanel({ logs, onClear }) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const [expanded, setExpanded] = useState(true);
    const logsEndRef = useRef(null);

    useEffect(() => {
        if (logsEndRef.current && expanded) {
            logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs, expanded]);

    const getLogIcon = (type) => {
        switch (type) {
            case 'success':
                return <SuccessIcon sx={{ fontSize: 14, color: '#4caf50' }} />;
            case 'error':
                return <ErrorIcon sx={{ fontSize: 14, color: '#f44336' }} />;
            case 'warning':
                return <WarningIcon sx={{ fontSize: 14, color: '#ff9800' }} />;
            default:
                return <InfoIcon sx={{ fontSize: 14, color: '#2196f3' }} />;
        }
    };

    const getLogColor = (type) => {
        switch (type) {
            case 'success':
                return '#4caf50';
            case 'error':
                return '#f44336';
            case 'warning':
                return '#ff9800';
            default:
                return '#2196f3';
        }
    };

    const formatTimestamp = (timestamp) => {
        return new Date(timestamp).toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            fractionalSecondDigits: 3,
        });
    };

    return (
        <Box
            sx={{
                borderTop: `1px solid ${isDark ? '#333' : '#e0e0e0'}`,
                backgroundColor: isDark ? '#1e1e1e' : '#fafafa',
                maxHeight: expanded ? 200 : 36,
                transition: 'max-height 0.3s ease',
                display: 'flex',
                flexDirection: 'column',
            }}
        >
            {/* Header */}
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    px: 2,
                    py: 0.5,
                    borderBottom: expanded ? `1px solid ${isDark ? '#333' : '#e0e0e0'}` : 'none',
                    cursor: 'pointer',
                    '&:hover': {
                        backgroundColor: isDark ? '#252526' : '#f0f0f0',
                    },
                }}
                onClick={() => setExpanded(!expanded)}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <TerminalIcon sx={{ fontSize: 16, color: isDark ? '#888' : '#666' }} />
                    <Typography variant="caption" sx={{ color: isDark ? '#ccc' : '#333', fontWeight: 600 }}>
                        LOGS
                    </Typography>
                    {logs.length > 0 && (
                        <Chip
                            label={logs.length}
                            size="small"
                            sx={{
                                height: 16,
                                fontSize: '0.65rem',
                                backgroundColor: isDark ? 'rgba(33, 150, 243, 0.3)' : 'rgba(33, 150, 243, 0.2)',
                                color: '#2196f3',
                            }}
                        />
                    )}
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    {logs.length > 0 && (
                        <Tooltip title="Clear logs">
                            <IconButton
                                size="small"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onClear();
                                }}
                                sx={{ color: isDark ? '#888' : '#666', mr: 0.5 }}
                            >
                                <ClearIcon sx={{ fontSize: 14 }} />
                            </IconButton>
                        </Tooltip>
                    )}
                    {expanded ? (
                        <ExpandMoreIcon sx={{ fontSize: 16, color: isDark ? '#888' : '#666' }} />
                    ) : (
                        <ExpandLessIcon sx={{ fontSize: 16, color: isDark ? '#888' : '#666' }} />
                    )}
                </Box>
            </Box>

            {/* Logs Content */}
            <Collapse in={expanded}>
                <Box
                    sx={{
                        flexGrow: 1,
                        overflow: 'auto',
                        maxHeight: 160,
                        fontFamily: 'monospace',
                        fontSize: '0.75rem',
                    }}
                >
                    {logs.length === 0 ? (
                        <Box sx={{ p: 2, textAlign: 'center', color: isDark ? '#666' : '#555' }}>
                            <Typography variant="caption">No logs yet</Typography>
                        </Box>
                    ) : (
                        logs.map((log, index) => (
                            <Box
                                key={index}
                                sx={{
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    px: 2,
                                    py: 0.5,
                                    borderBottom: `1px solid ${isDark ? '#2d2d2d' : '#eee'}`,
                                    '&:hover': {
                                        backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                                    },
                                }}
                            >
                                <Typography
                                    sx={{
                                        color: isDark ? '#666' : '#555',
                                        fontSize: '0.7rem',
                                        width: 85,
                                        flexShrink: 0,
                                        fontFamily: 'monospace',
                                    }}
                                >
                                    {formatTimestamp(log.timestamp)}
                                </Typography>
                                <Box sx={{ mr: 1, mt: 0.25 }}>
                                    {getLogIcon(log.type)}
                                </Box>
                                <Typography
                                    sx={{
                                        color: getLogColor(log.type),
                                        fontSize: '0.75rem',
                                        fontFamily: 'monospace',
                                        wordBreak: 'break-all',
                                    }}
                                >
                                    {log.message}
                                </Typography>
                                {log.details && (
                                    <Typography
                                        sx={{
                                            color: isDark ? '#888' : '#666',
                                            fontSize: '0.7rem',
                                            fontFamily: 'monospace',
                                            ml: 1,
                                        }}
                                    >
                                        {log.details}
                                    </Typography>
                                )}
                            </Box>
                        ))
                    )}
                    <div ref={logsEndRef} />
                </Box>
            </Collapse>
        </Box>
    );
}

export default LogsPanel;
