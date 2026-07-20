const PHANTOM_SCAN_MAX_DOCS = 1000;

function toDocumentEntry(doc) {
  return { id: doc.id, data: doc.data(), path: doc.ref.path };
}

function toPhantomEntry(ref) {
  return { id: ref.id, data: {}, path: ref.path, missing: true };
}

function byId(a, b) {
  if (a.id === b.id) return 0;
  return a.id < b.id ? -1 : 1;
}

async function shouldScanPhantoms(collection, pageFull) {
  if (pageFull) return false;
  try {
    const aggregate = await collection.count().get();
    return aggregate.data().count <= PHANTOM_SCAN_MAX_DOCS;
  } catch {
    return true;
  }
}

async function listPhantoms(collection, documents, startAfter) {
  try {
    const refs = await collection.listDocuments();
    const presentIds = new Set(documents.map((doc) => doc.id));
    return refs.filter((ref) => !presentIds.has(ref.id) && (!startAfter || ref.id > startAfter)).map(toPhantomEntry);
  } catch {
    return [];
  }
}

async function fetchDocumentsPage(dbRef, { collectionPath, limit, startAfter }) {
  const collection = dbRef.collection(collectionPath);
  let query = collection.limit(limit);
  if (startAfter) {
    const cursor = await collection.doc(startAfter).get();
    if (cursor.exists) query = query.startAfter(cursor);
  }

  const snapshot = await query.get();
  const documents = snapshot.docs.map(toDocumentEntry);
  if (!(await shouldScanPhantoms(collection, snapshot.size >= limit))) return documents;

  const phantoms = await listPhantoms(collection, documents, startAfter);
  if (!phantoms.length) return documents;
  return [...documents, ...phantoms].sort(byId).slice(0, limit);
}

module.exports = { fetchDocumentsPage };
