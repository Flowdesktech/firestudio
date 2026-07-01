import { useState } from 'react';
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
  Dns as DnsIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { electronService } from '../../../shared/services/electronService';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../../../app/store';
import { scanEmulators, connectEmulatorProject } from '../store/projectsSlice';
import { addLog } from '../../../app/store/slices/logsSlice';
import { getErrorMessage } from '../../../shared/utils/commonUtils';

interface ConnectionDialogProps {
  open: boolean;
  onClose: () => void;
  /** Connects the service account; additional Firestore databases are added from the sidebar. */
  onConnect: (serviceAccountPath: string) => void;
  onGoogleSignIn?: () => Promise<void>;
  loading: boolean;
}

function ConnectionDialog({ open, onClose, onConnect, onGoogleSignIn, loading }: ConnectionDialogProps) {
  const theme = useTheme();
  const dispatch = useDispatch<AppDispatch>();

  const [tabIndex, setTabIndex] = useState(0);
  const [serviceAccountPath, setServiceAccountPath] = useState('');

  const [emulators, setEmulators] = useState<
    Array<{ projectId: string; host: string; port: number; services?: Record<string, { host: string; port: number }> }>
  >([]);
  const [emulatorsLoading, setEmulatorsLoading] = useState(false);
  const [connectingEmulatorId, setConnectingEmulatorId] = useState<string | null>(null);

  const fetchEmulators = async () => {
    setEmulatorsLoading(true);
    try {
      const result = await dispatch(scanEmulators()).unwrap();
      setEmulators(result.emulators || []);
    } catch (err) {
      dispatch(addLog({ type: 'error', message: 'Failed to scan for emulators: ' + getErrorMessage(err) }));
    } finally {
      setEmulatorsLoading(false);
    }
  };

  const handleConnectEmulator = async (emulator: {
    projectId: string;
    host: string;
    port: number;
    services?: Record<string, { host: string; port: number }>;
  }) => {
    const id = `${emulator.projectId}-${emulator.port}`;
    setConnectingEmulatorId(id);
    try {
      const result = await dispatch(connectEmulatorProject(emulator)).unwrap();
      if (result.mode === 'create') {
        dispatch(addLog({ type: 'success', message: `Connected to emulator for project ${emulator.projectId}` }));
      } else {
        dispatch(addLog({ type: 'success', message: `Emulator ${emulator.projectId} already connected` }));
      }
      onClose();
    } catch (err) {
      dispatch(addLog({ type: 'error', message: 'Failed to connect emulator: ' + getErrorMessage(err) }));
    } finally {
      setConnectingEmulatorId(null);
    }
  };

  const handleBrowse = async () => {
    const path = await electronService.api.openFileDialog();
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
      await onGoogleSignIn();
    }
  };

  const handleClose = () => {
    if (!loading && !connectingEmulatorId) {
      setServiceAccountPath('');
      setTabIndex(0);
      setEmulators([]);
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
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
          <Tab icon={<DnsIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Local Emulator" />
        </Tabs>
      </Box>

      <DialogContent>
        {tabIndex === 0 ? (
          /* Google Sign-In Tab */
          <Box sx={{ py: 2 }}>
            <Typography variant="body2" sx={{ mb: 3, color: 'text.secondary' }}>
              Sign in with your Google account to access your Firebase projects. This uses OAuth to securely
              authenticate without storing credentials.
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
                      await electronService.api.cancelGoogleSignIn?.();
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
        ) : tabIndex === 1 ? (
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

            <Typography variant="caption" sx={{ display: 'block', mt: 2, color: 'text.secondary' }}>
              After connecting, add other Firestore databases (dev, prod, etc.) from the sidebar under{' '}
              <strong>Firestore</strong> → <strong>Add database</strong>.
            </Typography>

            <Box sx={{ mt: 3, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                <strong>How to get your service account:</strong>
                <ol style={{ marginTop: 8, paddingLeft: 16, marginBottom: 0 }}>
                  <li>
                    Go to{' '}
                    <a
                      href="https://console.firebase.google.com"
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: theme.palette.primary.main }}
                    >
                      Firebase Console
                    </a>
                  </li>
                  <li>Select your project</li>
                  <li>Go to Project Settings (gear icon)</li>
                  <li>Click on &quot;Service Accounts&quot; tab</li>
                  <li>Click &quot;Generate new private key&quot;</li>
                  <li>Save the JSON file securely</li>
                </ol>
              </Typography>
            </Box>
          </Box>
        ) : (
          /* Local Emulator Tab */
          <Box sx={{ py: 2 }}>
            <Typography variant="body2" sx={{ mb: 3, color: 'text.secondary' }}>
              Connect to a locally running Firebase Emulator Suite instance.
            </Typography>

            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, mb: 4 }}>
              <Button
                variant="outlined"
                size="large"
                startIcon={emulatorsLoading ? <CircularProgress size={20} /> : <RefreshIcon />}
                onClick={fetchEmulators}
                disabled={emulatorsLoading}
                sx={{ px: 4, py: 1.5 }}
              >
                {emulatorsLoading ? 'Scanning...' : 'Scan for emulators'}
              </Button>
            </Box>

            {emulators.length > 0 && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Typography variant="subtitle2" sx={{ color: 'text.secondary', mb: 1 }}>
                  Discovered Emulators
                </Typography>
                {emulators.map((emulator) => {
                  const id = `${emulator.projectId}-${emulator.port}`;
                  const isConnecting = connectingEmulatorId === id;
                  return (
                    <Box
                      key={id}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        p: 2,
                        border: 1,
                        borderColor: 'divider',
                        borderRadius: 1,
                        bgcolor: 'background.paper',
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <DnsIcon color="primary" />
                        <Box>
                          <Typography variant="body2" fontWeight="500">
                            {emulator.projectId}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Host: {emulator.host}:{emulator.port}
                          </Typography>
                        </Box>
                      </Box>
                      <Button
                        variant="contained"
                        size="small"
                        onClick={() => handleConnectEmulator(emulator)}
                        disabled={isConnecting || loading}
                      >
                        {isConnecting ? 'Connecting...' : 'Connect'}
                      </Button>
                    </Box>
                  );
                })}
              </Box>
            )}

            {emulatorsLoading === false && emulators.length === 0 && (
              <Typography color="text.secondary" align="center" sx={{ py: 2 }}>
                No running Firebase emulators detected.
              </Typography>
            )}
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
