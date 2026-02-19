/**
 * Firestore Controller
 * Handles all Firestore database operations via IPC
 */

const { ipcMain, dialog } = require('electron');
const fs = require('fs');
const vm = require('vm');

let adminRef = null;
let dbRef = null;

function normalizeFirestoreError(error) {
  const message = error?.message || String(error);
  if (message.includes('5 NOT_FOUND') || message.includes('NOT_FOUND')) {
    return 'Firestore database not found. Enable Firestore in the Firebase console for this project.';
  }
  if (message.includes('Permission denied') || message.includes('PERMISSION_DENIED')) {
    return 'Permission denied. Verify the service account has Firestore access.';
  }
  return message;
}

/**
 * Sets references to admin SDK and database
 */
function setRefs(admin, db) {
  adminRef = admin;
  dbRef = db;
}

function getDb() {
  return dbRef;
}

/**
 * Registers all Firestore IPC handlers
 */
function registerHandlers() {
  // Get all collections
  ipcMain.handle('firestore:getCollections', async () => {
    try {
      if (!dbRef) throw new Error('Not connected to Firebase');
      const collections = await dbRef.listCollections();
      return { success: true, collections: collections.map((col) => col.id) };
    } catch (error) {
      return { success: false, error: normalizeFirestoreError(error) };
    }
  });

  // Get documents with pagination
  ipcMain.handle('firestore:getDocuments', async (event, { collectionPath, limit = 50, startAfter = null }) => {
    try {
      if (!dbRef) throw new Error('Not connected to Firebase');

      let query = dbRef.collection(collectionPath).limit(limit);
      if (startAfter) {
        const startDoc = await dbRef.collection(collectionPath).doc(startAfter).get();
        if (startDoc.exists) query = query.startAfter(startDoc);
      }

      const snapshot = await query.get();
      const documents = [];
      snapshot.forEach((doc) => {
        documents.push({ id: doc.id, data: doc.data(), path: doc.ref.path });
      });

      return { success: true, documents };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Get single document
  ipcMain.handle('firestore:getDocument', async (event, documentPath) => {
    try {
      if (!dbRef) throw new Error('Not connected to Firebase');
      const doc = await dbRef.doc(documentPath).get();
      if (!doc.exists) return { success: false, error: 'Document not found' };

      const subcollections = await doc.ref.listCollections();
      return {
        success: true,
        document: {
          id: doc.id,
          data: doc.data(),
          path: doc.ref.path,
          subcollections: subcollections.map((col) => col.id),
        },
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Create document
  ipcMain.handle('firestore:createDocument', async (event, { collectionPath, documentId, data }) => {
    try {
      if (!dbRef) throw new Error('Not connected to Firebase');
      const docRef = documentId
        ? dbRef.collection(collectionPath).doc(documentId)
        : dbRef.collection(collectionPath).doc();
      await docRef.set(data);
      return { success: true, documentId: docRef.id };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Update document
  ipcMain.handle('firestore:updateDocument', async (event, { documentPath, data }) => {
    try {
      if (!dbRef) throw new Error('Not connected to Firebase');
      await dbRef.doc(documentPath).update(data);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Set document (overwrite)
  ipcMain.handle('firestore:setDocument', async (event, { documentPath, data }) => {
    try {
      if (!dbRef) throw new Error('Not connected to Firebase');
      await dbRef.doc(documentPath).set(data);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Delete document
  ipcMain.handle('firestore:deleteDocument', async (event, documentPath) => {
    try {
      if (!dbRef) throw new Error('Not connected to Firebase');
      await dbRef.doc(documentPath).delete();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Run query
  ipcMain.handle('firestore:query', async (event, { collectionPath, queries, orderBy, limit = 50 }) => {
    try {
      if (!dbRef) throw new Error('Not connected to Firebase');
      let query = dbRef.collection(collectionPath);

      if (queries?.length > 0) {
        for (const q of queries) {
          query = query.where(q.field, q.operator, q.value);
        }
      }
      if (orderBy) query = query.orderBy(orderBy.field, orderBy.direction || 'asc');
      query = query.limit(limit);

      const snapshot = await query.get();
      const documents = [];
      snapshot.forEach((doc) => {
        documents.push({ id: doc.id, data: doc.data(), path: doc.ref.path });
      });

      return { success: true, documents };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Export collection
  ipcMain.handle('firestore:exportCollection', async (event, collectionPath) => {
    try {
      if (!dbRef) throw new Error('Not connected to Firebase');

      const snapshot = await dbRef.collection(collectionPath).get();
      const documents = {};
      snapshot.forEach((doc) => {
        documents[doc.id] = doc.data();
      });

      const { filePath } = await dialog.showSaveDialog({
        defaultPath: `${collectionPath.replace(/\//g, '_')}_export.json`,
        filters: [{ name: 'JSON Files', extensions: ['json'] }],
      });

      if (filePath) {
        fs.writeFileSync(filePath, JSON.stringify(documents, null, 2));
        return { success: true, filePath };
      }
      return { success: false, error: 'Export cancelled' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Import documents
  ipcMain.handle('firestore:importDocuments', async (event, collectionPath) => {
    try {
      if (!dbRef) throw new Error('Not connected to Firebase');

      const { filePaths } = await dialog.showOpenDialog({
        filters: [{ name: 'JSON Files', extensions: ['json'] }],
        properties: ['openFile'],
      });

      if (filePaths?.length > 0) {
        const data = JSON.parse(fs.readFileSync(filePaths[0], 'utf8'));
        const batch = dbRef.batch();
        let count = 0;

        for (const [docId, docData] of Object.entries(data)) {
          const docRef = dbRef.collection(collectionPath).doc(docId);
          batch.set(docRef, docData);
          count++;
          if (count >= 500) {
            await batch.commit();
            count = 0;
          }
        }
        if (count > 0) await batch.commit();

        return { success: true, count: Object.keys(data).length };
      }
      return { success: false, error: 'Import cancelled' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Execute JS Query
  ipcMain.handle('firestore:executeJsQuery', async (event, { collectionPath, jsQuery }) => {
    try {
      void collectionPath;
      if (!dbRef) throw new Error('Not connected to Firebase');

      const wrappedCode = `(async () => { ${jsQuery} return await run(); })()`;
      const FieldValue = adminRef ? adminRef.firestore.FieldValue : null;
      const Filter = adminRef ? adminRef.firestore.Filter : null;
      const Timestamp = adminRef ? adminRef.firestore.Timestamp : null;
      const GeoPoint = adminRef ? adminRef.firestore.GeoPoint : null;
      const context = vm.createContext({
        db: dbRef,
        FieldValue,
        Filter,
        Timestamp,
        GeoPoint,
        console,
        Date,
        JSON,
        Math,
        Array,
        Object,
        String,
        Number,
        Boolean,
        Promise,
      });

      const script = new vm.Script(wrappedCode);
      const queryResult = await script.runInContext(context, { timeout: 30000 });

      const documents = [];
      if (queryResult?.forEach) {
        queryResult.forEach((doc) => {
          documents.push({ id: doc.id, data: doc.data(), path: doc.ref.path });
        });
      } else if (queryResult?.docs) {
        queryResult.docs.forEach((doc) => {
          documents.push({ id: doc.id, data: doc.data(), path: doc.ref.path });
        });
      } else if (queryResult?.exists !== undefined && queryResult.exists) {
        documents.push({ id: queryResult.id, data: queryResult.data(), path: queryResult.ref.path });
      }

      return { success: true, documents };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Delete collection
  ipcMain.handle('firestore:deleteCollection', async (event, collectionPath) => {
    try {
      if (!dbRef) throw new Error('Not connected to Firebase');
      const snapshot = await dbRef.collection(collectionPath).get();
      const batch = dbRef.batch();
      let count = 0;

      snapshot.forEach((doc) => {
        batch.delete(doc.ref);
        count++;
      });
      if (count > 0) await batch.commit();

      return { success: true, count };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Export all collections
  ipcMain.handle('firestore:exportCollections', async () => {
    try {
      if (!dbRef) throw new Error('Not connected to Firebase');

      // Get all collections
      const collections = await dbRef.listCollections();
      const allData = {};

      for (const col of collections) {
        const snapshot = await col.get();
        const documents = {};
        snapshot.forEach((doc) => {
          documents[doc.id] = doc.data();
        });
        allData[col.id] = documents;
      }

      const { filePath } = await dialog.showSaveDialog({
        defaultPath: `firestore_export_${Date.now()}.json`,
        filters: [{ name: 'JSON Files', extensions: ['json'] }],
      });

      if (filePath) {
        fs.writeFileSync(filePath, JSON.stringify(allData, null, 2));
        return { success: true, filePath, collectionsCount: collections.length };
      }
      return { success: false, error: 'Export cancelled' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
}

module.exports = { registerHandlers, setRefs, getDb };
