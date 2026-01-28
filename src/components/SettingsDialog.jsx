import React from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Box,
    Typography,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    TextField,
    Switch,
    FormControlLabel,
    Divider,
    IconButton,
    useTheme,
} from '@mui/material';
import {
    Close as CloseIcon,
    DarkMode as DarkModeIcon,
    LightMode as LightModeIcon,
    SettingsBrightness as AutoModeIcon,
} from '@mui/icons-material';
import { useSettings } from '../context/SettingsContext';

function SettingsDialog({ open, onClose }) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const { settings, updateSetting, resetSettings } = useSettings();

    const ThemeButton = ({ value, icon: Icon, label }) => (
        <Box
            onClick={() => updateSetting('theme', value)}
            sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                p: 2,
                border: '2px solid',
                borderColor: settings.theme === value ? 'primary.main' : (isDark ? '#444' : '#e0e0e0'),
                borderRadius: 2,
                cursor: 'pointer',
                minWidth: 80,
                backgroundColor: isDark ? '#333' : '#fff',
                '&:hover': {
                    borderColor: settings.theme === value ? 'primary.main' : (isDark ? '#555' : '#bdbdbd'),
                    backgroundColor: isDark ? '#3d3d3d' : '#f5f5f5',
                },
            }}
        >
            <Icon sx={{ fontSize: 28, mb: 0.5, color: settings.theme === value ? 'primary.main' : (isDark ? '#aaa' : '#666') }} />
            <Typography variant="caption" sx={{ color: settings.theme === value ? 'primary.main' : (isDark ? '#aaa' : '#666') }}>
                {label}
            </Typography>
        </Box>
    );

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box component="span">Settings</Box>
                <IconButton onClick={onClose} size="small">
                    <CloseIcon />
                </IconButton>
            </DialogTitle>

            <DialogContent dividers>
                {/* Theme Section */}
                <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
                    Appearance
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                    <ThemeButton value="light" icon={LightModeIcon} label="Light" />
                    <ThemeButton value="dark" icon={DarkModeIcon} label="Dark" />
                    <ThemeButton value="auto" icon={AutoModeIcon} label="Auto" />
                </Box>

                <Divider sx={{ my: 2 }} />

                {/* Default Settings Section */}
                <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
                    Default Settings
                </Typography>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <TextField
                        label="Default Document Limit"
                        type="number"
                        value={settings.defaultDocLimit}
                        onChange={(e) => updateSetting('defaultDocLimit', parseInt(e.target.value) || 50)}
                        size="small"
                        inputProps={{ min: 1, max: 1000 }}
                        helperText="Number of documents to fetch by default (1-1000)"
                    />

                    <FormControl size="small">
                        <InputLabel>Default View Type</InputLabel>
                        <Select
                            value={settings.defaultViewType}
                            label="Default View Type"
                            onChange={(e) => updateSetting('defaultViewType', e.target.value)}
                        >
                            <MenuItem value="table">Table</MenuItem>
                            <MenuItem value="tree">Tree</MenuItem>
                            <MenuItem value="json">JSON</MenuItem>
                        </Select>
                    </FormControl>

                    <FormControl size="small">
                        <InputLabel>Font Size</InputLabel>
                        <Select
                            value={settings.fontSize}
                            label="Font Size"
                            onChange={(e) => updateSetting('fontSize', e.target.value)}
                        >
                            <MenuItem value="small">Small</MenuItem>
                            <MenuItem value="medium">Medium</MenuItem>
                            <MenuItem value="large">Large</MenuItem>
                        </Select>
                    </FormControl>
                </Box>

                <Divider sx={{ my: 2 }} />

                {/* Behavior Section */}
                <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
                    Behavior
                </Typography>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <FormControlLabel
                        control={
                            <Switch
                                checked={settings.autoExpandDocuments}
                                onChange={(e) => updateSetting('autoExpandDocuments', e.target.checked)}
                            />
                        }
                        label="Auto-expand documents in tree view"
                    />
                    <FormControlLabel
                        control={
                            <Switch
                                checked={settings.showTypeColumn}
                                onChange={(e) => updateSetting('showTypeColumn', e.target.checked)}
                            />
                        }
                        label="Show Type column in tree view"
                    />
                </Box>
            </DialogContent>

            <DialogActions sx={{ p: 2 }}>
                <Button onClick={resetSettings} color="inherit">
                    Reset to Defaults
                </Button>
                <Box sx={{ flexGrow: 1 }} />
                <Button onClick={onClose} variant="contained">
                    Done
                </Button>
            </DialogActions>
        </Dialog>
    );
}

export default SettingsDialog;
