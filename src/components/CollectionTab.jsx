import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    Box,
    Typography,
    Button,
    IconButton,
    Tooltip,
    TextField,
    ToggleButton,
    ToggleButtonGroup,
    CircularProgress,
    Chip,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    useTheme,
} from '@mui/material';
import {
    ViewList as TableIcon,
    AccountTree as TreeIcon,
    Code as JsonIcon,
    Terminal as LogIcon,
    FilterList as FilterIcon,
    Sort as SortIcon,
    Refresh as RefreshIcon,
    Add as AddIcon,
    Star as StarIcon,
    StarBorder as StarBorderIcon,
    Undo as UndoIcon,
    ContentCopy as CopyIcon,
    FileDownload as ExportIcon,
    FileUpload as ImportIcon,
    ExpandMore as ExpandMoreIcon,
    ChevronRight as ChevronRightIcon,
    PlayArrow as RunIcon,
    Settings as SettingsIcon,
    Storage as CollectionIcon,
    Description as DocumentIcon,
    ViewColumn as ColumnsIcon,
    Save as SaveIcon,
} from '@mui/icons-material';
import { useFavorites } from '../context/FavoritesContext';

function CollectionTab({ project, collectionPath, addLog, showMessage, defaultViewType = 'tree', defaultDocLimit = 50 }) {
    const theme = useTheme();
    const isDark = theme.palette.mode === 'dark';
    const { isFavorite, toggleFavorite } = useFavorites();
    const isCollectionFavorite = isFavorite(project?.projectId, collectionPath);

    const [viewMode, setViewMode] = useState(defaultViewType);
    const [queryMode, setQueryMode] = useState('simple');
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(false);
    const [expandedNodes, setExpandedNodes] = useState({});
    const [filterText, setFilterText] = useState('');
    const [sortField, setSortField] = useState('');
    const [limit, setLimit] = useState(defaultDocLimit);
    const [jsQuery, setJsQuery] = useState('');
    const [editingCell, setEditingCell] = useState(null);
    const [editValue, setEditValue] = useState('');
    const [jsonEditData, setJsonEditData] = useState('');
    const [jsonHasChanges, setJsonHasChanges] = useState(false);
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [newDocId, setNewDocId] = useState('');
    const [newDocData, setNewDocData] = useState('{}');
    const [columnWidths, setColumnWidths] = useState({});
    const [resizing, setResizing] = useState(null);
    const [queryLogs, setQueryLogs] = useState([]);
    const [hiddenColumns, setHiddenColumns] = useState({});
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [columnsMenuAnchor, setColumnsMenuAnchor] = useState(null);
    const [filterMenuOpen, setFilterMenuOpen] = useState(false);
    const [sortMenuOpen, setSortMenuOpen] = useState(false);
    const [sortConfig, setSortConfig] = useState({ field: '', direction: 'asc' });
    const [filters, setFilters] = useState([]);

    // Refs for click-outside detection
    const filterMenuRef = React.useRef(null);
    const sortMenuRef = React.useRef(null);
    const columnsMenuRef = React.useRef(null);

    // Close popups when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (filterMenuRef.current && !filterMenuRef.current.contains(e.target)) {
                setFilterMenuOpen(false);
            }
            if (sortMenuRef.current && !sortMenuRef.current.contains(e.target)) {
                setSortMenuOpen(false);
            }
            if (columnsMenuRef.current && !columnsMenuRef.current.contains(e.target)) {
                setColumnsMenuAnchor(null);
            }
        };

        if (filterMenuOpen || sortMenuOpen || columnsMenuAnchor) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [filterMenuOpen, sortMenuOpen, columnsMenuAnchor]);

    // Theme-aware colors
    const borderColor = isDark ? '#333' : '#e0e0e0';
    const bgColor = isDark ? '#1e1e1e' : '#fafafa';
    const hoverBg = isDark ? '#333' : '#f5f5f5';
    const textColor = isDark ? '#ccc' : '#333';
    const mutedColor = isDark ? '#888' : '#666';

    // Default JS Query template
    const defaultJsQuery = `// Query with JavaScript using the Firebase Admin SDK
// See examples at https://firefoo.app/go/firestore-js-query
async function run() {
    const query = await db.collection("${collectionPath}")
        .limit(${limit})
        .get();
    return query;
}`;

    useEffect(() => {
        if (collectionPath) {
            loadDocuments();
            setJsQuery(defaultJsQuery);
        }
    }, [collectionPath]);

    useEffect(() => {
        setJsQuery(`// Query with JavaScript using the Firebase Admin SDK
// See examples at https://firefoo.app/go/firestore-js-query
async function run() {
    const query = await db.collection("${collectionPath}")
        .limit(${limit})
        .get();
    return query;
}`);
    }, [collectionPath, limit]);

    useEffect(() => {
        if (viewMode === 'json') {
            const docsObj = {};
            documents.forEach(doc => { docsObj[doc.id] = doc.data; });
            setJsonEditData(JSON.stringify(docsObj, null, 2));
            setJsonHasChanges(false);
        }
    }, [viewMode, documents]);

    // F5 keyboard shortcut to run query - use refs to always get latest state
    const queryModeRef = React.useRef(queryMode);
    const jsQueryRef = React.useRef(jsQuery);

    useEffect(() => {
        queryModeRef.current = queryMode;
    }, [queryMode]);

    useEffect(() => {
        jsQueryRef.current = jsQuery;
    }, [jsQuery]);

    const loadDocuments = async () => {
        setLoading(true);
        try {
            const parsedLimit = parseInt(limit, 10) || 50;
            let result;

            if (project?.authMethod === 'google') {
                // Use Google OAuth REST API
                result = await window.electronAPI.googleGetDocuments({
                    projectId: project.projectId,
                    collectionPath,
                    limit: parsedLimit
                });
            } else {
                // Use service account (Admin SDK)
                await window.electronAPI.disconnectFirebase();
                await window.electronAPI.connectFirebase(project.serviceAccountPath);

                result = await window.electronAPI.getDocuments({
                    collectionPath,
                    limit: parsedLimit
                });
            }

            if (result.success) {
                setDocuments(result.documents);
                setExpandedNodes({ [collectionPath]: true });
                addLog?.('success', `Loaded ${result.documents.length} documents from ${collectionPath}`);
            } else {
                showMessage?.(result.error, 'error');
            }
        } catch (error) {
            showMessage?.(error.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleRunQuery = async () => {
        if (queryMode === 'simple') {
            await loadDocuments();
        } else {
            // Execute JS Query
            await executeJsQuery();
        }
    };

    // Parse JS Query and extract parameters for REST API
    const parseJsQuery = (query) => {
        const params = {
            collection: collectionPath,
            limit: 50,
            select: [],
            where: [],
            orderBy: null
        };

        // Extract collection
        const collectionMatch = query.match(/\.collection\s*\(\s*["'`]([^"'`]+)["'`]\s*\)/);
        if (collectionMatch) {
            params.collection = collectionMatch[1];
        }

        // Extract limit
        const limitMatch = query.match(/\.limit\s*\(\s*(\d+)\s*\)/);
        if (limitMatch) {
            params.limit = parseInt(limitMatch[1], 10);
        }

        // Extract select fields
        const selectMatch = query.match(/\.select\s*\(\s*([^)]+)\s*\)/);
        if (selectMatch) {
            const fieldsStr = selectMatch[1];
            // Parse "field1", "field2" or 'field1', 'field2'
            const fieldMatches = fieldsStr.match(/["'`]([^"'`]+)["'`]/g);
            if (fieldMatches) {
                params.select = fieldMatches.map(f => f.replace(/["'`]/g, ''));
            }
        }

        // Extract where clauses
        const whereRegex = /\.where\s*\(\s*["'`]([^"'`]+)["'`]\s*,\s*["'`]([^"'`]+)["'`]\s*,\s*([^)]+)\s*\)/g;
        let whereMatch;
        while ((whereMatch = whereRegex.exec(query)) !== null) {
            let value = whereMatch[3].trim();
            // Parse the value
            if (value.startsWith('"') || value.startsWith("'") || value.startsWith('`')) {
                value = value.slice(1, -1);
            } else if (value === 'true') {
                value = true;
            } else if (value === 'false') {
                value = false;
            } else if (!isNaN(value)) {
                value = Number(value);
            }
            params.where.push({
                field: whereMatch[1],
                operator: whereMatch[2],
                value: value
            });
        }

        // Extract orderBy
        const orderByMatch = query.match(/\.orderBy\s*\(\s*["'`]([^"'`]+)["'`](?:\s*,\s*["'`]?(asc|desc)["'`]?)?\s*\)/i);
        if (orderByMatch) {
            params.orderBy = {
                field: orderByMatch[1],
                direction: orderByMatch[2] || 'asc'
            };
        }

        return params;
    };

    const executeJsQuery = async () => {
        setLoading(true);
        addLog?.('info', 'Executing JS Query...');

        try {
            if (project?.authMethod === 'google') {
                // Parse the JS query and execute via REST API
                const queryParams = parseJsQuery(jsQuery);
                addLog?.('info', `Parsed query: collection=${queryParams.collection}, limit=${queryParams.limit}, select=[${queryParams.select.join(',')}]`);

                // Build Firestore REST API query
                const projectId = project.projectId;
                const structuredQuery = {
                    from: [{ collectionId: queryParams.collection.split('/').pop() }],
                    limit: queryParams.limit
                };

                // Add select (projection)
                if (queryParams.select.length > 0) {
                    structuredQuery.select = {
                        fields: queryParams.select.map(f => ({ fieldPath: f }))
                    };
                }

                // Add where filters
                if (queryParams.where.length > 0) {
                    if (queryParams.where.length === 1) {
                        const w = queryParams.where[0];
                        structuredQuery.where = {
                            fieldFilter: {
                                field: { fieldPath: w.field },
                                op: convertOperator(w.operator),
                                value: convertValue(w.value)
                            }
                        };
                    } else {
                        structuredQuery.where = {
                            compositeFilter: {
                                op: 'AND',
                                filters: queryParams.where.map(w => ({
                                    fieldFilter: {
                                        field: { fieldPath: w.field },
                                        op: convertOperator(w.operator),
                                        value: convertValue(w.value)
                                    }
                                }))
                            }
                        };
                    }
                }

                // Add orderBy
                if (queryParams.orderBy) {
                    structuredQuery.orderBy = [{
                        field: { fieldPath: queryParams.orderBy.field },
                        direction: queryParams.orderBy.direction.toUpperCase() === 'DESC' ? 'DESCENDING' : 'ASCENDING'
                    }];
                }

                // Execute the query via IPC (to bypass CSP)
                const result = await window.electronAPI.googleExecuteStructuredQuery({
                    projectId,
                    structuredQuery
                });

                if (!result.success) {
                    showMessage?.(result.error, 'error');
                    addLog?.('error', `Query error: ${result.error}`);
                    return;
                }

                const data = result.data;

                // Parse results
                const documents = (Array.isArray(data) ? data : [data])
                    .filter(item => item.document)
                    .map(item => {
                        const doc = item.document;
                        const pathParts = doc.name.split('/');
                        const docId = pathParts[pathParts.length - 1];
                        return {
                            id: docId,
                            data: parseFirestoreFields(doc.fields || {}),
                            path: queryParams.collection + '/' + docId
                        };
                    });

                setDocuments(documents);
                setExpandedNodes({ [collectionPath]: true });
                addLog?.('success', `JS Query returned ${documents.length} documents`);
                return;
            }

            // For service account, we can execute the JS query on the backend
            await window.electronAPI.disconnectFirebase();
            await window.electronAPI.connectFirebase(project.serviceAccountPath);

            // Execute the JS query
            const result = await window.electronAPI.executeJsQuery({
                collectionPath,
                jsQuery
            });

            if (result.success) {
                setDocuments(result.documents);
                setExpandedNodes({ [collectionPath]: true });
                addLog?.('success', `JS Query returned ${result.documents.length} documents`);
            } else {
                showMessage?.(result.error, 'error');
                addLog?.('error', `JS Query error: ${result.error}`);
            }
        } catch (error) {
            showMessage?.(error.message, 'error');
            addLog?.('error', `JS Query execution failed: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    // Helper: Convert JS operator to Firestore REST operator
    const convertOperator = (op) => {
        const opMap = {
            '==': 'EQUAL',
            '!=': 'NOT_EQUAL',
            '<': 'LESS_THAN',
            '<=': 'LESS_THAN_OR_EQUAL',
            '>': 'GREATER_THAN',
            '>=': 'GREATER_THAN_OR_EQUAL',
            'array-contains': 'ARRAY_CONTAINS',
            'array-contains-any': 'ARRAY_CONTAINS_ANY',
            'in': 'IN',
            'not-in': 'NOT_IN'
        };
        return opMap[op] || 'EQUAL';
    };

    // Helper: Convert JS value to Firestore REST value
    const convertValue = (value) => {
        if (value === null) return { nullValue: null };
        if (typeof value === 'boolean') return { booleanValue: value };
        if (typeof value === 'number') {
            return Number.isInteger(value) ? { integerValue: value.toString() } : { doubleValue: value };
        }
        if (typeof value === 'string') return { stringValue: value };
        if (Array.isArray(value)) {
            return { arrayValue: { values: value.map(convertValue) } };
        }
        return { stringValue: String(value) };
    };

    // Helper: Parse Firestore REST response fields
    const parseFirestoreFields = (fields) => {
        const result = {};
        for (const [key, value] of Object.entries(fields)) {
            result[key] = parseFirestoreValue(value);
        }
        return result;
    };

    const parseFirestoreValue = (value) => {
        if (value.stringValue !== undefined) return value.stringValue;
        if (value.integerValue !== undefined) return parseInt(value.integerValue, 10);
        if (value.doubleValue !== undefined) return value.doubleValue;
        if (value.booleanValue !== undefined) return value.booleanValue;
        if (value.nullValue !== undefined) return null;
        if (value.timestampValue !== undefined) {
            const date = new Date(value.timestampValue);
            return { _seconds: Math.floor(date.getTime() / 1000), _nanoseconds: 0 };
        }
        if (value.geoPointValue !== undefined) {
            return { _latitude: value.geoPointValue.latitude, _longitude: value.geoPointValue.longitude };
        }
        if (value.arrayValue !== undefined) {
            return (value.arrayValue.values || []).map(parseFirestoreValue);
        }
        if (value.mapValue !== undefined) {
            return parseFirestoreFields(value.mapValue.fields || {});
        }
        if (value.referenceValue !== undefined) return value.referenceValue;
        return value;
    };

    const handleCellEdit = (docId, field, value) => {
        const type = getType(value);
        setEditingCell({ docId, field });
        if (type === 'Array' || type === 'Map') {
            setEditValue(JSON.stringify(value, null, 2));
        } else {
            setEditValue(value === null ? 'null' : String(value));
        }
    };

    const handleCellSave = async () => {
        if (!editingCell) return;

        const doc = documents.find(d => d.id === editingCell.docId);
        if (!doc) return;

        let newValue;
        try {
            newValue = JSON.parse(editValue);
        } catch {
            if (editValue === 'null') newValue = null;
            else if (editValue === 'true') newValue = true;
            else if (editValue === 'false') newValue = false;
            else if (!isNaN(editValue) && editValue !== '') newValue = Number(editValue);
            else newValue = editValue;
        }

        // Check if value actually changed
        const oldValue = doc.data?.[editingCell.field];
        const isEqual = JSON.stringify(oldValue) === JSON.stringify(newValue);

        if (isEqual) {
            // No change, just close editor
            setEditingCell(null);
            return;
        }

        const newData = { ...doc.data, [editingCell.field]: newValue };

        try {
            let result;
            if (project?.authMethod === 'google') {
                // Use Google OAuth REST API
                result = await window.electronAPI.googleSetDocument({
                    projectId: project.projectId,
                    collectionPath: collectionPath,
                    documentId: doc.id,
                    data: newData
                });
            } else {
                // Use service account
                result = await window.electronAPI.setDocument({ documentPath: doc.path, data: newData });
            }
            if (result.success) {
                addLog?.('success', `Updated ${doc.id}.${editingCell.field}`);
                setDocuments(prev => prev.map(d =>
                    d.id === doc.id ? { ...d, data: newData } : d
                ));
            } else {
                showMessage?.(result.error, 'error');
            }
        } catch (error) {
            showMessage?.(error.message, 'error');
        }

        setEditingCell(null);
    };

    const handleCellKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleCellSave();
        }
        if (e.key === 'Escape') {
            setEditingCell(null);
        }
    };

    const handleJsonSave = async () => {
        try {
            const newDocsData = JSON.parse(jsonEditData);

            for (const [docId, data] of Object.entries(newDocsData)) {
                const doc = documents.find(d => d.id === docId);
                if (doc) {
                    await window.electronAPI.setDocument({ documentPath: doc.path, data });
                }
            }

            addLog?.('success', 'JSON changes saved');
            setJsonHasChanges(false);
            await loadDocuments();
        } catch (error) {
            showMessage?.(error.message, 'error');
        }
    };

    const handleCreateDocument = async () => {
        try {
            const data = JSON.parse(newDocData);
            const result = await window.electronAPI.createDocument({
                collectionPath,
                documentId: newDocId || null,
                data
            });
            if (result.success) {
                addLog?.('success', `Created document ${result.documentId}`);
                setCreateDialogOpen(false);
                setNewDocId('');
                setNewDocData('{}');
                await loadDocuments();
            } else {
                showMessage?.(result.error, 'error');
            }
        } catch (error) {
            showMessage?.(error.message, 'error');
        }
    };

    const handleExport = async () => {
        const result = await window.electronAPI.exportCollection(collectionPath);
        if (result.success) addLog?.('success', `Exported to ${result.filePath}`);
    };

    const handleImport = async () => {
        const result = await window.electronAPI.importDocuments(collectionPath);
        if (result.success) {
            addLog?.('success', `Imported ${result.count} documents`);
            await loadDocuments();
        }
    };

    const toggleNode = (path) => {
        setExpandedNodes(prev => ({ ...prev, [path]: !prev[path] }));
    };

    const getType = (value) => {
        if (value === null) return 'Null';
        if (value === undefined) return 'Undefined';
        if (Array.isArray(value)) return 'Array';
        if (typeof value === 'object' && value._seconds) return 'Timestamp';
        if (typeof value === 'object' && value._latitude) return 'GeoPoint';
        if (typeof value === 'object') return 'Map';
        if (typeof value === 'string') return 'String';
        if (typeof value === 'number') return Number.isInteger(value) ? 'Integer' : 'Number';
        if (typeof value === 'boolean') return 'Boolean';
        return typeof value;
    };

    const formatValue = (value, type) => {
        if (type === 'Null' || type === 'Undefined') return '';
        if (type === 'Timestamp' && value._seconds) return new Date(value._seconds * 1000).toISOString();
        if (type === 'GeoPoint') return `(${value._latitude}, ${value._longitude})`;
        if (type === 'Array' || type === 'Map') return '';
        if (type === 'String') return value;
        return String(value);
    };

    const getTypeColor = (type) => {
        const colors = {
            String: isDark ? '#9cdcfe' : '#0d47a1',
            Integer: isDark ? '#b5cea8' : '#0d47a1',
            Number: isDark ? '#b5cea8' : '#0d47a1',
            Boolean: isDark ? '#569cd6' : '#0d47a1',
            Null: isDark ? '#888' : '#666',
            Undefined: isDark ? '#888' : '#666',
            Array: isDark ? '#888' : '#666',
            Map: isDark ? '#888' : '#666',
            Timestamp: isDark ? '#ce9178' : '#0d47a1',
            GeoPoint: isDark ? '#ce9178' : '#0d47a1',
            Collection: '#1976d2',
            Document: '#ff9800'
        };
        return colors[type] || (isDark ? '#ccc' : '#333');
    };

    const allFields = useMemo(() => {
        const fields = new Set();
        documents.forEach(doc => doc.data && Object.keys(doc.data).forEach(k => fields.add(k)));
        return Array.from(fields).sort();
    }, [documents]);

    // Apply hidden columns filter
    const visibleFields = useMemo(() => {
        return allFields.filter(f => !hiddenColumns[f]);
    }, [allFields, hiddenColumns]);

    // Apply filters, sort, and text search to documents
    const filteredDocs = useMemo(() => {
        let result = [...documents];

        // Apply field filters
        if (filters.length > 0) {
            result = result.filter(doc => {
                return filters.every(filter => {
                    if (!filter.field || !filter.value) return true;
                    const docValue = doc.data?.[filter.field];
                    const filterValue = filter.value;

                    // Try to parse filter value as number if doc value is number
                    let compareValue = filterValue;
                    if (typeof docValue === 'number') {
                        const parsed = parseFloat(filterValue);
                        if (!isNaN(parsed)) compareValue = parsed;
                    }

                    switch (filter.operator) {
                        case '==': return String(docValue) === String(filterValue);
                        case '!=': return String(docValue) !== String(filterValue);
                        case '<': return docValue < compareValue;
                        case '>': return docValue > compareValue;
                        case '<=': return docValue <= compareValue;
                        case '>=': return docValue >= compareValue;
                        default: return true;
                    }
                });
            });
        }

        // Apply text search
        if (filterText.trim()) {
            const search = filterText.toLowerCase();
            result = result.filter(doc => {
                if (doc.id.toLowerCase().includes(search)) return true;
                if (doc.data) {
                    for (const [key, value] of Object.entries(doc.data)) {
                        const strVal = String(value).toLowerCase();
                        if (key.toLowerCase().includes(search) || strVal.includes(search)) return true;
                    }
                }
                return false;
            });
        }

        // Apply sort
        if (sortConfig.field) {
            result.sort((a, b) => {
                const aVal = a.data?.[sortConfig.field];
                const bVal = b.data?.[sortConfig.field];

                // Handle undefined/null
                if (aVal == null && bVal == null) return 0;
                if (aVal == null) return 1;
                if (bVal == null) return -1;

                // Compare
                let comparison = 0;
                if (typeof aVal === 'number' && typeof bVal === 'number') {
                    comparison = aVal - bVal;
                } else {
                    comparison = String(aVal).localeCompare(String(bVal));
                }

                return sortConfig.direction === 'desc' ? -comparison : comparison;
            });
        }

        return result;
    }, [documents, filters, filterText, sortConfig]);

    // Local log function that stores in queryLogs and calls parent
    const addLocalLog = (type, message) => {
        setQueryLogs(prev => [...prev, { type, message, timestamp: Date.now() }]);
        addLog?.(type, message);
    };

    // F5 keyboard shortcut - must be after handleRunQuery is defined
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'F5') {
                e.preventDefault();
                // Check current query mode from ref
                if (queryModeRef.current === 'js') {
                    executeJsQuery();
                } else {
                    loadDocuments();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [project, collectionPath, jsQuery, queryMode]);

    // Handle column resize - improved for smooth tracking
    const resizingRef = React.useRef(null);

    const handleResizeStart = (e, field) => {
        e.preventDefault();
        e.stopPropagation();
        const startX = e.clientX;
        const startWidth = columnWidths[field] || 100;
        resizingRef.current = { field, startX, startWidth };
        setResizing({ field, startX, startWidth });

        // Add cursor style to body during resize
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
    };

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!resizingRef.current) return;
            const { field, startX, startWidth } = resizingRef.current;
            const diff = e.clientX - startX;
            const newWidth = Math.max(50, startWidth + diff);
            setColumnWidths(prev => ({ ...prev, [field]: newWidth }));
        };

        const handleMouseUp = () => {
            if (!resizingRef.current) return;
            resizingRef.current = null;
            setResizing(null);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, []);

    // Memoized Editable Cell - optimized for performance
    const EditableCell = React.memo(({ docId, field, value, isEditing, onEdit }) => {
        const type = getType(value);
        const displayValue = type === 'Array' || type === 'Map' ? JSON.stringify(value) : formatValue(value, type);

        if (isEditing) {
            return (
                <TextField
                    size="small"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={handleCellSave}
                    onKeyDown={handleCellKeyDown}
                    autoFocus
                    fullWidth
                    multiline={type === 'Array' || type === 'Map'}
                    maxRows={4}
                    sx={{ '& .MuiInputBase-input': { fontFamily: 'monospace', fontSize: '0.8rem', py: 0.5 } }}
                />
            );
        }

        return (
            <div
                onClick={() => onEdit(docId, field, value)}
                title={displayValue || ''}
                style={{
                    cursor: 'pointer',
                    minHeight: 24,
                    padding: 4,
                    borderRadius: 4,
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis',
                    fontSize: '0.8rem',
                    color: value === undefined ? mutedColor : getTypeColor(type),
                    fontStyle: value === undefined ? 'italic' : 'normal',
                }}
            >
                {value === undefined ? '—' : displayValue}
            </div>
        );
    });

    // Tree View Row Component
    const TreeRow = ({ nodeKey, value, path, docId, depth = 0, isDoc = false, isCollection = false }) => {
        const nodeType = isCollection ? 'Collection' : isDoc ? 'Document' : getType(value);
        const isExpandable = isCollection || isDoc || nodeType === 'Array' || nodeType === 'Map';
        const isExpanded = expandedNodes[path];
        const displayValue = isExpandable ? '' : formatValue(value, nodeType);
        const isEditing = !isCollection && !isDoc && !isExpandable && editingCell?.docId === docId && editingCell?.field === nodeKey;

        return (
            <>
                <TableRow sx={{ '&:hover': { backgroundColor: hoverBg } }}>
                    <TableCell
                        sx={{
                            py: 0.25,
                            pl: depth * 2 + 1,
                            borderBottom: `1px solid ${borderColor}`,
                            cursor: isExpandable ? 'pointer' : 'default',
                            color: textColor,
                        }}
                        onClick={() => isExpandable && toggleNode(path)}
                    >
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            {isExpandable ? (
                                <IconButton size="small" sx={{ p: 0, mr: 0.5, color: mutedColor }}>
                                    {isExpanded ? <ExpandMoreIcon sx={{ fontSize: 16 }} /> : <ChevronRightIcon sx={{ fontSize: 16 }} />}
                                </IconButton>
                            ) : (
                                <Box sx={{ width: 20, mr: 0.5 }} />
                            )}
                            {isCollection && <CollectionIcon sx={{ fontSize: 14, color: '#1976d2', mr: 0.5 }} />}
                            {isDoc && <DocumentIcon sx={{ fontSize: 14, color: '#ff9800', mr: 0.5 }} />}
                            <Typography sx={{ fontSize: '0.8rem', color: textColor }}>{nodeKey}</Typography>
                        </Box>
                    </TableCell>
                    <TableCell sx={{ py: 0.25, borderBottom: `1px solid ${borderColor}` }}>
                        {!isCollection && !isDoc && !isExpandable ? (
                            isEditing ? (
                                <TextField
                                    size="small"
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onBlur={handleCellSave}
                                    onKeyDown={handleCellKeyDown}
                                    autoFocus
                                    sx={{ '& .MuiInputBase-input': { fontFamily: 'monospace', fontSize: '0.8rem', py: 0.5 } }}
                                />
                            ) : (
                                <Typography
                                    onClick={() => docId && handleCellEdit(docId, nodeKey, value)}
                                    sx={{
                                        fontSize: '0.8rem',
                                        color: getTypeColor(nodeType),
                                        cursor: 'pointer',
                                        '&:hover': { backgroundColor: isDark ? 'rgba(25, 118, 210, 0.2)' : '#e3f2fd', borderRadius: 0.5 },
                                        p: 0.5,
                                    }}
                                >
                                    {displayValue}
                                </Typography>
                            )
                        ) : (
                            <Typography sx={{ fontSize: '0.8rem', color: textColor }}>{displayValue}</Typography>
                        )}
                    </TableCell>
                    <TableCell sx={{ py: 0.25, borderBottom: `1px solid ${borderColor}` }}>
                        <Typography sx={{ fontSize: '0.75rem', color: getTypeColor(nodeType) }}>{nodeType}</Typography>
                    </TableCell>
                </TableRow>
                {isExpanded && isExpandable && !isCollection && !isDoc && value && (
                    Object.entries(value).map(([k, v]) => (
                        <TreeRow key={`${path}.${k}`} nodeKey={k} value={v} path={`${path}.${k}`} docId={docId} depth={depth + 1} />
                    ))
                )}
                {isExpanded && isDoc && value && (
                    Object.entries(value).map(([k, v]) => (
                        <TreeRow key={`${path}.${k}`} nodeKey={k} value={v} path={`${path}.${k}`} docId={docId} depth={depth + 1} />
                    ))
                )}
            </>
        );
    };

    // Get column width helper
    const getColWidth = (field) => columnWidths[field] || 120;

    // Virtualization: limit rendered rows for performance
    const MAX_VISIBLE_ROWS = 100;
    const displayedDocs = filteredDocs.slice(0, MAX_VISIBLE_ROWS);

    // Simple table view - CSS Grid based for smooth resize
    const renderTableView = () => {
        const gridColumns = `${getColWidth('__docId__')}px ${visibleFields.map(f => `${getColWidth(f)}px`).join(' ')}`;

        return (
            <Box sx={{ flexGrow: 1, overflow: 'auto', position: 'relative' }}>
                {documents.length > MAX_VISIBLE_ROWS && (
                    <Box sx={{ p: 0.5, backgroundColor: '#ff9800', color: '#000', fontSize: '0.75rem', textAlign: 'center' }}>
                        Showing first {MAX_VISIBLE_ROWS} of {documents.length} rows for performance
                    </Box>
                )}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: gridColumns,
                    fontSize: '0.8rem',
                    minWidth: 'max-content',
                }}>
                    {/* Header Row */}
                    <div
                        title="Doc ID"
                        style={{
                            position: 'sticky',
                            top: 0,
                            backgroundColor: bgColor,
                            padding: '8px 12px',
                            fontWeight: 600,
                            color: mutedColor,
                            fontStyle: 'italic',
                            borderBottom: `1px solid ${borderColor}`,
                            borderRight: `1px solid ${borderColor}`,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            zIndex: 10,
                        }}
                    >
                        Doc ID
                        {/* Invisible resize handle on right border */}
                        <div
                            onMouseDown={(e) => handleResizeStart(e, '__docId__')}
                            style={{
                                position: 'absolute',
                                right: -3,
                                top: 0,
                                bottom: 0,
                                width: 6,
                                cursor: 'col-resize',
                                zIndex: 20,
                            }}
                        />
                    </div>
                    {visibleFields.map((f, idx) => (
                        <div
                            key={f}
                            title={f}
                            style={{
                                position: 'sticky',
                                top: 0,
                                backgroundColor: bgColor,
                                padding: '8px 12px',
                                fontWeight: 600,
                                color: textColor,
                                borderBottom: `1px solid ${borderColor}`,
                                borderRight: `1px solid ${borderColor}`,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                zIndex: 10,
                            }}
                        >
                            {f}
                            {/* Invisible resize handle on right border */}
                            <div
                                onMouseDown={(e) => handleResizeStart(e, f)}
                                style={{
                                    position: 'absolute',
                                    right: -3,
                                    top: 0,
                                    bottom: 0,
                                    width: 6,
                                    cursor: 'col-resize',
                                    zIndex: 20,
                                }}
                            />
                        </div>
                    ))}

                    {/* Data Rows */}
                    {displayedDocs.map(doc => (
                        <React.Fragment key={doc.id}>
                            <div
                                title={doc.id}
                                style={{
                                    padding: '6px 4px',
                                    color: '#1976d2',
                                    fontWeight: 500,
                                    borderBottom: `1px solid ${borderColor}`,
                                    borderRight: `1px solid ${borderColor}`,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {doc.id}
                            </div>
                            {visibleFields.map(f => {
                                const value = doc.data?.[f];
                                const type = getType(value);
                                const displayValue = value === undefined ? '—' :
                                    (type === 'Array' || type === 'Map') ? JSON.stringify(value) : formatValue(value, type);
                                const isEditing = editingCell?.docId === doc.id && editingCell?.field === f;

                                return (
                                    <div
                                        key={f}
                                        title={displayValue}
                                        onClick={() => !isEditing && handleCellEdit(doc.id, f, value)}
                                        style={{
                                            padding: '6px 4px',
                                            borderBottom: `1px solid ${borderColor}`,
                                            borderRight: `1px solid ${borderColor}`,
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                            color: value === undefined ? mutedColor : getTypeColor(type),
                                            fontStyle: value === undefined ? 'italic' : 'normal',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        {isEditing ? (
                                            <input
                                                type="text"
                                                value={editValue}
                                                onChange={(e) => setEditValue(e.target.value)}
                                                onBlur={handleCellSave}
                                                onKeyDown={handleCellKeyDown}
                                                autoFocus
                                                style={{
                                                    width: '100%',
                                                    border: '1px solid #1976d2',
                                                    outline: 'none',
                                                    padding: '2px 4px',
                                                    fontSize: '0.8rem',
                                                    fontFamily: 'monospace',
                                                    backgroundColor: isDark ? '#2d2d2d' : '#fff',
                                                    color: isDark ? '#fff' : '#000',
                                                }}
                                            />
                                        ) : displayValue}
                                    </div>
                                );
                            })}
                        </React.Fragment>
                    ))}
                </div>
            </Box>
        );
    };

    // Tree View
    const renderTreeView = () => (
        <TableContainer sx={{ flexGrow: 1, overflow: 'auto' }}>
            <Table size="small" stickyHeader>
                <TableHead>
                    <TableRow>
                        <TableCell sx={{ fontWeight: 600, backgroundColor: bgColor, width: '40%', color: textColor }}>Key</TableCell>
                        <TableCell sx={{ fontWeight: 600, backgroundColor: bgColor, width: '40%', color: textColor }}>Value</TableCell>
                        <TableCell sx={{ fontWeight: 600, backgroundColor: bgColor, width: '20%', color: textColor }}>Type</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    <TreeRow nodeKey={collectionPath} value={null} path={collectionPath} isCollection depth={0} />
                    {expandedNodes[collectionPath] && documents.map(doc => (
                        <TreeRow key={doc.id} nodeKey={doc.id} value={doc.data} path={`${collectionPath}/${doc.id}`} docId={doc.id} isDoc depth={1} />
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    );

    // JSON View
    const renderJsonView = () => (
        <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ p: 1, borderBottom: `1px solid ${borderColor}`, display: 'flex', justifyContent: 'flex-end', backgroundColor: bgColor }}>
                <Button
                    variant="contained"
                    size="small"
                    startIcon={<SaveIcon />}
                    onClick={handleJsonSave}
                    disabled={!jsonHasChanges}
                >
                    Save Changes
                </Button>
            </Box>
            <textarea
                value={jsonEditData}
                onChange={(e) => { setJsonEditData(e.target.value); setJsonHasChanges(true); }}
                style={{
                    flexGrow: 1,
                    fontFamily: 'monospace',
                    fontSize: '0.8rem',
                    border: 'none',
                    outline: 'none',
                    padding: 16,
                    resize: 'none',
                    backgroundColor: '#1e1e1e',
                    color: '#d4d4d4',
                }}
            />
        </Box>
    );

    // Log View - shows query execution logs
    const renderLogView = () => (
        <Box sx={{ flexGrow: 1, overflow: 'auto', p: 1, backgroundColor: '#1e1e1e' }}>
            {queryLogs.length === 0 ? (
                <Typography sx={{ color: mutedColor, p: 2, textAlign: 'center' }}>
                    No logs yet. Run a query to see logs here.
                </Typography>
            ) : (
                queryLogs.map((log, idx) => (
                    <Box key={idx} sx={{ py: 0.5, borderBottom: '1px solid #333', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                        <span style={{ color: log.type === 'error' ? '#f44336' : log.type === 'success' ? '#4caf50' : '#2196f3' }}>
                            [{new Date(log.timestamp).toLocaleTimeString()}] [{log.type.toUpperCase()}]
                        </span>
                        <span style={{ color: '#d4d4d4', marginLeft: 8 }}>{log.message}</span>
                    </Box>
                ))
            )}
        </Box>
    );

    // Columns View - configure visible columns
    const renderColumnsView = () => (
        <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
            <Typography sx={{ fontWeight: 600, mb: 2, color: textColor }}>Toggle Column Visibility</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {allFields.map(field => (
                    <Box
                        key={field}
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            p: 1,
                            borderRadius: 1,
                            backgroundColor: hiddenColumns[field] ? 'transparent' : (isDark ? 'rgba(25, 118, 210, 0.2)' : '#e3f2fd'),
                            cursor: 'pointer',
                            '&:hover': { backgroundColor: isDark ? '#333' : '#f5f5f5' }
                        }}
                        onClick={() => setHiddenColumns(prev => ({ ...prev, [field]: !prev[field] }))}
                    >
                        <input
                            type="checkbox"
                            checked={!hiddenColumns[field]}
                            onChange={() => setHiddenColumns(prev => ({ ...prev, [field]: !prev[field] }))}
                        />
                        <Typography sx={{ fontSize: '0.85rem', color: textColor }}>{field}</Typography>
                    </Box>
                ))}
            </Box>
            {allFields.length === 0 && (
                <Typography sx={{ color: mutedColor }}>No columns to configure. Load documents first.</Typography>
            )}
        </Box>
    );

    // JS Query Editor
    const renderJsQueryEditor = () => (
        <Box sx={{ borderBottom: `1px solid ${borderColor}`, backgroundColor: '#1e1e1e' }}>
            <textarea
                value={jsQuery}
                onChange={(e) => setJsQuery(e.target.value)}
                style={{
                    width: '100%',
                    height: 160,
                    fontFamily: 'Consolas, Monaco, "Courier New", monospace',
                    fontSize: '13px',
                    lineHeight: '1.5',
                    border: 'none',
                    outline: 'none',
                    padding: 16,
                    resize: 'none',
                    backgroundColor: '#1e1e1e',
                    color: '#d4d4d4',
                }}
                spellCheck={false}
            />
            <Box sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                px: 2,
                py: 0.5,
                backgroundColor: '#252526',
                borderTop: '1px solid #333',
            }}>
                <Typography sx={{ fontSize: '0.7rem', color: '#888' }}>
                    💡 Press <strong style={{ color: '#4ec9b0' }}>F5</strong> to run your JS Query • Define an <code style={{ color: '#dcdcaa' }}>async function run()</code> that returns a QuerySnapshot
                </Typography>
                <Typography sx={{ fontSize: '0.7rem', color: '#4caf50' }}>
                    ✓ Works with Google OAuth & Service Account
                </Typography>
            </Box>
        </Box>
    );

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: isDark ? '#1e1e1e' : '#fff' }}>
            {/* Query Bar */}
            <Box sx={{ display: 'flex', alignItems: 'center', p: 1, borderBottom: `1px solid ${borderColor}`, gap: 1, backgroundColor: bgColor }}>
                <ToggleButtonGroup value={queryMode} exclusive onChange={(_, v) => v && setQueryMode(v)} size="small">
                    <ToggleButton value="simple" sx={{ textTransform: 'none', px: 1.5 }}>
                        <FilterIcon sx={{ fontSize: 16, mr: 0.5 }} /> Simple
                    </ToggleButton>
                    <ToggleButton value="js" sx={{ textTransform: 'none', px: 1.5, fontFamily: 'monospace' }}>
                        JS Query
                    </ToggleButton>
                </ToggleButtonGroup>

                <Chip label={project?.projectId} size="small" sx={{ backgroundColor: isDark ? 'rgba(25, 118, 210, 0.3)' : '#e3f2fd', ml: 1 }} />

                <Box sx={{ flexGrow: 1 }} />

                <Tooltip title={isCollectionFavorite ? "Remove from favorites" : "Add to favorites"}>
                    <IconButton
                        size="small"
                        onClick={() => {
                            const added = toggleFavorite(project?.projectId, project?.projectId, collectionPath);
                            showMessage?.(added ? `Added ${collectionPath} to favorites` : `Removed ${collectionPath} from favorites`, 'info');
                        }}
                    >
                        {isCollectionFavorite ? (
                            <StarIcon sx={{ fontSize: 18, color: '#ffc107' }} />
                        ) : (
                            <StarBorderIcon sx={{ fontSize: 18 }} />
                        )}
                    </IconButton>
                </Tooltip>
                <Tooltip title="Undo"><IconButton size="small"><UndoIcon sx={{ fontSize: 18 }} /></IconButton></Tooltip>
                <Tooltip title="Copy"><IconButton size="small"><CopyIcon sx={{ fontSize: 18 }} /></IconButton></Tooltip>
                <Tooltip title={`Run Query (F5)\n${queryMode === 'js' ? 'Executes JS Query' : 'Executes Simple Query'}`}>
                    <Button variant="contained" size="small" onClick={handleRunQuery} startIcon={<RunIcon />} sx={{ ml: 1 }}>
                        Run (F5)
                    </Button>
                </Tooltip>
                <TextField size="small" type="number" value={limit} onChange={(e) => setLimit(e.target.value)} label="#" sx={{ width: 60, ml: 1 }} inputProps={{ min: 1, max: 500 }} />
            </Box>

            {/* JS Query Editor */}
            {queryMode === 'js' && renderJsQueryEditor()}

            {/* Collection path bar */}
            <Box sx={{ display: 'flex', alignItems: 'center', p: 0.5, borderBottom: `1px solid ${borderColor}`, gap: 1 }}>
                <CollectionIcon sx={{ fontSize: 16, color: mutedColor, ml: 1 }} />
                <Typography sx={{ fontSize: '0.8rem', color: textColor }}>{collectionPath}</Typography>
                <Box sx={{ flexGrow: 1 }} />
                <TextField size="small" placeholder="Search" value={filterText} onChange={(e) => setFilterText(e.target.value)} sx={{ width: 150 }} InputProps={{ sx: { fontSize: '0.8rem', height: 28 } }} />
            </Box>

            {/* Filter and Sort toolbar - only show for Simple query mode */}
            {queryMode === 'simple' && (
                <Box sx={{ display: 'flex', alignItems: 'center', p: 0.5, borderBottom: `1px solid ${borderColor}`, gap: 1 }}>
                    {/* Filter Button */}
                    <Box sx={{ position: 'relative' }} ref={filterMenuRef}>
                        <Button
                            size="small"
                            onClick={() => setFilterMenuOpen(!filterMenuOpen)}
                            startIcon={<FilterIcon sx={{ fontSize: 16 }} />}
                            sx={{
                                textTransform: 'none',
                                fontSize: '0.75rem',
                                backgroundColor: filters.length > 0 ? (isDark ? 'rgba(25, 118, 210, 0.3)' : '#e3f2fd') : 'transparent',
                            }}
                        >
                            Filter {filters.length > 0 && `(${filters.length})`}
                        </Button>
                        {filterMenuOpen && (
                            <Box
                                sx={{
                                    position: 'absolute',
                                    top: '100%',
                                    left: 0,
                                    mt: 0.5,
                                    backgroundColor: isDark ? '#2d2d2d' : '#fff',
                                    border: `1px solid ${borderColor}`,
                                    borderRadius: 1,
                                    boxShadow: 3,
                                    zIndex: 1000,
                                    minWidth: 320,
                                    p: 1.5,
                                }}
                            >
                                <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, mb: 1, color: textColor }}>Add Filter</Typography>
                                {filters.map((filter, idx) => (
                                    <Box key={idx} sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
                                        <select
                                            value={filter.field}
                                            onChange={(e) => {
                                                const newFilters = [...filters];
                                                newFilters[idx].field = e.target.value;
                                                setFilters(newFilters);
                                            }}
                                            style={{ flex: 1, padding: '4px 8px', fontSize: '0.8rem', backgroundColor: isDark ? '#1e1e1e' : '#fff', color: textColor, border: `1px solid ${borderColor}`, borderRadius: 4 }}
                                        >
                                            <option value="">Select field</option>
                                            {allFields.map(f => <option key={f} value={f}>{f}</option>)}
                                        </select>
                                        <select
                                            value={filter.operator}
                                            onChange={(e) => {
                                                const newFilters = [...filters];
                                                newFilters[idx].operator = e.target.value;
                                                setFilters(newFilters);
                                            }}
                                            style={{ width: 70, padding: '4px 8px', fontSize: '0.8rem', backgroundColor: isDark ? '#1e1e1e' : '#fff', color: textColor, border: `1px solid ${borderColor}`, borderRadius: 4 }}
                                        >
                                            <option value="==">==</option>
                                            <option value="!=">!=</option>
                                            <option value="<">&lt;</option>
                                            <option value=">">&gt;</option>
                                            <option value="<=">≤</option>
                                            <option value=">=">≥</option>
                                        </select>
                                        <input
                                            value={filter.value}
                                            onChange={(e) => {
                                                const newFilters = [...filters];
                                                newFilters[idx].value = e.target.value;
                                                setFilters(newFilters);
                                            }}
                                            placeholder="Value"
                                            style={{ flex: 1, padding: '4px 8px', fontSize: '0.8rem', backgroundColor: isDark ? '#1e1e1e' : '#fff', color: textColor, border: `1px solid ${borderColor}`, borderRadius: 4 }}
                                        />
                                        <IconButton size="small" onClick={() => setFilters(filters.filter((_, i) => i !== idx))}>×</IconButton>
                                    </Box>
                                ))}
                                <Button size="small" onClick={() => setFilters([...filters, { field: '', operator: '==', value: '' }])} sx={{ fontSize: '0.75rem', textTransform: 'none' }}>
                                    + Add Filter
                                </Button>
                                {filters.length > 0 && (
                                    <Button size="small" variant="contained" onClick={() => setFilterMenuOpen(false)} sx={{ fontSize: '0.75rem', ml: 1 }}>
                                        Apply
                                    </Button>
                                )}
                            </Box>
                        )}
                    </Box>

                    {/* Sort Button */}
                    <Box sx={{ position: 'relative' }} ref={sortMenuRef}>
                        <Button
                            size="small"
                            onClick={() => setSortMenuOpen(!sortMenuOpen)}
                            startIcon={<SortIcon sx={{ fontSize: 16 }} />}
                            sx={{
                                textTransform: 'none',
                                fontSize: '0.75rem',
                                backgroundColor: sortConfig.field ? (isDark ? 'rgba(25, 118, 210, 0.3)' : '#e3f2fd') : 'transparent',
                            }}
                        >
                            Sort {sortConfig.field && `(${sortConfig.field} ${sortConfig.direction === 'asc' ? '↑' : '↓'})`}
                        </Button>
                        {sortMenuOpen && (
                            <Box
                                sx={{
                                    position: 'absolute',
                                    top: '100%',
                                    left: 0,
                                    mt: 0.5,
                                    backgroundColor: isDark ? '#2d2d2d' : '#fff',
                                    border: `1px solid ${borderColor}`,
                                    borderRadius: 1,
                                    boxShadow: 3,
                                    zIndex: 1000,
                                    minWidth: 200,
                                    p: 1,
                                }}
                            >
                                <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, mb: 1, color: textColor }}>Sort By</Typography>
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, maxHeight: 200, overflow: 'auto' }}>
                                    <Box
                                        onClick={() => { setSortConfig({ field: '', direction: 'asc' }); setSortMenuOpen(false); }}
                                        sx={{ px: 1, py: 0.5, cursor: 'pointer', borderRadius: 0.5, '&:hover': { backgroundColor: isDark ? '#333' : '#f5f5f5' }, color: !sortConfig.field ? '#1976d2' : textColor }}
                                    >
                                        None
                                    </Box>
                                    {allFields.map(f => (
                                        <Box
                                            key={f}
                                            onClick={() => {
                                                if (sortConfig.field === f) {
                                                    setSortConfig({ field: f, direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' });
                                                } else {
                                                    setSortConfig({ field: f, direction: 'asc' });
                                                }
                                                setSortMenuOpen(false);
                                            }}
                                            sx={{
                                                px: 1,
                                                py: 0.5,
                                                cursor: 'pointer',
                                                borderRadius: 0.5,
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                '&:hover': { backgroundColor: isDark ? '#333' : '#f5f5f5' },
                                                color: sortConfig.field === f ? '#1976d2' : textColor,
                                                fontWeight: sortConfig.field === f ? 600 : 400,
                                            }}
                                        >
                                            <span style={{ fontSize: '0.8rem' }}>{f}</span>
                                            {sortConfig.field === f && <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>}
                                        </Box>
                                    ))}
                                </Box>
                            </Box>
                        )}
                    </Box>
                </Box>
            )}

            {/* View tabs */}
            <Box sx={{ display: 'flex', alignItems: 'center', borderBottom: `1px solid ${borderColor}` }}>
                <ToggleButtonGroup value={viewMode} exclusive onChange={(_, v) => v && setViewMode(v)} size="small" sx={{ m: 0.5 }}>
                    <ToggleButton value="table" sx={{ textTransform: 'none', px: 1 }}><TableIcon sx={{ fontSize: 16, mr: 0.5 }} />Table</ToggleButton>
                    <ToggleButton value="tree" sx={{ textTransform: 'none', px: 1 }}><TreeIcon sx={{ fontSize: 16, mr: 0.5 }} />Tree</ToggleButton>
                    <ToggleButton value="json" sx={{ textTransform: 'none', px: 1 }}><JsonIcon sx={{ fontSize: 16, mr: 0.5 }} />JSON</ToggleButton>
                </ToggleButtonGroup>
                <Box sx={{ flexGrow: 1 }} />
                <Typography sx={{ fontSize: '0.75rem', color: mutedColor, mr: 1 }}>{documents.length} doc{documents.length !== 1 ? 's' : ''}</Typography>
                {viewMode === 'table' && (
                    <Box sx={{ position: 'relative' }} ref={columnsMenuRef}>
                        <Tooltip title="Show/Hide Columns">
                            <Button
                                size="small"
                                onClick={(e) => setColumnsMenuAnchor(columnsMenuAnchor ? null : e.currentTarget)}
                                startIcon={<ColumnsIcon sx={{ fontSize: 16 }} />}
                                sx={{ textTransform: 'none', fontSize: '0.75rem', mr: 1 }}
                            >
                                Columns
                            </Button>
                        </Tooltip>
                        {columnsMenuAnchor && (
                            <Box
                                sx={{
                                    position: 'absolute',
                                    top: '100%',
                                    right: 0,
                                    mt: 0.5,
                                    backgroundColor: isDark ? '#2d2d2d' : '#fff',
                                    border: `1px solid ${borderColor}`,
                                    borderRadius: 1,
                                    boxShadow: 3,
                                    zIndex: 1000,
                                    minWidth: 200,
                                    maxHeight: 300,
                                    overflow: 'auto',
                                    p: 1,
                                }}
                            >
                                <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, mb: 1, color: mutedColor }}>
                                    Toggle Columns ({visibleFields.length}/{allFields.length})
                                </Typography>
                                {allFields.map(field => (
                                    <Box
                                        key={field}
                                        sx={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 1,
                                            py: 0.5,
                                            px: 0.5,
                                            borderRadius: 0.5,
                                            cursor: 'pointer',
                                            '&:hover': { backgroundColor: isDark ? '#333' : '#f5f5f5' }
                                        }}
                                        onClick={() => setHiddenColumns(prev => ({ ...prev, [field]: !prev[field] }))}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={!hiddenColumns[field]}
                                            onChange={() => setHiddenColumns(prev => ({ ...prev, [field]: !prev[field] }))}
                                            style={{ cursor: 'pointer' }}
                                        />
                                        <Typography sx={{ fontSize: '0.8rem', color: textColor }}>{field}</Typography>
                                    </Box>
                                ))}
                                {allFields.length === 0 && (
                                    <Typography sx={{ fontSize: '0.75rem', color: mutedColor }}>No columns</Typography>
                                )}
                            </Box>
                        )}
                    </Box>
                )}
                <Tooltip title="Refresh"><IconButton size="small" onClick={loadDocuments}><RefreshIcon sx={{ fontSize: 18 }} /></IconButton></Tooltip>
                <Tooltip title="Export"><IconButton size="small" onClick={handleExport}><ExportIcon sx={{ fontSize: 18 }} /></IconButton></Tooltip>
                <Tooltip title="Import"><IconButton size="small" onClick={handleImport}><ImportIcon sx={{ fontSize: 18 }} /></IconButton></Tooltip>
                <Tooltip title="Add"><IconButton size="small" onClick={() => setCreateDialogOpen(true)}><AddIcon sx={{ fontSize: 18 }} /></IconButton></Tooltip>
                <Tooltip title="Settings"><IconButton size="small"><SettingsIcon sx={{ fontSize: 18 }} /></IconButton></Tooltip>
            </Box>

            {/* Content */}
            <Box sx={{ flexGrow: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexGrow: 1 }}><CircularProgress /></Box>
                ) : (
                    <>
                        {viewMode === 'table' && renderTableView()}
                        {viewMode === 'tree' && renderTreeView()}
                        {viewMode === 'json' && renderJsonView()}
                        {viewMode === 'log' && renderLogView()}
                        {viewMode === 'columns' && renderColumnsView()}
                    </>
                )}
            </Box>

            {/* Create Dialog */}
            <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Create Document</DialogTitle>
                <DialogContent>
                    <TextField fullWidth label="Document ID (optional)" value={newDocId} onChange={(e) => setNewDocId(e.target.value)} size="small" sx={{ mb: 2, mt: 1 }} />
                    <TextField fullWidth label="Data (JSON)" value={newDocData} onChange={(e) => setNewDocData(e.target.value)} multiline rows={8} sx={{ '& .MuiInputBase-input': { fontFamily: 'monospace', fontSize: '0.85rem' } }} />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
                    <Button variant="contained" onClick={handleCreateDocument}>Create</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

export default CollectionTab;
