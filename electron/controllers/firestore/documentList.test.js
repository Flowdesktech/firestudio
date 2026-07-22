// @vitest-environment node
import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'module';

const require_ = createRequire(import.meta.url);
const { fetchDocumentsPage } = require_('./documentList');

function snapshotDoc(id, data = { field: 1 }) {
  return { id, data: () => data, ref: { path: `col/${id}` } };
}

function mockDb({ docs, listedIds = [], listDocumentsError, count = docs.length, countError, cursorExists = true }) {
  const snapshot = { docs, size: docs.length };
  const listDocuments = listDocumentsError
    ? vi.fn().mockRejectedValue(listDocumentsError)
    : vi.fn().mockResolvedValue(listedIds.map((id) => ({ id, path: `col/${id}` })));
  const countGet = countError
    ? vi.fn().mockRejectedValue(countError)
    : vi.fn().mockResolvedValue({ data: () => ({ count }) });
  const query = { get: vi.fn().mockResolvedValue(snapshot), startAfter: vi.fn() };
  query.startAfter.mockReturnValue(query);
  const collection = {
    limit: vi.fn().mockReturnValue(query),
    doc: vi.fn().mockReturnValue({ get: vi.fn().mockResolvedValue({ exists: cursorExists }) }),
    listDocuments,
    count: vi.fn().mockReturnValue({ get: countGet }),
  };
  return { db: { collection: vi.fn().mockReturnValue(collection) }, query, collection };
}

describe('fetchDocumentsPage', () => {
  it('merges phantom documents into the page sorted by id', async () => {
    const { db } = mockDb({ docs: [snapshotDoc('a'), snapshotDoc('c')], listedIds: ['a', 'b', 'c'] });

    const documents = await fetchDocumentsPage(db, { collectionPath: 'col', limit: 50, startAfter: null });

    expect(documents.map((d) => d.id)).toEqual(['a', 'b', 'c']);
    expect(documents[1]).toEqual({ id: 'b', data: {}, path: 'col/b', missing: true });
    expect(documents[0].missing).toBeUndefined();
  });

  it('returns query results when listDocuments fails', async () => {
    const { db } = mockDb({ docs: [snapshotDoc('a')], listDocumentsError: new Error('unavailable') });

    const documents = await fetchDocumentsPage(db, { collectionPath: 'col', limit: 50, startAfter: null });

    expect(documents.map((d) => d.id)).toEqual(['a']);
  });

  it('shows all phantoms in an empty collection', async () => {
    const { db } = mockDb({ docs: [], listedIds: ['x', 'y'] });

    const documents = await fetchDocumentsPage(db, { collectionPath: 'col', limit: 50, startAfter: null });

    expect(documents.map((d) => d.id)).toEqual(['x', 'y']);
    expect(documents.every((d) => d.missing)).toBe(true);
  });

  it('caps the merged page at the requested limit', async () => {
    const { db } = mockDb({ docs: [snapshotDoc('a')], listedIds: ['b', 'c', 'd'] });

    const documents = await fetchDocumentsPage(db, { collectionPath: 'col', limit: 2, startAfter: null });

    expect(documents.map((d) => d.id)).toEqual(['a', 'b']);
  });

  it('excludes phantoms at or before the startAfter cursor', async () => {
    const { db } = mockDb({ docs: [snapshotDoc('d')], listedIds: ['a', 'c', 'e'] });

    const documents = await fetchDocumentsPage(db, { collectionPath: 'col', limit: 50, startAfter: 'b' });

    expect(documents.map((d) => d.id)).toEqual(['c', 'd', 'e']);
  });

  it('skips the phantom scan when the page is full', async () => {
    const docs = [snapshotDoc('a'), snapshotDoc('b')];
    const { db, collection } = mockDb({ docs, listedIds: ['a', 'b', 'c'] });

    const documents = await fetchDocumentsPage(db, { collectionPath: 'col', limit: 2, startAfter: null });

    expect(documents.map((d) => d.id)).toEqual(['a', 'b']);
    expect(collection.listDocuments).not.toHaveBeenCalled();
    expect(collection.count).not.toHaveBeenCalled();
  });

  it('skips the phantom scan for large collections', async () => {
    const { db, collection } = mockDb({ docs: [snapshotDoc('a')], listedIds: ['a', 'b'], count: 9875 });

    const documents = await fetchDocumentsPage(db, { collectionPath: 'col', limit: 50, startAfter: null });

    expect(documents.map((d) => d.id)).toEqual(['a']);
    expect(collection.listDocuments).not.toHaveBeenCalled();
  });

  it('scans phantoms when the count aggregate is unavailable', async () => {
    const { db } = mockDb({ docs: [snapshotDoc('a')], listedIds: ['a', 'b'], countError: new Error('unsupported') });

    const documents = await fetchDocumentsPage(db, { collectionPath: 'col', limit: 50, startAfter: null });

    expect(documents.map((d) => d.id)).toEqual(['a', 'b']);
  });

  it('applies the startAfter cursor to the query', async () => {
    const { db, query, collection } = mockDb({ docs: [snapshotDoc('b')], listedIds: ['b'] });

    await fetchDocumentsPage(db, { collectionPath: 'col', limit: 50, startAfter: 'a' });

    expect(collection.doc).toHaveBeenCalledWith('a');
    expect(query.startAfter).toHaveBeenCalled();
  });
});
