/**
 * Custom Hook: useCollectionData
 * Manages Firestore collection data loading, querying, and document operations
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { parseFirestoreFields } from '../utils/firestoreUtils';
import { getParsedStructuredQuery, generateDefaultJsQuery, parseQueryResponse } from '../utils/queryUtils';

/**
 * Custom hook for managing collection data operations
 * @param {Object} project - The Firebase project configuration
 * @param {string} collectionPath - The collection path to load
 * @param {Object} options - Hook options
 * @param {number} options.defaultLimit - Default document limit
 * @param {Function} options.addLog - Logger function
 * @param {Function} options.showMessage - Message display function
 * @returns {Object} - Collection data and operations
 */
export const useCollectionData = (project, collectionPath, options = {}) => {
    const { defaultLimit = 50, addLog, showMessage } = options;

    // State
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(false);
    const [limit, setLimit] = useState(defaultLimit);
    const [jsQuery, setJsQuery] = useState('');
    const [filters, setFilters] = useState([]);
    const [sortConfig, setSortConfig] = useState({ field: '', direction: 'asc' });

    // Refs for keyboard shortcuts
    const queryModeRef = useRef('simple');

    /**
     * Sets the current query mode ref for keyboard shortcuts
     */
    const setQueryModeRef = useCallback((mode) => {
        queryModeRef.current = mode;
    }, []);

    /**
     * Loads documents from the collection using simple query
     */
    const loadDocuments = useCallback(async () => {
        if (!collectionPath) return;

        setLoading(true);
        try {
            const parsedLimit = parseInt(limit, 10) || 50;
            let result;

            if (project?.authMethod === 'google') {
                result = await window.electronAPI.googleGetDocuments({
                    projectId: project.projectId,
                    collectionPath,
                    limit: parsedLimit
                });
            } else {
                await window.electronAPI.disconnectFirebase();
                await window.electronAPI.connectFirebase(project.serviceAccountPath);

                result = await window.electronAPI.getDocuments({
                    collectionPath,
                    limit: parsedLimit
                });
            }

            if (result.success) {
                setDocuments(result.documents);
                addLog?.('success', `Loaded ${result.documents.length} documents from ${collectionPath}`);
                return { success: true, documents: result.documents };
            } else {
                showMessage?.(result.error, 'error');
                return { success: false, error: result.error };
            }
        } catch (error) {
            showMessage?.(error.message, 'error');
            return { success: false, error: error.message };
        } finally {
            setLoading(false);
        }
    }, [project, collectionPath, limit, addLog, showMessage]);

    /**
     * Executes a JS query
     */
    const executeJsQuery = useCallback(async () => {
        if (!collectionPath || !jsQuery) return;

        setLoading(true);
        addLog?.('info', 'Executing JS Query...');

        try {
            if (project?.authMethod === 'google') {
                // Parse and build structured query
                const { params, structuredQuery } = getParsedStructuredQuery(jsQuery, collectionPath, limit);
                addLog?.('info', `Parsed query: collection=${params.collection}, limit=${params.limit}`);

                // Execute via IPC
                const result = await window.electronAPI.googleExecuteStructuredQuery({
                    projectId: project.projectId,
                    structuredQuery
                });

                if (!result.success) {
                    showMessage?.(result.error, 'error');
                    addLog?.('error', `Query error: ${result.error}`);
                    return { success: false, error: result.error };
                }

                // Parse response
                const parsedDocuments = parseQueryResponse(result.data, params.collection, parseFirestoreFields);
                setDocuments(parsedDocuments);
                addLog?.('success', `JS Query returned ${parsedDocuments.length} documents`);
                return { success: true, documents: parsedDocuments };
            }

            // Service account execution
            await window.electronAPI.disconnectFirebase();
            await window.electronAPI.connectFirebase(project.serviceAccountPath);

            const result = await window.electronAPI.executeJsQuery({ collectionPath, jsQuery });

            if (result.success) {
                setDocuments(result.documents);
                addLog?.('success', `JS Query returned ${result.documents.length} documents`);
                return { success: true, documents: result.documents };
            } else {
                showMessage?.(result.error, 'error');
                addLog?.('error', `JS Query error: ${result.error}`);
                return { success: false, error: result.error };
            }
        } catch (error) {
            showMessage?.(error.message, 'error');
            addLog?.('error', `JS Query execution failed: ${error.message}`);
            return { success: false, error: error.message };
        } finally {
            setLoading(false);
        }
    }, [project, collectionPath, jsQuery, limit, addLog, showMessage]);

    /**
     * Updates a document field
     */
    const updateDocument = useCallback(async (docId, newData) => {
        const doc = documents.find(d => d.id === docId);
        if (!doc) return { success: false, error: 'Document not found' };

        try {
            let result;
            if (project?.authMethod === 'google') {
                result = await window.electronAPI.googleSetDocument({
                    projectId: project.projectId,
                    collectionPath,
                    documentId: docId,
                    data: newData
                });
            } else {
                result = await window.electronAPI.setDocument({
                    documentPath: doc.path,
                    data: newData
                });
            }

            if (result.success) {
                setDocuments(prev => prev.map(d =>
                    d.id === docId ? { ...d, data: newData } : d
                ));
                return { success: true };
            } else {
                showMessage?.(result.error, 'error');
                return { success: false, error: result.error };
            }
        } catch (error) {
            showMessage?.(error.message, 'error');
            return { success: false, error: error.message };
        }
    }, [project, collectionPath, documents, showMessage]);

    /**
     * Creates a new document
     */
    const createDocument = useCallback(async (documentId, data) => {
        try {
            let result;

            if (project?.authMethod === 'google') {
                // For Google OAuth, use the googleSetDocument API
                result = await window.electronAPI.googleSetDocument({
                    projectId: project.projectId,
                    collectionPath,
                    documentId: documentId || `auto_${Date.now()}`,
                    data
                });
                if (result.success) {
                    addLog?.('success', `Created document ${documentId || 'with auto ID'}`);
                    await loadDocuments();
                    return { success: true, documentId: documentId || result.documentId };
                }
            } else {
                // For service account, ensure connection and use createDocument
                await window.electronAPI.disconnectFirebase();
                await window.electronAPI.connectFirebase(project.serviceAccountPath);

                result = await window.electronAPI.createDocument({
                    collectionPath,
                    documentId: documentId || null,
                    data
                });

                if (result.success) {
                    addLog?.('success', `Created document ${result.documentId}`);
                    await loadDocuments();
                    return { success: true, documentId: result.documentId };
                }
            }

            showMessage?.(result.error, 'error');
            return { success: false, error: result.error };
        } catch (error) {
            showMessage?.(error.message, 'error');
            return { success: false, error: error.message };
        }
    }, [project, collectionPath, addLog, showMessage, loadDocuments]);

    /**
     * Saves multiple documents (for JSON editing)
     */
    const saveDocumentsFromJson = useCallback(async (docsData) => {
        try {
            for (const [docId, data] of Object.entries(docsData)) {
                const doc = documents.find(d => d.id === docId);
                if (doc) {
                    await window.electronAPI.setDocument({
                        documentPath: doc.path,
                        data
                    });
                }
            }
            addLog?.('success', 'JSON changes saved');
            await loadDocuments();
            return { success: true };
        } catch (error) {
            showMessage?.(error.message, 'error');
            return { success: false, error: error.message };
        }
    }, [documents, addLog, showMessage, loadDocuments]);

    /**
     * Exports collection to file
     */
    const exportCollection = useCallback(async () => {
        try {
            if (project?.authMethod === 'google') {
                // For Google OAuth, export the currently loaded documents
                if (documents.length === 0) {
                    showMessage?.('No documents to export', 'warning');
                    return { success: false, error: 'No documents to export' };
                }

                const exportData = {};
                documents.forEach(doc => {
                    exportData[doc.id] = doc.data;
                });

                // Create a download by creating a blob and link
                const jsonString = JSON.stringify(exportData, null, 2);
                const blob = new Blob([jsonString], { type: 'application/json' });
                const url = URL.createObjectURL(blob);

                const link = document.createElement('a');
                link.href = url;
                link.download = `${collectionPath.replace(/\//g, '_')}_export.json`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);

                addLog?.('success', `Exported ${documents.length} documents`);
                return { success: true };
            } else {
                // For service account, use the IPC handler
                const result = await window.electronAPI.exportCollection(collectionPath);
                if (result.success) {
                    addLog?.('success', `Exported to ${result.filePath}`);
                } else if (result.error !== 'Export cancelled') {
                    showMessage?.(result.error, 'error');
                }
                return result;
            }
        } catch (error) {
            showMessage?.(error.message, 'error');
            return { success: false, error: error.message };
        }
    }, [project, collectionPath, documents, addLog, showMessage]);

    /**
     * Imports documents from file
     */
    const importDocuments = useCallback(async () => {
        try {
            if (project?.authMethod === 'google') {
                // For Google OAuth, handle file selection via input element
                return new Promise((resolve) => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = '.json';
                    input.onchange = async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) {
                            resolve({ success: false, error: 'No file selected' });
                            return;
                        }

                        try {
                            const text = await file.text();
                            const data = JSON.parse(text);
                            let count = 0;

                            // Import each document
                            for (const [docId, docData] of Object.entries(data)) {
                                const result = await window.electronAPI.googleSetDocument({
                                    projectId: project.projectId,
                                    collectionPath,
                                    documentId: docId,
                                    data: docData
                                });
                                if (result.success) count++;
                            }

                            addLog?.('success', `Imported ${count} documents`);
                            await loadDocuments();
                            resolve({ success: true, count });
                        } catch (parseError) {
                            showMessage?.(`Invalid JSON file: ${parseError.message}`, 'error');
                            resolve({ success: false, error: parseError.message });
                        }
                    };
                    input.click();
                });
            } else {
                // For service account, ensure connection and use importDocuments
                await window.electronAPI.disconnectFirebase();
                await window.electronAPI.connectFirebase(project.serviceAccountPath);

                const result = await window.electronAPI.importDocuments(collectionPath);
                if (result.success) {
                    addLog?.('success', `Imported ${result.count} documents`);
                    await loadDocuments();
                } else if (result.error !== 'Import cancelled') {
                    showMessage?.(result.error, 'error');
                }
                return result;
            }
        } catch (error) {
            showMessage?.(error.message, 'error');
            return { success: false, error: error.message };
        }
    }, [project, collectionPath, addLog, showMessage, loadDocuments]);

    /**
     * Generates JS query from current filters, sort, and limit
     */
    const generateQueryFromFilters = useCallback(() => {
        if (!collectionPath) return '';

        let query = `async function run() {\n    const snapshot = await db\n        .collection('${collectionPath}')`;

        // Add where clauses for each filter
        const validFilters = filters.filter(f => f.field && f.value !== '');
        validFilters.forEach(filter => {
            // Try to parse value as number or boolean
            let value = filter.value;
            if (value === 'true') value = true;
            else if (value === 'false') value = false;
            else if (!isNaN(Number(value)) && value !== '') value = Number(value);
            else value = `'${value}'`;

            query += `\n        .where('${filter.field}', '${filter.operator}', ${value})`;
        });

        // Add orderBy if set
        if (sortConfig.field) {
            query += `\n        .orderBy('${sortConfig.field}', '${sortConfig.direction}')`;
        }

        // Add limit
        query += `\n        .limit(${limit})`;
        query += `\n        .get();\n    return snapshot;\n}`;

        return query;
    }, [collectionPath, filters, sortConfig, limit]);

    /**
     * Updates JS query when filters/sort/limit change
     */
    const updateJsQueryFromFilters = useCallback(() => {
        const newQuery = generateQueryFromFilters();
        if (newQuery) {
            setJsQuery(newQuery);
        }
    }, [generateQueryFromFilters]);

    // Initialize and update JS query when collection, filters, sort, or limit change
    useEffect(() => {
        if (collectionPath) {
            updateJsQueryFromFilters();
        }
    }, [collectionPath, filters, sortConfig, limit, updateJsQueryFromFilters]);

    // Initial load
    useEffect(() => {
        if (collectionPath) {
            loadDocuments();
        }
    }, [collectionPath]);

    return {
        // State
        documents,
        loading,
        limit,
        jsQuery,
        filters,
        sortConfig,

        // Setters
        setLimit,
        setJsQuery,
        setDocuments,
        setQueryModeRef,
        setFilters,
        setSortConfig,

        // Query operations
        loadDocuments,
        executeJsQuery,
        generateQueryFromFilters,

        // Document operations
        updateDocument,
        createDocument,
        saveDocumentsFromJson,

        // Import/Export
        exportCollection,
        importDocuments,

        // Refs
        queryModeRef
    };
};

export default useCollectionData;
