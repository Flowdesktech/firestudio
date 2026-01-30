import React, { useState, useRef, useEffect } from 'react';
import {
    Box,
    Typography,
    IconButton,
    Tooltip,
    Chip,
    Collapse,
    useTheme,
    alpha,
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
                return <SuccessIcon sx={{ fontSize: 14, color: 'success.main' }} />;
            case 'error':
                return <ErrorIcon sx={{ fontSize: 14, color: 'error.main' }} />;
            case 'warning':
                return <WarningIcon sx={{ fontSize: 14, color: 'warning.main' }} />;
            default:
                return <InfoIcon sx={{ fontSize: 14, color: 'info.main' }} />;
        }
    };

    const getLogColor = (type) => {
        switch (type) {
            case 'success':
                return 'success.main';
            case 'error':
                return 'error.main';
            case 'warning':
                return 'warning.main';
            default:
                return 'info.main';
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
                borderTop: 1,
                borderColor: 'divider',
                bgcolor: 'background.paper',
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
                    borderBottom: expanded ? 1 : 0,
                    borderColor: 'divider',
                    cursor: 'pointer',
                    '&:hover': {
                        backgroundColor: 'action.hover',
                    },
                }}
                onClick={() => setExpanded(!expanded)}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <TerminalIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                    <Typography variant="caption" sx={{ color: 'text.primary', fontWeight: 600 }}>
                        LOGS
                    </Typography>
                    {logs.length > 0 && (
                        <Chip
                            label={logs.length}
                            size="small"
                            sx={{
                                height: 16,
                                fontSize: '0.65rem',
                                bgcolor: (theme) => alpha(theme.palette.info.main, 0.2),
                                color: 'info.main',
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
                                sx={{ color: 'text.secondary', mr: 0.5 }}
                            >
                                <ClearIcon sx={{ fontSize: 14 }} />
                            </IconButton>
                        </Tooltip>
                    )}
                    {expanded ? (
                        <ExpandMoreIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                    ) : (
                        <ExpandLessIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
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
                        <Box sx={{ p: 2, textAlign: 'center', color: 'text.disabled' }}>
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
                                    borderBottom: 1,
                                    borderColor: 'divider',
                                    '&:hover': {
                                        bgcolor: 'action.hover',
                                    },
                                }}
                            >
                                <Typography
                                    sx={{
                                        color: 'text.secondary',
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
                                            color: 'text.secondary',
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
