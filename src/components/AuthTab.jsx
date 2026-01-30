import React, { useState, useEffect, useRef } from 'react';
import {
    Box, Typography, IconButton, Tooltip, Button, Table, TableBody, TableCell,
    TableContainer, TableHead, TableRow, CircularProgress, Chip, Dialog,
    DialogTitle, DialogContent, DialogActions, TextField, Menu, MenuItem,
    ListItemIcon, Divider, Avatar, InputAdornment, FormControlLabel, Checkbox,
} from '@mui/material';
import {
    Refresh as RefreshIcon, Add as AddIcon, Delete as DeleteIcon,
    MoreVert as MoreVertIcon, Email as EmailIcon, Phone as PhoneIcon,
    Person as PersonIcon, Search as SearchIcon, Verified as VerifiedIcon,
    ContentCopy as CopyIcon, Block as BlockIcon, CheckCircle as EnableIcon,
    Edit as EditIcon, OpenInNew as OpenInNewIcon,
} from '@mui/icons-material';
import { useTheme, alpha } from '@mui/material';
import { formatDate, copyToClipboard, confirmAction } from '../utils/commonUtils';

// Provider icon component
const ProviderIcon = ({ providerId }) => {
    const icons = {
        'password': <EmailIcon sx={{ fontSize: 14 }} />,
        'phone': <PhoneIcon sx={{ fontSize: 14 }} />,
        'google.com': <PersonIcon sx={{ fontSize: 14, color: '#4285f4' }} />,
    };
    return icons[providerId] || <PersonIcon sx={{ fontSize: 14 }} />;
};

// User avatar component
const UserAvatar = ({ user }) => (
    <Avatar sx={{ width: 28, height: 28, fontSize: '0.75rem', bgcolor: 'action.disabledBackground', color: 'text.primary' }}>
        {(user.displayName?.[0] || user.email?.[0] || '?').toUpperCase()}
    </Avatar>
);

function AuthTab({ project, addLog, showMessage }) {
    const theme = useTheme();

    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchText, setSearchText] = useState('');
    const [authError, setAuthError] = useState(null);
    const [selectedUser, setSelectedUser] = useState(null);
    const [menuAnchor, setMenuAnchor] = useState(null);
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [newUserEmail, setNewUserEmail] = useState('');
    const [newUserPassword, setNewUserPassword] = useState('');
    const [newUserDisplayName, setNewUserDisplayName] = useState('');
    const [newUserUid, setNewUserUid] = useState('');
    const [newUserPhoneNumber, setNewUserPhoneNumber] = useState('');
    const [newUserPhotoUrl, setNewUserPhotoUrl] = useState('');
    const [newUserDisabled, setNewUserDisabled] = useState(false);
    const [newUserEmailVerified, setNewUserEmailVerified] = useState(false);

    // Edit user dialog state
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [editUser, setEditUser] = useState(null);
    const [editEmail, setEditEmail] = useState('');
    const [editDisplayName, setEditDisplayName] = useState('');
    const [editPhoneNumber, setEditPhoneNumber] = useState('');
    const [editPhotoUrl, setEditPhotoUrl] = useState('');
    const [editPassword, setEditPassword] = useState('');
    const [editDisabled, setEditDisabled] = useState(false);
    const [editEmailVerified, setEditEmailVerified] = useState(false);

    const isGoogle = project?.authMethod === 'google';
    const loadingRef = useRef(false);

    useEffect(() => {
        if (project) loadUsers();
    }, [project?.projectId]);

    const openFirebaseConsole = () => {
        const url = `https://console.firebase.google.com/project/${project.projectId}/authentication/users`;
        window.electronAPI.openExternal(url);
    };

    const loadUsers = async () => {
        // Prevent duplicate calls
        if (loadingRef.current) return;
        loadingRef.current = true;
        setLoading(true);
        setAuthError(null);
        try {
            const result = isGoogle
                ? await window.electronAPI.googleListAuthUsers({ projectId: project.projectId, maxResults: 1000 })
                : (await window.electronAPI.disconnectFirebase(), await window.electronAPI.connectFirebase(project.serviceAccountPath), await window.electronAPI.listAuthUsers());

            if (result.success) {
                setUsers(result.users || []);
                setAuthError(null);
                addLog?.('success', `Loaded ${result.users?.length || 0} users`);
            } else {
                // Check if this is a CONFIGURATION_NOT_FOUND error (Auth not enabled)
                if (result.error?.includes('CONFIGURATION_NOT_FOUND') || result.error?.includes('not enabled') || result.error?.includes('not been used')) {
                    setAuthError(result.error);
                } else {
                    showMessage?.(result.error, 'error');
                }
                setUsers([]);
            }
        } catch (error) {
            showMessage?.(error.message, 'error');
            setUsers([]);
        } finally {
            loadingRef.current = false;
            setLoading(false);
        }
    };

    const resetCreateUserForm = () => {
        setNewUserEmail('');
        setNewUserPassword('');
        setNewUserDisplayName('');
        setNewUserUid('');
        setNewUserPhoneNumber('');
        setNewUserPhotoUrl('');
        setNewUserDisabled(false);
        setNewUserEmailVerified(false);
    };

    const handleCreateUser = async () => {
        if (!newUserEmail || !newUserPassword) {
            showMessage?.('Email and password are required', 'error');
            return;
        }
        try {
            const userData = {
                email: newUserEmail,
                password: newUserPassword,
                displayName: newUserDisplayName || null,
                uid: newUserUid || null,
                phoneNumber: newUserPhoneNumber || null,
                photoURL: newUserPhotoUrl || null,
                disabled: newUserDisabled,
                emailVerified: newUserEmailVerified
            };

            const result = isGoogle
                ? await window.electronAPI.googleCreateAuthUser({ projectId: project.projectId, ...userData })
                : await window.electronAPI.createAuthUser(userData);
            if (result.success) {
                addLog?.('success', `Created user ${newUserEmail}`);
                showMessage?.(`Created user ${newUserEmail}`, 'success');
                setCreateDialogOpen(false);
                resetCreateUserForm();
                loadUsers();
            } else showMessage?.(result.error, 'error');
        } catch (error) { showMessage?.(error.message, 'error'); }
    };

    const handleDeleteUser = async (user) => {
        closeMenu();
        const confirmed = await confirmAction(
            'Delete User?',
            `Are you sure you want to delete <strong>"${user.email || user.uid}"</strong>?<br><small style="color: #888;">This will permanently delete the user account.</small>`,
            { confirmText: 'Delete', isDark: theme.palette.mode === 'dark' }
        );

        if (confirmed) {
            try {
                const deleteResult = isGoogle
                    ? await window.electronAPI.googleDeleteAuthUser({ projectId: project.projectId, uid: user.uid })
                    : await window.electronAPI.deleteAuthUser({ uid: user.uid });
                if (deleteResult.success) {
                    addLog?.('success', `Deleted user ${user.email || user.uid}`);
                    showMessage?.(`Deleted user ${user.email || user.uid}`, 'success');
                    loadUsers();
                } else showMessage?.(deleteResult.error, 'error');
            } catch (error) { showMessage?.(error.message, 'error'); }
        }
    };

    const handleDisableUser = async (user) => {
        closeMenu();
        try {
            const result = isGoogle
                ? await window.electronAPI.googleUpdateAuthUser({ projectId: project.projectId, uid: user.uid, disabled: !user.disabled })
                : await window.electronAPI.updateAuthUser({ uid: user.uid, disabled: !user.disabled });
            if (result.success) {
                const action = user.disabled ? 'enabled' : 'disabled';
                addLog?.('success', `User ${user.email || user.uid} ${action}`);
                showMessage?.(`User ${action}`, 'success');
                loadUsers();
            } else showMessage?.(result.error, 'error');
        } catch (error) { showMessage?.(error.message, 'error'); }
    };

    const handleContextMenu = (e, user) => { e.preventDefault(); e.stopPropagation(); setSelectedUser(user); setMenuAnchor(e.currentTarget); };
    const closeMenu = () => setMenuAnchor(null);
    const handleCopy = (text) => copyToClipboard(text, () => showMessage?.('Copied to clipboard', 'info'));

    // Edit user functions
    const openEditDialog = (user) => {
        closeMenu();
        setEditUser(user);
        setEditEmail(user.email || '');
        setEditDisplayName(user.displayName || '');
        setEditPhoneNumber(user.phoneNumber || '');
        setEditPhotoUrl(user.photoURL || '');
        setEditPassword('');
        setEditDisabled(user.disabled || false);
        setEditEmailVerified(user.emailVerified || false);
        setEditDialogOpen(true);
    };

    const resetEditForm = () => {
        setEditUser(null);
        setEditEmail('');
        setEditDisplayName('');
        setEditPhoneNumber('');
        setEditPhotoUrl('');
        setEditPassword('');
        setEditDisabled(false);
        setEditEmailVerified(false);
    };

    const handleUpdateUser = async () => {
        if (!editUser) return;
        try {
            const updateData = {
                uid: editUser.uid,
                email: editEmail !== editUser.email ? editEmail : undefined,
                displayName: editDisplayName !== editUser.displayName ? editDisplayName : undefined,
                phoneNumber: editPhoneNumber !== editUser.phoneNumber ? editPhoneNumber || null : undefined,
                photoURL: editPhotoUrl !== editUser.photoURL ? editPhotoUrl || null : undefined,
                disabled: editDisabled !== editUser.disabled ? editDisabled : undefined,
                emailVerified: editEmailVerified !== editUser.emailVerified ? editEmailVerified : undefined,
            };
            // Only include password if it was changed
            if (editPassword) updateData.password = editPassword;

            // Remove undefined values
            Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

            const result = isGoogle
                ? await window.electronAPI.googleUpdateAuthUser({ projectId: project.projectId, ...updateData })
                : await window.electronAPI.updateAuthUser(updateData);

            if (result.success) {
                addLog?.('success', `Updated user ${editUser.email || editUser.uid}`);
                showMessage?.(`User updated successfully`, 'success');
                setEditDialogOpen(false);
                resetEditForm();
                loadUsers();
            } else showMessage?.(result.error, 'error');
        } catch (error) { showMessage?.(error.message, 'error'); }
    };

    const filteredUsers = users.filter(user => {
        if (!searchText) return true;
        const s = searchText.toLowerCase();
        return (user.email?.toLowerCase().includes(s) || user.displayName?.toLowerCase().includes(s) || user.uid?.toLowerCase().includes(s) || user.phoneNumber?.includes(s));
    });

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'background.default' }}>
            {/* Toolbar */}
            <Box sx={{ display: 'flex', alignItems: 'center', p: 1, borderBottom: 1, borderColor: 'divider', gap: 1 }}>
                <Chip label={project?.projectId} size="small" sx={{ backgroundColor: 'action.selected' }} />
                <Chip label={`${users.length} users`} size="small" variant="outlined" />
                <Box sx={{ flexGrow: 1 }} />
                <TextField size="small" placeholder="Search users..." value={searchText} onChange={(e) => setSearchText(e.target.value)} sx={{ width: 200 }}
                    InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18, color: 'text.secondary' }} /></InputAdornment>, sx: { fontSize: '0.85rem', height: 32 } }} />
                <Tooltip title="Create User"><IconButton size="small" onClick={() => setCreateDialogOpen(true)}><AddIcon sx={{ fontSize: 20 }} /></IconButton></Tooltip>
                <Tooltip title="Refresh"><IconButton size="small" onClick={loadUsers}><RefreshIcon sx={{ fontSize: 20 }} /></IconButton></Tooltip>
            </Box>

            {/* Users List */}
            <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}><CircularProgress /></Box>
                ) : authError ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'text.secondary', p: 4 }}>
                        <PersonIcon sx={{ fontSize: 64, opacity: 0.3, mb: 2, color: '#f44336' }} />
                        <Typography variant="h6" sx={{ mb: 1, color: 'text.primary' }}>Authentication Not Enabled</Typography>
                        <Typography sx={{ textAlign: 'center', maxWidth: 450, mb: 3 }}>
                            Firebase Authentication is not enabled for this project. Enable it in the Firebase Console to manage users.
                        </Typography>
                        <Button
                            variant="contained"
                            color="primary"
                            onClick={openFirebaseConsole}
                            startIcon={<OpenInNewIcon />}
                        >
                            Open Firebase Console
                        </Button>
                        <Typography variant="caption" sx={{ mt: 2, color: 'text.secondary' }}>
                            After enabling Authentication, click Refresh to reload.
                        </Typography>
                        <Button variant="text" size="small" onClick={loadUsers} sx={{ mt: 1 }}>
                            <RefreshIcon sx={{ fontSize: 16, mr: 0.5 }} /> Refresh
                        </Button>
                    </Box>
                ) : filteredUsers.length === 0 ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'text.secondary' }}>
                        <PersonIcon sx={{ fontSize: 64, opacity: 0.3, mb: 2 }} />
                        <Typography>{searchText ? 'No users match your search' : 'No users found'}</Typography>
                        <Button variant="outlined" size="small" startIcon={<AddIcon />} onClick={() => setCreateDialogOpen(true)} sx={{ mt: 2 }}>Create User</Button>
                    </Box>
                ) : (
                    <TableContainer>
                        <Table size="small" stickyHeader>
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ fontWeight: 600, backgroundColor: 'background.default', color: 'text.primary', width: 50 }}></TableCell>
                                    <TableCell sx={{ fontWeight: 600, backgroundColor: 'background.default', color: 'text.primary' }}>Email</TableCell>
                                    <TableCell sx={{ fontWeight: 600, backgroundColor: 'background.default', color: 'text.primary' }}>Display Name</TableCell>
                                    <TableCell sx={{ fontWeight: 600, backgroundColor: 'background.default', color: 'text.primary', width: 100 }}>Providers</TableCell>
                                    <TableCell sx={{ fontWeight: 600, backgroundColor: 'background.default', color: 'text.primary', width: 100 }}>Status</TableCell>
                                    <TableCell sx={{ fontWeight: 600, backgroundColor: 'background.default', color: 'text.primary', width: 150 }}>Created</TableCell>
                                    <TableCell sx={{ fontWeight: 600, backgroundColor: 'background.default', color: 'text.primary', width: 150 }}>Last Sign In</TableCell>
                                    <TableCell sx={{ fontWeight: 600, backgroundColor: 'background.default', color: 'text.primary', width: 50 }}></TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {filteredUsers.map((user) => (
                                    <TableRow key={user.uid} onClick={() => openEditDialog(user)}
                                        sx={{ cursor: 'pointer', '&:hover': { backgroundColor: 'action.hover' }, backgroundColor: selectedUser?.uid === user.uid ? 'action.selected' : 'transparent', opacity: user.disabled ? 0.5 : 1 }}>
                                        <TableCell sx={{ borderBottom: 1, borderColor: 'divider' }}><UserAvatar user={user} /></TableCell>
                                        <TableCell sx={{ borderBottom: 1, borderColor: 'divider' }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                <Typography sx={{ fontSize: '0.85rem', color: 'text.primary' }}>{user.email || '—'}</Typography>
                                                {user.emailVerified && <Tooltip title="Email verified"><VerifiedIcon sx={{ fontSize: 14, color: '#4caf50' }} /></Tooltip>}
                                            </Box>
                                            <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', fontFamily: 'monospace' }}>{user.uid}</Typography>
                                        </TableCell>
                                        <TableCell sx={{ fontSize: '0.85rem', color: 'text.primary', borderBottom: 1, borderColor: 'divider' }}>{user.displayName || '—'}</TableCell>
                                        <TableCell sx={{ borderBottom: 1, borderColor: 'divider' }}>
                                            <Box sx={{ display: 'flex', gap: 0.5 }}>{(user.providerData || []).map((p, i) => <Tooltip key={i} title={p.providerId}><span><ProviderIcon providerId={p.providerId} /></span></Tooltip>)}</Box>
                                        </TableCell>
                                        <TableCell sx={{ borderBottom: 1, borderColor: 'divider' }}>
                                            {user.disabled ? <Chip label="Disabled" size="small" color="error" sx={{ fontSize: '0.7rem', height: 20 }} /> : <Chip label="Active" size="small" color="success" sx={{ fontSize: '0.7rem', height: 20 }} />}
                                        </TableCell>
                                        <TableCell sx={{ fontSize: '0.75rem', color: 'text.secondary', borderBottom: 1, borderColor: 'divider' }}>{formatDate(user.metadata?.creationTime)}</TableCell>
                                        <TableCell sx={{ fontSize: '0.75rem', color: 'text.secondary', borderBottom: 1, borderColor: 'divider' }}>{formatDate(user.metadata?.lastSignInTime)}</TableCell>
                                        <TableCell sx={{ borderBottom: 1, borderColor: 'divider' }}><IconButton size="small" onClick={(e) => handleContextMenu(e, user)}><MoreVertIcon sx={{ fontSize: 16 }} /></IconButton></TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
            </Box>

            {/* Status Bar */}
            <Box sx={{ display: 'flex', alignItems: 'center', p: 0.5, borderTop: 1, borderColor: 'divider', fontSize: '0.75rem', color: 'text.secondary' }}>
                <Typography variant="caption">{filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''}{searchText && ` (filtered from ${users.length})`}</Typography>
            </Box>

            {/* Context Menu */}
            <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={closeMenu}>
                <MenuItem onClick={() => openEditDialog(selectedUser)}><ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>View / Edit User</MenuItem>
                <MenuItem onClick={() => { handleCopy(selectedUser?.uid); closeMenu(); }}><ListItemIcon><CopyIcon fontSize="small" /></ListItemIcon>Copy UID</MenuItem>
                <Divider />
                <MenuItem onClick={() => handleDisableUser(selectedUser)}><ListItemIcon>{selectedUser?.disabled ? <EnableIcon fontSize="small" /> : <BlockIcon fontSize="small" />}</ListItemIcon>{selectedUser?.disabled ? 'Enable User' : 'Disable User'}</MenuItem>
                <MenuItem onClick={() => handleDeleteUser(selectedUser)} sx={{ color: 'error.main' }}><ListItemIcon><DeleteIcon fontSize="small" sx={{ color: 'error.main' }} /></ListItemIcon>Delete User</MenuItem>
            </Menu>

            {/* Create User Dialog */}
            <Dialog open={createDialogOpen} onClose={() => { setCreateDialogOpen(false); resetCreateUserForm(); }} maxWidth="sm" fullWidth>
                <DialogTitle>Create User</DialogTitle>
                <DialogContent>
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mt: 1 }}>
                        <TextField
                            autoFocus
                            fullWidth
                            label="Email *"
                            type="email"
                            value={newUserEmail}
                            onChange={(e) => setNewUserEmail(e.target.value)}
                            size="small"
                        />
                        <TextField
                            fullWidth
                            label="Password *"
                            type="password"
                            value={newUserPassword}
                            onChange={(e) => setNewUserPassword(e.target.value)}
                            size="small"
                        />
                        <TextField
                            fullWidth
                            label="User UID (optional)"
                            value={newUserUid}
                            onChange={(e) => setNewUserUid(e.target.value)}
                            size="small"
                            placeholder="Auto-generated if empty"
                            helperText="Custom UID or leave empty"
                        />
                        <TextField
                            fullWidth
                            label="Display Name"
                            value={newUserDisplayName}
                            onChange={(e) => setNewUserDisplayName(e.target.value)}
                            size="small"
                        />
                        <TextField
                            fullWidth
                            label="Phone Number"
                            value={newUserPhoneNumber}
                            onChange={(e) => setNewUserPhoneNumber(e.target.value)}
                            size="small"
                            placeholder="+1234567890"
                            helperText="E.164 format (e.g., +12345678900)"
                        />
                        <TextField
                            fullWidth
                            label="Photo URL"
                            value={newUserPhotoUrl}
                            onChange={(e) => setNewUserPhotoUrl(e.target.value)}
                            size="small"
                            placeholder="https://..."
                        />
                    </Box>
                    <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={newUserEmailVerified}
                                    onChange={(e) => setNewUserEmailVerified(e.target.checked)}
                                    size="small"
                                />
                            }
                            label="Email Verified"
                        />
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={newUserDisabled}
                                    onChange={(e) => setNewUserDisabled(e.target.checked)}
                                    size="small"
                                />
                            }
                            label="Disabled"
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => { setCreateDialogOpen(false); resetCreateUserForm(); }} sx={{ color: theme.palette.mode === 'dark' ? '#fff' : undefined }}>Cancel</Button>
                    <Button variant="contained" onClick={handleCreateUser} disabled={!newUserEmail || !newUserPassword}>Create</Button>
                </DialogActions>
            </Dialog>

            {/* Edit User Dialog */}
            <Dialog open={editDialogOpen} onClose={() => { setEditDialogOpen(false); resetEditForm(); }} maxWidth="sm" fullWidth>
                <DialogTitle>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Avatar sx={{ bgcolor: theme.palette.mode === 'dark' ? '#555' : '#ccc', color: theme.palette.mode === 'dark' ? '#fff' : '#333' }}>{(editUser?.displayName?.[0] || editUser?.email?.[0] || '?').toUpperCase()}</Avatar>
                        <Box sx={{ flex: 1 }}>
                            <Typography variant="h6">{editUser?.displayName || editUser?.email || 'User'}</Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace' }}>{editUser?.uid}</Typography>
                                <IconButton size="small" onClick={() => handleCopy(editUser?.uid)}><CopyIcon sx={{ fontSize: 12 }} /></IconButton>
                            </Box>
                        </Box>
                    </Box>
                </DialogTitle>
                <DialogContent>
                    {/* User Metadata Info */}
                    <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>Created:</Typography>
                            <Typography variant="caption">{formatDate(editUser?.metadata?.creationTime)}</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>Last Sign In:</Typography>
                            <Typography variant="caption">{formatDate(editUser?.metadata?.lastSignInTime)}</Typography>
                        </Box>
                        {editUser?.providerData?.length > 0 && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <Typography variant="caption" sx={{ color: 'text.secondary' }}>Providers:</Typography>
                                {editUser.providerData.map((p, i) => <Chip key={i} label={p.providerId} size="small" sx={{ height: 18, fontSize: '0.65rem' }} />)}
                            </Box>
                        )}
                    </Box>

                    <Divider sx={{ mb: 2 }} />

                    {/* Edit Fields */}
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                        <TextField
                            fullWidth
                            label="Email"
                            type="email"
                            value={editEmail}
                            onChange={(e) => setEditEmail(e.target.value)}
                            size="small"
                        />
                        <TextField
                            fullWidth
                            label="New Password"
                            type="password"
                            value={editPassword}
                            onChange={(e) => setEditPassword(e.target.value)}
                            size="small"
                            placeholder="Leave empty to keep current"
                        />
                        <TextField
                            fullWidth
                            label="Display Name"
                            value={editDisplayName}
                            onChange={(e) => setEditDisplayName(e.target.value)}
                            size="small"
                        />
                        <TextField
                            fullWidth
                            label="Phone Number"
                            value={editPhoneNumber}
                            onChange={(e) => setEditPhoneNumber(e.target.value)}
                            size="small"
                            placeholder="+1234567890"
                        />
                        <TextField
                            fullWidth
                            label="Photo URL"
                            value={editPhotoUrl}
                            onChange={(e) => setEditPhotoUrl(e.target.value)}
                            size="small"
                            placeholder="https://..."
                            sx={{ gridColumn: 'span 2' }}
                        />
                    </Box>
                    <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={editEmailVerified}
                                    onChange={(e) => setEditEmailVerified(e.target.checked)}
                                    size="small"
                                />
                            }
                            label="Email Verified"
                        />
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={editDisabled}
                                    onChange={(e) => setEditDisabled(e.target.checked)}
                                    size="small"
                                />
                            }
                            label="Disabled"
                        />
                    </Box>

                    {/* Warning */}
                    <Box sx={{ mt: 2, p: 1.5, backgroundColor: (theme) => alpha(theme.palette.warning.main, 0.1), borderRadius: 1, border: 1, borderColor: (theme) => alpha(theme.palette.warning.main, 0.3) }}>
                        <Typography variant="caption" sx={{ color: 'warning.main' }}>
                            ⚠️ Changing phone number, email, or password might log the user out of your app and will not send an automated SMS or email.
                        </Typography>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => { setEditDialogOpen(false); resetEditForm(); }} sx={{ color: theme.palette.mode === 'dark' ? '#fff' : undefined }}>Cancel</Button>
                    <Button variant="contained" onClick={handleUpdateUser}>Save Changes</Button>
                </DialogActions>
            </Dialog>

        </Box>
    );
}

export default AuthTab;
