import React, { useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Box,
    Typography,
    IconButton,
    CircularProgress,
    Tabs,
    Tab,
    useTheme,
    alpha,
} from '@mui/material';
import {
    FolderOpen as FolderOpenIcon,
    Close as CloseIcon,
    Key as KeyIcon,
    Google as GoogleIcon,
} from '@mui/icons-material';

function ConnectionDialog({ open, onClose, onConnect, onGoogleSignIn, loading }) {
    const theme = useTheme();
    // isDark removed, use theme.palette directly
    const [tabIndex, setTabIndex] = useState(0);
    const [serviceAccountPath, setServiceAccountPath] = useState('');

    const handleBrowse = async () => {
        const path = await window.electronAPI.openFileDialog();
        if (path) {
            setServiceAccountPath(path);
        }
    };

    const handleConnect = () => {
        if (serviceAccountPath) {
            onConnect(serviceAccountPath);
        }
    };

    const handleGoogleSignIn = async () => {
        if (onGoogleSignIn) {
            onGoogleSignIn();
        }
    };

    const handleClose = () => {
        if (!loading) {
            setServiceAccountPath('');
            setTabIndex(0);
            onClose();
        }
    };

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            maxWidth="sm"
            fullWidth
        >
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 0 }}>
                <Box component="span">Add Firebase Project</Box>
                <IconButton onClick={handleClose} disabled={loading} size="small">
                    <CloseIcon />
                </IconButton>
            </DialogTitle>

            <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 3 }}>
                <Tabs value={tabIndex} onChange={(_, v) => setTabIndex(v)}>
                    <Tab icon={<GoogleIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Google Sign-In" />
                    <Tab icon={<KeyIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Service Account" />
                </Tabs>
            </Box>

            <DialogContent>
                {tabIndex === 0 ? (
                    /* Google Sign-In Tab */
                    <Box sx={{ py: 2 }}>
                        <Typography variant="body2" sx={{ mb: 3, color: 'text.secondary' }}>
                            Sign in with your Google account to access your Firebase projects.
                            This uses OAuth to securely authenticate without storing credentials.
                        </Typography>

                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, my: 4 }}>
                            <Button
                                variant="outlined"
                                size="large"
                                startIcon={loading ? <CircularProgress size={20} /> : <GoogleIcon />}
                                onClick={handleGoogleSignIn}
                                disabled={loading}
                                sx={{
                                    px: 4,
                                    py: 1.5,
                                    borderColor: '#4285f4',
                                    color: '#4285f4',
                                    '&:hover': {
                                        borderColor: '#3367d6',
                                        backgroundColor: 'rgba(66, 133, 244, 0.1)',
                                    },
                                }}
                            >
                                {loading ? 'Signing in...' : 'Sign in with Google'}
                            </Button>
                            {loading && (
                                <Box sx={{ textAlign: 'center' }}>
                                    <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}>
                                        Complete sign-in in your browser, then return here.
                                    </Typography>
                                    <Button
                                        variant="text"
                                        size="small"
                                        onClick={async () => {
                                            if (window.electronAPI?.cancelGoogleSignIn) {
                                                await window.electronAPI.cancelGoogleSignIn();
                                            }
                                        }}
                                        sx={{ color: '#f44336' }}
                                    >
                                        Cancel Sign-In
                                    </Button>
                                </Box>
                            )}
                        </Box>

                        <Box sx={{ p: 2, bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1), borderRadius: 1 }}>
                            <Typography variant="caption" sx={{ color: 'primary.main' }}>
                                <strong>Benefits of Google Sign-In:</strong>
                                <ul style={{ marginTop: 8, paddingLeft: 16, marginBottom: 0 }}>
                                    <li>No need to download service account files</li>
                                    <li>Access multiple projects with one account</li>
                                    <li>Automatic token refresh</li>
                                    <li>Uses your Firebase Console permissions</li>
                                </ul>
                            </Typography>
                        </Box>
                    </Box>
                ) : (
                    /* Service Account Tab */
                    <Box sx={{ py: 2 }}>
                        <Typography variant="body2" sx={{ mb: 3, color: 'text.secondary' }}>
                            Connect using a service account JSON file for full admin access to your Firestore database.
                        </Typography>

                        <Box sx={{ display: 'flex', gap: 1 }}>
                            <TextField
                                fullWidth
                                label="Service Account JSON Path"
                                value={serviceAccountPath}
                                onChange={(e) => setServiceAccountPath(e.target.value)}
                                placeholder="Select or enter the path to your service account JSON file"
                                size="small"
                                disabled={loading}
                            />
                            <Button
                                variant="outlined"
                                onClick={handleBrowse}
                                disabled={loading}
                                startIcon={<FolderOpenIcon />}
                                sx={{ whiteSpace: 'nowrap' }}
                            >
                                Browse
                            </Button>
                        </Box>

                        <Box sx={{ mt: 3, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                                <strong>How to get your service account:</strong>
                                <ol style={{ marginTop: 8, paddingLeft: 16, marginBottom: 0 }}>
                                    <li>Go to <a href="https://console.firebase.google.com" target="_blank" rel="noreferrer" style={{ color: theme.palette.primary.main }}>Firebase Console</a></li>
                                    <li>Select your project</li>
                                    <li>Go to Project Settings (gear icon)</li>
                                    <li>Click on "Service Accounts" tab</li>
                                    <li>Click "Generate new private key"</li>
                                    <li>Save the JSON file securely</li>
                                </ol>
                            </Typography>
                        </Box>
                    </Box>
                )}
            </DialogContent>

            <DialogActions sx={{ p: 2, pt: 0 }}>
                <Button onClick={handleClose} disabled={loading}>
                    Cancel
                </Button>
                {tabIndex === 1 && (
                    <Button
                        variant="contained"
                        onClick={handleConnect}
                        disabled={!serviceAccountPath || loading}
                        startIcon={loading ? <CircularProgress size={16} /> : null}
                    >
                        {loading ? 'Connecting...' : 'Connect'}
                    </Button>
                )}
            </DialogActions>
        </Dialog>
    );
}

export default ConnectionDialog;
