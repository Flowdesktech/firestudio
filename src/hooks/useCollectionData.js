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
            const result = await window.electronAPI.createDocument({
                collectionPath,
                documentId: documentId || null,
                data
            });

            if (result.success) {
                addLog?.('success', `Created document ${result.documentId}`);
                await loadDocuments();
                return { success: true, documentId: result.documentId };
            } else {
                showMessage?.(result.error, 'error');
                return { success: false, error: result.error };
            }
        } catch (error) {
            showMessage?.(error.message, 'error');
            return { success: false, error: error.message };
        }
    }, [collectionPath, addLog, showMessage, loadDocuments]);

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
        const result = await window.electronAPI.exportCollection(collectionPath);
        if (result.success) {
            addLog?.('success', `Exported to ${result.filePath}`);
        }
        return result;
    }, [collectionPath, addLog]);

    /**
     * Imports documents from file
     */
    const importDocuments = useCallback(async () => {
        const result = await window.electronAPI.importDocuments(collectionPath);
        if (result.success) {
            addLog?.('success', `Imported ${result.count} documents`);
            await loadDocuments();
        }
        return result;
    }, [collectionPath, addLog, loadDocuments]);

    // Initialize JS query when collection changes
    useEffect(() => {
        if (collectionPath) {
            setJsQuery(generateDefaultJsQuery(collectionPath, limit));
        }
    }, [collectionPath, limit]);

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

        // Setters
        setLimit,
        setJsQuery,
        setDocuments,
        setQueryModeRef,

        // Query operations
        loadDocuments,
        executeJsQuery,

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
