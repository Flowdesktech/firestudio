import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    IconButton,
    Tooltip,
    Button,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    CircularProgress,
    Chip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Menu,
    MenuItem,
    ListItemIcon,
    Divider,
    Avatar,
    useTheme,
    InputAdornment,
} from '@mui/material';
import {
    Refresh as RefreshIcon,
    Add as AddIcon,
    Delete as DeleteIcon,
    MoreVert as MoreVertIcon,
    Email as EmailIcon,
    Phone as PhoneIcon,
    Person as PersonIcon,
    Lock as LockIcon,
    Search as SearchIcon,
    Verified as VerifiedIcon,
    Warning as WarningIcon,
    ContentCopy as CopyIcon,
    Edit as EditIcon,
    Block as BlockIcon,
    CheckCircle as EnableIcon,
} from '@mui/icons-material';

function AuthTab({ project, addLog, showMessage }) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';

    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [selectedUser, setSelectedUser] = useState(null);
    const [menuAnchor, setMenuAnchor] = useState(null);
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [userDetailsOpen, setUserDetailsOpen] = useState(false);
    const [newUserEmail, setNewUserEmail] = useState('');
    const [newUserPassword, setNewUserPassword] = useState('');
    const [newUserDisplayName, setNewUserDisplayName] = useState('');

    // Theme colors
    const borderColor = isDark ? '#333' : '#e0e0e0';
    const bgColor = isDark ? '#1e1e1e' : '#fafafa';
    const hoverBg = isDark ? '#333' : '#f5f5f5';
    const textColor = isDark ? '#ccc' : '#333';
    const mutedColor = isDark ? '#888' : '#666';

    useEffect(() => {
        if (project) {
            loadUsers();
        }
    }, [project]);

    const loadUsers = async () => {
        setLoading(true);
        try {
            let result;

            if (project?.authMethod === 'google') {
                // Use Google OAuth REST API (Identity Platform)
                result = await window.electronAPI.googleListAuthUsers({
                    projectId: project.projectId,
                    maxResults: 1000
                });
            } else {
                // Use Service Account (Admin SDK)
                await window.electronAPI.disconnectFirebase();
                await window.electronAPI.connectFirebase(project.serviceAccountPath);
                result = await window.electronAPI.listAuthUsers();
            }

            if (result.success) {
                setUsers(result.users || []);
                addLog?.('success', `Loaded ${result.users?.length || 0} users`);
            } else {
                showMessage?.(result.error, 'error');
                setUsers([]);
            }
        } catch (error) {
            showMessage?.(error.message, 'error');
            setUsers([]);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateUser = async () => {
        if (!newUserEmail || !newUserPassword) {
            showMessage?.('Email and password are required', 'error');
            return;
        }

        try {
            let result;
            if (project?.authMethod === 'google') {
                result = await window.electronAPI.googleCreateAuthUser({
                    projectId: project.projectId,
                    email: newUserEmail,
                    password: newUserPassword,
                    displayName: newUserDisplayName || null
                });
            } else {
                result = await window.electronAPI.createAuthUser({
                    email: newUserEmail,
                    password: newUserPassword,
                    displayName: newUserDisplayName || null
                });
            }

            if (result.success) {
                addLog?.('success', `Created user ${newUserEmail}`);
                showMessage?.(`Created user ${newUserEmail}`, 'success');
                setCreateDialogOpen(false);
                setNewUserEmail('');
                setNewUserPassword('');
                setNewUserDisplayName('');
                loadUsers();
            } else {
                showMessage?.(result.error, 'error');
            }
        } catch (error) {
            showMessage?.(error.message, 'error');
        }
    };

    const handleDeleteUser = async (user) => {
        handleCloseMenu();
        if (!window.confirm(`Delete user "${user.email || user.uid}"?`)) return;

        try {
            let result;
            if (project?.authMethod === 'google') {
                result = await window.electronAPI.googleDeleteAuthUser({
                    projectId: project.projectId,
                    uid: user.uid
                });
            } else {
                result = await window.electronAPI.deleteAuthUser({ uid: user.uid });
            }

            if (result.success) {
                addLog?.('success', `Deleted user ${user.email || user.uid}`);
                showMessage?.(`Deleted user ${user.email || user.uid}`, 'success');
                loadUsers();
            } else {
                showMessage?.(result.error, 'error');
            }
        } catch (error) {
            showMessage?.(error.message, 'error');
        }
    };

    const handleDisableUser = async (user) => {
        handleCloseMenu();
        try {
            let result;
            if (project?.authMethod === 'google') {
                result = await window.electronAPI.googleUpdateAuthUser({
                    projectId: project.projectId,
                    uid: user.uid,
                    disabled: !user.disabled
                });
            } else {
                result = await window.electronAPI.updateAuthUser({
                    uid: user.uid,
                    disabled: !user.disabled
                });
            }

            if (result.success) {
                const action = user.disabled ? 'enabled' : 'disabled';
                addLog?.('success', `User ${user.email || user.uid} ${action}`);
                showMessage?.(`User ${action}`, 'success');
                loadUsers();
            } else {
                showMessage?.(result.error, 'error');
            }
        } catch (error) {
            showMessage?.(error.message, 'error');
        }
    };

    const handleContextMenu = (event, user) => {
        event.preventDefault();
        event.stopPropagation();
        setSelectedUser(user);
        setMenuAnchor(event.currentTarget);
    };

    const handleCloseMenu = () => {
        setMenuAnchor(null);
    };

    const handleViewDetails = (user) => {
        handleCloseMenu();
        setSelectedUser(user);
        setUserDetailsOpen(true);
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        showMessage?.('Copied to clipboard', 'info');
    };

    const formatDate = (dateString) => {
        if (!dateString) return '—';
        return new Date(dateString).toLocaleString();
    };

    const getProviderIcon = (providerId) => {
        switch (providerId) {
            case 'password': return <EmailIcon sx={{ fontSize: 14 }} />;
            case 'phone': return <PhoneIcon sx={{ fontSize: 14 }} />;
            case 'google.com': return <PersonIcon sx={{ fontSize: 14, color: '#4285f4' }} />;
            default: return <PersonIcon sx={{ fontSize: 14 }} />;
        }
    };

    // Filter users by search text
    const filteredUsers = users.filter(user => {
        if (!searchText) return true;
        const search = searchText.toLowerCase();
        return (
            (user.email && user.email.toLowerCase().includes(search)) ||
            (user.displayName && user.displayName.toLowerCase().includes(search)) ||
            (user.uid && user.uid.toLowerCase().includes(search)) ||
            (user.phoneNumber && user.phoneNumber.includes(search))
        );
    });

    // Check if Google OAuth project - Auth requires Service Account
    if (project?.authMethod === 'google') {
        return (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', color: mutedColor, backgroundColor: bgColor, p: 4 }}>
                <PersonIcon sx={{ fontSize: 64, opacity: 0.3, mb: 2 }} />
                <Typography variant="h6" sx={{ mb: 2, color: textColor }}>Authentication Requires Service Account</Typography>
                <Typography sx={{ textAlign: 'center', maxWidth: 500 }}>
                    Firebase Authentication user management requires a Service Account with admin privileges.
                </Typography>
                <Typography variant="body2" sx={{ mt: 2, textAlign: 'center', maxWidth: 500 }}>
                    Google OAuth does not have sufficient permissions to list or manage Firebase Auth users.
                </Typography>
                <Box sx={{ mt: 3, p: 2, backgroundColor: isDark ? '#2d2d2d' : '#f5f5f5', borderRadius: 1, maxWidth: 500 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1, color: textColor }}>To use Authentication:</Typography>
                    <Typography variant="body2" sx={{ color: mutedColor }}>
                        1. Go to Firebase Console → Project Settings → Service Accounts<br />
                        2. Click "Generate new private key"<br />
                        3. Add the project using "Service Account" option in Firestudio
                    </Typography>
                </Box>
            </Box>
        );
    }

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: bgColor }}>
            {/* Toolbar */}
            <Box sx={{ display: 'flex', alignItems: 'center', p: 1, borderBottom: `1px solid ${borderColor}`, gap: 1 }}>
                <Chip label={project?.projectId} size="small" sx={{ backgroundColor: isDark ? 'rgba(25, 118, 210, 0.3)' : '#e3f2fd' }} />
                <Chip label={`${users.length} users`} size="small" variant="outlined" />
                <Box sx={{ flexGrow: 1 }} />
                <TextField
                    size="small"
                    placeholder="Search users..."
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    sx={{ width: 200 }}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon sx={{ fontSize: 18, color: mutedColor }} />
                            </InputAdornment>
                        ),
                        sx: { fontSize: '0.85rem', height: 32 }
                    }}
                />
                <Tooltip title="Create User">
                    <IconButton size="small" onClick={() => setCreateDialogOpen(true)}>
                        <AddIcon sx={{ fontSize: 20 }} />
                    </IconButton>
                </Tooltip>
                <Tooltip title="Refresh">
                    <IconButton size="small" onClick={loadUsers}>
                        <RefreshIcon sx={{ fontSize: 20 }} />
                    </IconButton>
                </Tooltip>
            </Box>

            {/* Users List */}
            <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                        <CircularProgress />
                    </Box>
                ) : filteredUsers.length === 0 ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: mutedColor }}>
                        <PersonIcon sx={{ fontSize: 64, opacity: 0.3, mb: 2 }} />
                        <Typography>{searchText ? 'No users match your search' : 'No users found'}</Typography>
                        <Button
                            variant="outlined"
                            size="small"
                            startIcon={<AddIcon />}
                            onClick={() => setCreateDialogOpen(true)}
                            sx={{ mt: 2 }}
                        >
                            Create User
                        </Button>
                    </Box>
                ) : (
                    <TableContainer>
                        <Table size="small" stickyHeader>
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ fontWeight: 600, backgroundColor: bgColor, color: textColor, width: 50 }}></TableCell>
                                    <TableCell sx={{ fontWeight: 600, backgroundColor: bgColor, color: textColor }}>Email</TableCell>
                                    <TableCell sx={{ fontWeight: 600, backgroundColor: bgColor, color: textColor }}>Display Name</TableCell>
                                    <TableCell sx={{ fontWeight: 600, backgroundColor: bgColor, color: textColor, width: 100 }}>Providers</TableCell>
                                    <TableCell sx={{ fontWeight: 600, backgroundColor: bgColor, color: textColor, width: 100 }}>Status</TableCell>
                                    <TableCell sx={{ fontWeight: 600, backgroundColor: bgColor, color: textColor, width: 150 }}>Created</TableCell>
                                    <TableCell sx={{ fontWeight: 600, backgroundColor: bgColor, color: textColor, width: 150 }}>Last Sign In</TableCell>
                                    <TableCell sx={{ fontWeight: 600, backgroundColor: bgColor, color: textColor, width: 50 }}></TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {filteredUsers.map((user) => (
                                    <TableRow
                                        key={user.uid}
                                        onClick={() => handleViewDetails(user)}
                                        sx={{
                                            cursor: 'pointer',
                                            '&:hover': { backgroundColor: hoverBg },
                                            backgroundColor: selectedUser?.uid === user.uid ? (isDark ? 'rgba(25, 118, 210, 0.2)' : '#e3f2fd') : 'transparent',
                                            opacity: user.disabled ? 0.5 : 1
                                        }}
                                    >
                                        <TableCell sx={{ borderBottom: `1px solid ${borderColor}` }}>
                                            <Avatar sx={{ width: 28, height: 28, fontSize: '0.75rem', bgcolor: isDark ? '#444' : '#ccc' }}>
                                                {(user.displayName?.[0] || user.email?.[0] || '?').toUpperCase()}
                                            </Avatar>
                                        </TableCell>
                                        <TableCell sx={{ borderBottom: `1px solid ${borderColor}` }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                <Typography sx={{ fontSize: '0.85rem', color: textColor }}>{user.email || '—'}</Typography>
                                                {user.emailVerified && (
                                                    <Tooltip title="Email verified">
                                                        <VerifiedIcon sx={{ fontSize: 14, color: '#4caf50' }} />
                                                    </Tooltip>
                                                )}
                                            </Box>
                                            <Typography sx={{ fontSize: '0.7rem', color: mutedColor, fontFamily: 'monospace' }}>{user.uid}</Typography>
                                        </TableCell>
                                        <TableCell sx={{ fontSize: '0.85rem', color: textColor, borderBottom: `1px solid ${borderColor}` }}>
                                            {user.displayName || '—'}
                                        </TableCell>
                                        <TableCell sx={{ borderBottom: `1px solid ${borderColor}` }}>
                                            <Box sx={{ display: 'flex', gap: 0.5 }}>
                                                {(user.providerData || []).map((provider, i) => (
                                                    <Tooltip key={i} title={provider.providerId}>
                                                        {getProviderIcon(provider.providerId)}
                                                    </Tooltip>
                                                ))}
                                            </Box>
                                        </TableCell>
                                        <TableCell sx={{ borderBottom: `1px solid ${borderColor}` }}>
                                            {user.disabled ? (
                                                <Chip label="Disabled" size="small" color="error" sx={{ fontSize: '0.7rem', height: 20 }} />
                                            ) : (
                                                <Chip label="Active" size="small" color="success" sx={{ fontSize: '0.7rem', height: 20 }} />
                                            )}
                                        </TableCell>
                                        <TableCell sx={{ fontSize: '0.75rem', color: mutedColor, borderBottom: `1px solid ${borderColor}` }}>
                                            {formatDate(user.metadata?.creationTime)}
                                        </TableCell>
                                        <TableCell sx={{ fontSize: '0.75rem', color: mutedColor, borderBottom: `1px solid ${borderColor}` }}>
                                            {formatDate(user.metadata?.lastSignInTime)}
                                        </TableCell>
                                        <TableCell sx={{ borderBottom: `1px solid ${borderColor}` }}>
                                            <IconButton
                                                size="small"
                                                onClick={(e) => handleContextMenu(e, user)}
                                            >
                                                <MoreVertIcon sx={{ fontSize: 16 }} />
                                            </IconButton>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
            </Box>

            {/* Status Bar */}
            <Box sx={{ display: 'flex', alignItems: 'center', p: 0.5, borderTop: `1px solid ${borderColor}`, fontSize: '0.75rem', color: mutedColor }}>
                <Typography variant="caption">
                    {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''}
                    {searchText && ` (filtered from ${users.length})`}
                </Typography>
            </Box>

            {/* Context Menu */}
            <Menu
                anchorEl={menuAnchor}
                open={Boolean(menuAnchor)}
                onClose={handleCloseMenu}
            >
                <MenuItem onClick={() => handleViewDetails(selectedUser)}>
                    <ListItemIcon><PersonIcon fontSize="small" /></ListItemIcon>
                    View Details
                </MenuItem>
                <MenuItem onClick={() => { copyToClipboard(selectedUser?.uid); handleCloseMenu(); }}>
                    <ListItemIcon><CopyIcon fontSize="small" /></ListItemIcon>
                    Copy UID
                </MenuItem>
                <Divider />
                <MenuItem onClick={() => handleDisableUser(selectedUser)}>
                    <ListItemIcon>
                        {selectedUser?.disabled ? <EnableIcon fontSize="small" /> : <BlockIcon fontSize="small" />}
                    </ListItemIcon>
                    {selectedUser?.disabled ? 'Enable User' : 'Disable User'}
                </MenuItem>
                <MenuItem onClick={() => handleDeleteUser(selectedUser)} sx={{ color: 'error.main' }}>
                    <ListItemIcon><DeleteIcon fontSize="small" sx={{ color: 'error.main' }} /></ListItemIcon>
                    Delete User
                </MenuItem>
            </Menu>

            {/* Create User Dialog */}
            <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle>Create User</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        fullWidth
                        label="Email"
                        type="email"
                        value={newUserEmail}
                        onChange={(e) => setNewUserEmail(e.target.value)}
                        size="small"
                        sx={{ mt: 1, mb: 2 }}
                    />
                    <TextField
                        fullWidth
                        label="Password"
                        type="password"
                        value={newUserPassword}
                        onChange={(e) => setNewUserPassword(e.target.value)}
                        size="small"
                        sx={{ mb: 2 }}
                    />
                    <TextField
                        fullWidth
                        label="Display Name (optional)"
                        value={newUserDisplayName}
                        onChange={(e) => setNewUserDisplayName(e.target.value)}
                        size="small"
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleCreateUser}>Create</Button>
                </DialogActions>
            </Dialog>

            {/* User Details Dialog */}
            <Dialog open={userDetailsOpen} onClose={() => setUserDetailsOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Avatar sx={{ bgcolor: isDark ? '#444' : '#ccc' }}>
                            {(selectedUser?.displayName?.[0] || selectedUser?.email?.[0] || '?').toUpperCase()}
                        </Avatar>
                        <Box>
                            <Typography variant="h6">{selectedUser?.displayName || selectedUser?.email || 'User'}</Typography>
                            <Typography variant="caption" sx={{ color: mutedColor }}>{selectedUser?.uid}</Typography>
                        </Box>
                    </Box>
                </DialogTitle>
                <DialogContent dividers>
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 1, fontSize: '0.9rem' }}>
                        <Typography color="text.secondary">Email:</Typography>
                        <Typography>{selectedUser?.email || '—'}</Typography>

                        <Typography color="text.secondary">Email Verified:</Typography>
                        <Typography>{selectedUser?.emailVerified ? 'Yes' : 'No'}</Typography>

                        <Typography color="text.secondary">Phone:</Typography>
                        <Typography>{selectedUser?.phoneNumber || '—'}</Typography>

                        <Typography color="text.secondary">Display Name:</Typography>
                        <Typography>{selectedUser?.displayName || '—'}</Typography>

                        <Typography color="text.secondary">Photo URL:</Typography>
                        <Typography sx={{ wordBreak: 'break-all' }}>{selectedUser?.photoURL || '—'}</Typography>

                        <Typography color="text.secondary">Status:</Typography>
                        <Typography>{selectedUser?.disabled ? 'Disabled' : 'Active'}</Typography>

                        <Typography color="text.secondary">Providers:</Typography>
                        <Box>
                            {(selectedUser?.providerData || []).map((p, i) => (
                                <Chip key={i} label={p.providerId} size="small" sx={{ mr: 0.5, mb: 0.5 }} />
                            ))}
                        </Box>

                        <Typography color="text.secondary">Created:</Typography>
                        <Typography>{formatDate(selectedUser?.metadata?.creationTime)}</Typography>

                        <Typography color="text.secondary">Last Sign In:</Typography>
                        <Typography>{formatDate(selectedUser?.metadata?.lastSignInTime)}</Typography>

                        <Typography color="text.secondary">UID:</Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Typography sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{selectedUser?.uid}</Typography>
                            <IconButton size="small" onClick={() => copyToClipboard(selectedUser?.uid)}>
                                <CopyIcon sx={{ fontSize: 14 }} />
                            </IconButton>
                        </Box>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setUserDetailsOpen(false)}>Close</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

export default AuthTab;
