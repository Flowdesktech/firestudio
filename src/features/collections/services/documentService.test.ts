import { describe, expect, it } from 'vitest';
import { documentService } from './documentService';

describe('prepareDeleteData', () => {
  it('removes a top-level key', () => {
    const doc = { id: 'doc-1', data: { a: 1, b: 'keep' } };
    expect(documentService.prepareDeleteData(doc, 'a')).toEqual({ b: 'keep' });
  });

  it('removes a whole map field', () => {
    const doc = { id: 'doc-1', data: { profile: { displayName: 'Ada', age: 36 }, a: 1 } };
    expect(documentService.prepareDeleteData(doc, 'profile')).toEqual({ a: 1 });
  });

  it('removes a nested key and keeps sibling keys intact', () => {
    const doc = { id: 'doc-1', data: { profile: { displayName: 'Ada', age: 36 }, tags: ['a'] } };
    expect(documentService.prepareDeleteData(doc, 'profile.displayName')).toEqual({
      profile: { age: 36 },
      tags: ['a'],
    });
  });

  it('removes a deeply nested key and keeps sibling keys intact', () => {
    const doc = { id: 'doc-1', data: { a: { b: { c: 1, d: 2 } } } };
    expect(documentService.prepareDeleteData(doc, 'a.b.c')).toEqual({ a: { b: { d: 2 } } });
  });

  it('is a no-op when a nested key lives under a missing parent', () => {
    const doc = { id: 'doc-1', data: { a: 1 } };
    expect(documentService.prepareDeleteData(doc, 'profile.displayName')).toEqual({ a: 1 });
  });

  it('is a no-op when an intermediate path is not a map', () => {
    const withArray = { id: 'doc-1', data: { tags: ['x', 'y'] } };
    expect(documentService.prepareDeleteData(withArray, 'tags.0')).toEqual({ tags: ['x', 'y'] });

    const withPrimitive = { id: 'doc-1', data: { count: 1 } };
    expect(documentService.prepareDeleteData(withPrimitive, 'count.total')).toEqual({ count: 1 });
  });

  it('returns a new object and does not mutate the input data', () => {
    const data = { profile: { displayName: 'Ada', age: 36 }, tags: ['a', 'b'] };
    const snapshot = JSON.stringify(data);

    const result = documentService.prepareDeleteData({ id: 'doc-1', data }, 'profile.displayName');
    expect(result).not.toBe(data);
    expect(result.profile).not.toBe(data.profile);
    expect(JSON.stringify(data)).toBe(snapshot);

    documentService.prepareDeleteData({ id: 'doc-1', data }, 'profile');
    documentService.prepareDeleteData({ id: 'doc-1', data }, 'tags.0');
    expect(JSON.stringify(data)).toBe(snapshot);
  });
});
