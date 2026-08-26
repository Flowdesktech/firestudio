import { useEffect, useMemo, useState } from 'react';
import DOMPurify from 'dompurify';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Typography,
} from '@mui/material';

function formatBytes(bytes?: number): string {
  if (!bytes || bytes < 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** unitIndex).toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

export default function UpdateDialog() {
  const [state, setState] = useState<AutoUpdateState | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;

    window.electronAPI
      .getAutoUpdateState()
      .then((initialState) => {
        if (!active) return;
        setState(initialState);
        if (initialState.status !== 'idle') setOpen(true);
      })
      .catch(() => undefined);

    const handleUpdateState = (event: Event) => {
      const nextState = (event as CustomEvent<AutoUpdateState>).detail;
      setState(nextState);
      if (nextState.status !== 'idle') setOpen(true);
    };

    window.addEventListener('auto-update-state', handleUpdateState);
    return () => {
      active = false;
      window.removeEventListener('auto-update-state', handleUpdateState);
    };
  }, []);

  const releaseNotesHtml = useMemo(
    () =>
      DOMPurify.sanitize(state?.releaseNotes || '<p>No release notes were provided.</p>', {
        USE_PROFILES: { html: true },
      }),
    [state?.releaseNotes],
  );

  if (!state || state.status === 'idle') return null;

  const downloading = state.status === 'downloading';
  const downloaded = state.status === 'downloaded';
  const progress = Math.min(100, Math.max(0, state.progress?.percent ?? 0));

  const handleClose = () => {
    if (!downloading) setOpen(false);
  };

  const handleReleaseNotesClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = (event.target as HTMLElement).closest('a');
    if (!target) return;

    const href = target.getAttribute('href');
    if (!href) return;

    event.preventDefault();
    window.electronAPI.openExternal(href);
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      disableEscapeKeyDown={downloading}
      aria-labelledby="update-dialog-title"
    >
      <DialogTitle id="update-dialog-title">
        {downloaded ? 'Update ready' : downloading ? 'Downloading update' : 'Update available'}
      </DialogTitle>

      <DialogContent dividers>
        {state.status === 'error' && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {state.error || 'The update could not be downloaded.'}
          </Alert>
        )}

        <Typography variant="body1" sx={{ mb: 0.5 }}>
          Firestudio {state.version} is available.
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Current version: {state.currentVersion}
        </Typography>

        {downloading || downloaded ? (
          <Box sx={{ py: 1 }}>
            <LinearProgress variant="determinate" value={downloaded ? 100 : progress} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
              <Typography variant="body2" fontWeight={600}>
                {downloaded ? 'Download complete' : `${progress.toFixed(1)}%`}
              </Typography>
              {!downloaded && state.progress && (
                <Typography variant="body2" color="text.secondary">
                  {formatBytes(state.progress.transferred)} / {formatBytes(state.progress.total)}
                  {state.progress.bytesPerSecond ? ` · ${formatBytes(state.progress.bytesPerSecond)}/s` : ''}
                </Typography>
              )}
            </Box>
            {downloaded && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Restart Firestudio to finish installing the update.
              </Typography>
            )}
          </Box>
        ) : (
          <>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              What&apos;s new
            </Typography>
            <Box
              onClick={handleReleaseNotesClick}
              dangerouslySetInnerHTML={{ __html: releaseNotesHtml }}
              sx={{
                maxHeight: 300,
                overflowY: 'auto',
                color: 'text.secondary',
                fontSize: '0.875rem',
                lineHeight: 1.6,
                '& h1, & h2, & h3': { color: 'text.primary', mt: 2, mb: 1 },
                '& h1': { fontSize: '1.25rem' },
                '& h2': { fontSize: '1.1rem' },
                '& h3': { fontSize: '1rem' },
                '& p': { my: 1 },
                '& ul, & ol': { pl: 3 },
                '& a': { color: 'primary.main' },
                '& code': {
                  bgcolor: 'action.hover',
                  borderRadius: 0.5,
                  px: 0.5,
                  fontFamily: 'monospace',
                },
              }}
            />
          </>
        )}
      </DialogContent>

      <DialogActions>
        {downloaded ? (
          <>
            <Button onClick={handleClose}>Later</Button>
            <Button variant="contained" onClick={() => window.electronAPI.installUpdate()}>
              Restart and install
            </Button>
          </>
        ) : downloading ? (
          <Button disabled>Downloading…</Button>
        ) : (
          <>
            <Button onClick={handleClose}>Not now</Button>
            <Button variant="contained" onClick={() => window.electronAPI.downloadUpdate()}>
              {state.status === 'error' ? 'Retry download' : 'Download update'}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
