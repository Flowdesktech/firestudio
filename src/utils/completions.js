/**
 * Auto-completion definitions for Firestore queries
 * Used by JsQueryEditor and ConsolePanel
 */

// Common Firestore completions - each entry has trigger (what user types) and fullMatch (for filtering)
export const firestoreCompletions = [
    // Database reference
    { trigger: 'db', suggestion: '.collection(\'\')', cursorOffset: -2, description: 'Collection reference', fullMatch: 'db.collection' },
    { trigger: 'db.', suggestion: 'collection(\'\')', cursorOffset: -2, description: 'Collection reference', fullMatch: 'db.collection' },
    { trigger: 'db.c', suggestion: 'ollection(\'\')', cursorOffset: -2, description: 'Collection reference', fullMatch: 'db.collection' },
    { trigger: 'db.co', suggestion: 'llection(\'\')', cursorOffset: -2, description: 'Collection reference', fullMatch: 'db.collection' },
    { trigger: 'db.col', suggestion: 'lection(\'\')', cursorOffset: -2, description: 'Collection reference', fullMatch: 'db.collection' },
    { trigger: 'db.coll', suggestion: 'ection(\'\')', cursorOffset: -2, description: 'Collection reference', fullMatch: 'db.collection' },
    { trigger: 'db.colle', suggestion: 'ction(\'\')', cursorOffset: -2, description: 'Collection reference', fullMatch: 'db.collection' },
    { trigger: 'db.collec', suggestion: 'tion(\'\')', cursorOffset: -2, description: 'Collection reference', fullMatch: 'db.collection' },
    { trigger: 'db.collect', suggestion: 'ion(\'\')', cursorOffset: -2, description: 'Collection reference', fullMatch: 'db.collection' },
    { trigger: 'db.collecti', suggestion: 'on(\'\')', cursorOffset: -2, description: 'Collection reference', fullMatch: 'db.collection' },
    { trigger: 'db.collectio', suggestion: 'n(\'\')', cursorOffset: -2, description: 'Collection reference', fullMatch: 'db.collection' },
    { trigger: 'db.collection', suggestion: '(\'\')', cursorOffset: -2, description: 'Collection reference', fullMatch: 'db.collection' },

    // Collection methods (after any reference)
    { trigger: '.c', suggestion: 'ollection(\'\')', cursorOffset: -2, description: 'Collection', fullMatch: '.collection' },
    { trigger: '.co', suggestion: 'llection(\'\')', cursorOffset: -2, description: 'Collection', fullMatch: '.collection' },
    { trigger: '.col', suggestion: 'lection(\'\')', cursorOffset: -2, description: 'Collection', fullMatch: '.collection' },
    { trigger: '.coll', suggestion: 'ection(\'\')', cursorOffset: -2, description: 'Collection', fullMatch: '.collection' },
    { trigger: '.colle', suggestion: 'ction(\'\')', cursorOffset: -2, description: 'Collection', fullMatch: '.collection' },
    { trigger: '.collec', suggestion: 'tion(\'\')', cursorOffset: -2, description: 'Collection', fullMatch: '.collection' },
    { trigger: '.collect', suggestion: 'ion(\'\')', cursorOffset: -2, description: 'Collection', fullMatch: '.collection' },
    { trigger: '.collecti', suggestion: 'on(\'\')', cursorOffset: -2, description: 'Collection', fullMatch: '.collection' },
    { trigger: '.collectio', suggestion: 'n(\'\')', cursorOffset: -2, description: 'Collection', fullMatch: '.collection' },
    { trigger: '.collection', suggestion: '(\'\')', cursorOffset: -2, description: 'Collection', fullMatch: '.collection' },

    // Collection Group
    { trigger: '.collectionG', suggestion: 'roup(\'\')', cursorOffset: -2, description: 'Collection group query', fullMatch: '.collectionGroup' },
    { trigger: '.collectionGr', suggestion: 'oup(\'\')', cursorOffset: -2, description: 'Collection group query', fullMatch: '.collectionGroup' },
    { trigger: '.collectionGro', suggestion: 'up(\'\')', cursorOffset: -2, description: 'Collection group query', fullMatch: '.collectionGroup' },
    { trigger: '.collectionGrou', suggestion: 'p(\'\')', cursorOffset: -2, description: 'Collection group query', fullMatch: '.collectionGroup' },
    { trigger: '.collectionGroup', suggestion: '(\'\')', cursorOffset: -2, description: 'Collection group query', fullMatch: '.collectionGroup' },

    // Document reference
    { trigger: '.d', suggestion: 'oc(\'\')', cursorOffset: -2, description: 'Document reference', fullMatch: '.doc' },
    { trigger: '.do', suggestion: 'c(\'\')', cursorOffset: -2, description: 'Document reference', fullMatch: '.doc' },
    { trigger: '.doc', suggestion: '(\'\')', cursorOffset: -2, description: 'Document reference', fullMatch: '.doc' },

    // Query filters - where
    { trigger: '.w', suggestion: 'here(\'\', \'==\', \'\')', cursorOffset: -12, description: 'Where clause', fullMatch: '.where' },
    { trigger: '.wh', suggestion: 'ere(\'\', \'==\', \'\')', cursorOffset: -12, description: 'Where clause', fullMatch: '.where' },
    { trigger: '.whe', suggestion: 're(\'\', \'==\', \'\')', cursorOffset: -12, description: 'Where clause', fullMatch: '.where' },
    { trigger: '.wher', suggestion: 'e(\'\', \'==\', \'\')', cursorOffset: -12, description: 'Where clause', fullMatch: '.where' },
    { trigger: '.where', suggestion: '(\'\', \'==\', \'\')', cursorOffset: -11, description: 'Where clause', fullMatch: '.where' },

    // Ordering
    { trigger: '.o', suggestion: 'rderBy(\'\', \'asc\')', cursorOffset: -8, description: 'Order by', fullMatch: '.orderBy' },
    { trigger: '.or', suggestion: 'derBy(\'\', \'asc\')', cursorOffset: -8, description: 'Order by', fullMatch: '.orderBy' },
    { trigger: '.ord', suggestion: 'erBy(\'\', \'asc\')', cursorOffset: -8, description: 'Order by', fullMatch: '.orderBy' },
    { trigger: '.orde', suggestion: 'rBy(\'\', \'asc\')', cursorOffset: -8, description: 'Order by', fullMatch: '.orderBy' },
    { trigger: '.order', suggestion: 'By(\'\', \'asc\')', cursorOffset: -8, description: 'Order by', fullMatch: '.orderBy' },
    { trigger: '.orderB', suggestion: 'y(\'\', \'asc\')', cursorOffset: -8, description: 'Order by', fullMatch: '.orderBy' },
    { trigger: '.orderBy', suggestion: '(\'\', \'asc\')', cursorOffset: -7, description: 'Order by', fullMatch: '.orderBy' },

    // Limiting
    { trigger: '.l', suggestion: 'imit(50)', cursorOffset: -1, description: 'Limit results', fullMatch: '.limit' },
    { trigger: '.li', suggestion: 'mit(50)', cursorOffset: -1, description: 'Limit results', fullMatch: '.limit' },
    { trigger: '.lim', suggestion: 'it(50)', cursorOffset: -1, description: 'Limit results', fullMatch: '.limit' },
    { trigger: '.limi', suggestion: 't(50)', cursorOffset: -1, description: 'Limit results', fullMatch: '.limit' },
    { trigger: '.limit', suggestion: '(50)', cursorOffset: -1, description: 'Limit results', fullMatch: '.limit' },
    { trigger: '.limitToLast', suggestion: '(10)', cursorOffset: -1, description: 'Limit to last', fullMatch: '.limitToLast' },
    { trigger: '.offset', suggestion: '(0)', cursorOffset: -1, description: 'Offset (pagination)', fullMatch: '.offset' },

    // Pagination
    { trigger: '.startAt', suggestion: '()', cursorOffset: -1, description: 'Start at cursor', fullMatch: '.startAt' },
    { trigger: '.startAfter', suggestion: '()', cursorOffset: -1, description: 'Start after cursor', fullMatch: '.startAfter' },
    { trigger: '.endAt', suggestion: '()', cursorOffset: -1, description: 'End at cursor', fullMatch: '.endAt' },
    { trigger: '.endBefore', suggestion: '()', cursorOffset: -1, description: 'End before cursor', fullMatch: '.endBefore' },

    // Read operations
    { trigger: '.g', suggestion: 'et()', cursorOffset: 0, description: 'Get documents', fullMatch: '.get' },
    { trigger: '.ge', suggestion: 't()', cursorOffset: 0, description: 'Get documents', fullMatch: '.get' },
    { trigger: '.get', suggestion: '()', cursorOffset: 0, description: 'Get documents', fullMatch: '.get' },
    { trigger: '.stream', suggestion: '()', cursorOffset: 0, description: 'Stream documents', fullMatch: '.stream' },
    { trigger: '.onSnapshot', suggestion: '((snapshot) => {\n  \n})', cursorOffset: -3, description: 'Real-time listener', fullMatch: '.onSnapshot' },

    // Write operations
    { trigger: '.a', suggestion: 'dd({})', cursorOffset: -2, description: 'Add document', fullMatch: '.add' },
    { trigger: '.ad', suggestion: 'd({})', cursorOffset: -2, description: 'Add document', fullMatch: '.add' },
    { trigger: '.add', suggestion: '({})', cursorOffset: -2, description: 'Add document', fullMatch: '.add' },
    { trigger: '.s', suggestion: 'et({})', cursorOffset: -2, description: 'Set document', fullMatch: '.set' },
    { trigger: '.se', suggestion: 't({})', cursorOffset: -2, description: 'Set document', fullMatch: '.set' },
    { trigger: '.set', suggestion: '({})', cursorOffset: -2, description: 'Set document', fullMatch: '.set' },
    { trigger: '.u', suggestion: 'pdate({})', cursorOffset: -2, description: 'Update document', fullMatch: '.update' },
    { trigger: '.up', suggestion: 'date({})', cursorOffset: -2, description: 'Update document', fullMatch: '.update' },
    { trigger: '.upd', suggestion: 'ate({})', cursorOffset: -2, description: 'Update document', fullMatch: '.update' },
    { trigger: '.upda', suggestion: 'te({})', cursorOffset: -2, description: 'Update document', fullMatch: '.update' },
    { trigger: '.updat', suggestion: 'e({})', cursorOffset: -2, description: 'Update document', fullMatch: '.update' },
    { trigger: '.update', suggestion: '({})', cursorOffset: -2, description: 'Update document', fullMatch: '.update' },
    { trigger: '.delete', suggestion: '()', cursorOffset: -1, description: 'Delete document', fullMatch: '.delete' },

    // Batch and transaction
    { trigger: 'batch', suggestion: ' = db.batch()', cursorOffset: 0, description: 'Batch write', fullMatch: 'batch' },
    { trigger: '.batch', suggestion: '()', cursorOffset: 0, description: 'Create batch', fullMatch: '.batch' },
    { trigger: 'transaction', suggestion: ' = await db.runTransaction(async (t) => {\n  \n})', cursorOffset: -3, description: 'Transaction', fullMatch: 'transaction' },
    { trigger: '.runTransaction', suggestion: '(async (transaction) => {\n  \n})', cursorOffset: -3, description: 'Run transaction', fullMatch: '.runTransaction' },

    // Field values
    { trigger: 'FieldValue.', suggestion: 'serverTimestamp()', cursorOffset: 0, description: 'Server timestamp', fullMatch: 'FieldValue.serverTimestamp' },
    { trigger: 'FieldValue.serverTimestamp', suggestion: '()', cursorOffset: 0, description: 'Server timestamp', fullMatch: 'FieldValue.serverTimestamp' },
    { trigger: 'FieldValue.increment', suggestion: '(1)', cursorOffset: -1, description: 'Increment field', fullMatch: 'FieldValue.increment' },
    { trigger: 'FieldValue.arrayUnion', suggestion: '([])', cursorOffset: -2, description: 'Array union', fullMatch: 'FieldValue.arrayUnion' },
    { trigger: 'FieldValue.arrayRemove', suggestion: '([])', cursorOffset: -2, description: 'Array remove', fullMatch: 'FieldValue.arrayRemove' },
    { trigger: 'FieldValue.delete', suggestion: '()', cursorOffset: 0, description: 'Delete field', fullMatch: 'FieldValue.delete' },

    // Snapshot operations
    { trigger: '.data', suggestion: '()', cursorOffset: 0, description: 'Get document data', fullMatch: '.data' },
    { trigger: '.exists', suggestion: '', cursorOffset: 0, description: 'Check if document exists', fullMatch: '.exists' },
    { trigger: '.id', suggestion: '', cursorOffset: 0, description: 'Get document ID', fullMatch: '.id' },
    { trigger: '.ref', suggestion: '', cursorOffset: 0, description: 'Get document reference', fullMatch: '.ref' },
    { trigger: '.docs', suggestion: '', cursorOffset: 0, description: 'Get documents array', fullMatch: '.docs' },
    { trigger: '.empty', suggestion: '', cursorOffset: 0, description: 'Check if snapshot is empty', fullMatch: '.empty' },
    { trigger: '.size', suggestion: '', cursorOffset: 0, description: 'Get snapshot size', fullMatch: '.size' },
    { trigger: '.forEach', suggestion: '(doc => {\n  \n})', cursorOffset: -3, description: 'Iterate documents', fullMatch: '.forEach' },
    { trigger: '.map', suggestion: '(doc => doc.data())', cursorOffset: -1, description: 'Map documents', fullMatch: '.map' },
];

// JavaScript boilerplate completions
export const jsBoilerplateCompletions = [
    // Async function
    { trigger: 'async', suggestion: ' function run() {\n  \n}', cursorOffset: -2, description: 'Async run function' },
    { trigger: 'asyncfn', suggestion: ' async () => {\n  \n}', cursorOffset: -2, description: 'Async arrow function' },

    // Await patterns
    { trigger: 'await', suggestion: ' db.collection(\'\').get()', cursorOffset: -8, description: 'Await collection get' },
    { trigger: 'awaitDoc', suggestion: ' db.doc(\'\').get()', cursorOffset: -8, description: 'Await doc get' },

    // Common patterns
    { trigger: 'const', suggestion: ' snapshot = await ', cursorOffset: 0, description: 'Const snapshot' },
    { trigger: 'snap', suggestion: 'shot.docs.map(doc => ({ id: doc.id, ...doc.data() }))', cursorOffset: 0, description: 'Map snapshot docs' },
    { trigger: 'foreach', suggestion: 'snapshot.forEach(doc => {\n  console.log(doc.id, doc.data());\n})', cursorOffset: 0, description: 'ForEach docs' },

    // Return patterns
    { trigger: 'return snap', suggestion: 'shot.docs.map(doc => ({ id: doc.id, ...doc.data() }))', cursorOffset: 0, description: 'Return mapped docs' },
    { trigger: 'return doc', suggestion: 's', cursorOffset: 0, description: 'Return docs' },

    // Error handling
    { trigger: 'trycatch', suggestion: 'try {\n  \n} catch (error) {\n  console.error(error);\n}', cursorOffset: -40, description: 'Try-catch block' },

    // Console
    { trigger: 'log', suggestion: 'console.log()', cursorOffset: -1, description: 'Console log' },
    { trigger: 'console.', suggestion: 'log()', cursorOffset: -1, description: 'Console log' },

    // JSON
    { trigger: 'JSON.str', suggestion: 'ingify(, null, 2)', cursorOffset: -10, description: 'JSON stringify' },
    { trigger: 'JSON.par', suggestion: 'se()', cursorOffset: -1, description: 'JSON parse' },
];

// Console-specific completions (simpler)
export const consoleCompletions = [
    { trigger: 'db', suggestion: '.collection(\'\')', cursorOffset: -2 },
    { trigger: 'db.', suggestion: 'collection(\'\')', cursorOffset: -2 },
    { trigger: '.col', suggestion: 'lection(\'\')', cursorOffset: -2 },
    { trigger: '.doc', suggestion: '(\'\')', cursorOffset: -2 },
    { trigger: '.whe', suggestion: 're(\'\', \'==\', \'\')', cursorOffset: -12 },
    { trigger: '.ord', suggestion: 'erBy(\'\', \'asc\')', cursorOffset: -8 },
    { trigger: '.lim', suggestion: 'it(10)', cursorOffset: -1 },
    { trigger: '.get', suggestion: '()', cursorOffset: 0 },
    { trigger: 'help', suggestion: '', cursorOffset: 0 },
    { trigger: 'clear', suggestion: '', cursorOffset: 0 },
];

// All JS editor completions combined
export const jsEditorCompletions = [
    ...firestoreCompletions,
    ...jsBoilerplateCompletions,
];

/**
 * Find matching completion for given text
 * @param {string} text - Text before cursor
 * @param {Array} completions - Array of completion objects
 * @returns {Object|null} - Matching completion or null
 */
export function findCompletion(text, completions = jsEditorCompletions) {
    if (!text) return null;

    // Get the last part of text (last line, trimmed)
    const lines = text.split('\n');
    const lastLine = lines[lines.length - 1];

    // Sort by trigger length (longest first) to match most specific
    const sorted = [...completions].sort((a, b) => b.trigger.length - a.trigger.length);

    for (const completion of sorted) {
        // Check if the text ends with the trigger
        if (text.endsWith(completion.trigger) || lastLine.endsWith(completion.trigger)) {
            // Make sure it's at a word boundary for non-dot triggers
            if (!completion.trigger.startsWith('.')) {
                const charBeforeTrigger = text.charAt(text.length - completion.trigger.length - 1);
                // If there's a character before and it's alphanumeric, skip this match
                if (charBeforeTrigger && /[a-zA-Z0-9_]/.test(charBeforeTrigger)) {
                    continue;
                }
            }
            return completion;
        }
    }
    return null;
}

/**
 * Get completions that start with given prefix
 * @param {string} prefix - Prefix to match
 * @param {Array} completions - Array of completion objects
 * @returns {Array} - Matching completions
 */
export function getMatchingCompletions(prefix, completions = jsEditorCompletions) {
    if (!prefix) return [];
    const lowerPrefix = prefix.toLowerCase();
    return completions.filter(c =>
        c.trigger.toLowerCase().startsWith(lowerPrefix) ||
        (c.description && c.description.toLowerCase().includes(lowerPrefix))
    );
}
