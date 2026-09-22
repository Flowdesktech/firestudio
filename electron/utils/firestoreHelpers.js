/**
 * Firestore Helper Functions
 * Utility functions for converting between JS values and Firestore REST API formats
 */

/**
 * Converts a JS value to Firestore REST API format
 * @param {*} value - JavaScript value to convert
 * @returns {Object} - Firestore REST API value object
 */
function convertToFirestoreValue(value) {
  if (value === null) return { nullValue: null };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') {
    return Number.isInteger(value) ? { integerValue: value.toString() } : { doubleValue: value };
  }
  if (typeof value === 'string') return { stringValue: value };
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(convertToFirestoreValue) } };
  }
  if (typeof value === 'object') {
    // Check for special Firestore types
    if (value._seconds !== undefined) {
      const date = new Date(value._seconds * 1000);
      return { timestampValue: date.toISOString() };
    }
    if (value._latitude !== undefined && value._longitude !== undefined) {
      return {
        geoPointValue: {
          latitude: value._latitude,
          longitude: value._longitude,
        },
      };
    }
    // Regular map/object
    const fields = {};
    for (const [k, v] of Object.entries(value)) {
      fields[k] = convertToFirestoreValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(value) };
}

/**
 * Converts app-shaped data into firebase-admin compatible values.
 * The UI works with `{ _seconds, _nanoseconds }` timestamps and
 * `{ _latitude, _longitude }` geopoints; the Admin SDK needs real
 * Timestamp/GeoPoint instances, otherwise it persists them as plain maps.
 * Constructors are injected so this module stays free of firebase-admin.
 * @param {*} value - App-shaped value to convert
 * @param {Object} opts - { Timestamp, GeoPoint, FieldValue } constructors
 * @returns {*} - Value safe to hand to the firebase-admin SDK
 */
function toFirestoreAdminValue(value, { Timestamp, GeoPoint, FieldValue } = {}) {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) {
    const time = value.getTime();
    return new Timestamp(Math.floor(time / 1000), (time % 1000) * 1000000);
  }
  if (typeof value !== 'object') return value;

  // Sentinels (serverTimestamp, delete, increment, ...) must pass through.
  if (typeof FieldValue === 'function' && value instanceof FieldValue) return value;

  if (Array.isArray(value)) {
    return value.map((item) => toFirestoreAdminValue(item, { Timestamp, GeoPoint, FieldValue }));
  }

  // Timestamp shapes: { _seconds, _nanoseconds } or { seconds, nanoseconds }.
  const nanos = value._nanoseconds ?? value.nanoseconds ?? value.nanos;
  const underscoredSeconds = typeof value._seconds === 'number' ? value._seconds : undefined;
  const plainSeconds = typeof value.seconds === 'number' ? value.seconds : undefined;
  if (underscoredSeconds !== undefined || (plainSeconds !== undefined && nanos !== undefined)) {
    const seconds = underscoredSeconds !== undefined ? underscoredSeconds : plainSeconds;
    return new Timestamp(seconds, nanos || 0);
  }

  // GeoPoint shapes: { _latitude, _longitude } or { latitude, longitude }.
  const underscoredLatLng = value._latitude !== undefined && value._longitude !== undefined;
  const plainLatLng = value.latitude !== undefined && value.longitude !== undefined;
  if (underscoredLatLng || plainLatLng) {
    const latitude = underscoredLatLng ? value._latitude : value.latitude;
    const longitude = underscoredLatLng ? value._longitude : value.longitude;
    return new GeoPoint(latitude, longitude);
  }

  // Plain map: rebuild recursively, never mutate the input.
  const result = {};
  for (const [key, item] of Object.entries(value)) {
    result[key] = toFirestoreAdminValue(item, { Timestamp, GeoPoint, FieldValue });
  }
  return result;
}

/**
 * Parses a Firestore REST API value to JS value
 * @param {Object} value - Firestore REST API value object
 * @returns {*} - JavaScript value
 */
function parseFirestoreValue(value) {
  if (value.stringValue !== undefined) return value.stringValue;
  if (value.integerValue !== undefined) return parseInt(value.integerValue, 10);
  if (value.doubleValue !== undefined) return value.doubleValue;
  if (value.booleanValue !== undefined) return value.booleanValue;
  if (value.nullValue !== undefined) return null;
  if (value.timestampValue !== undefined) {
    // REST JSON serializes timestamps as RFC3339 strings, while the admin SDK
    // gRPC proto exposes them as { seconds, nanos } objects.
    const ts = value.timestampValue;
    const seconds = typeof ts === 'string' ? Math.floor(new Date(ts).getTime() / 1000) : Number(ts.seconds);
    const nanos = typeof ts === 'string' ? 0 : ts.nanos || 0;
    return { _seconds: seconds, _nanoseconds: nanos };
  }
  if (value.geoPointValue !== undefined) {
    return {
      _latitude: value.geoPointValue.latitude,
      _longitude: value.geoPointValue.longitude,
    };
  }
  if (value.arrayValue !== undefined) {
    return (value.arrayValue.values || []).map(parseFirestoreValue);
  }
  if (value.mapValue !== undefined) {
    return parseFirestoreDocument(value.mapValue.fields || {});
  }
  if (value.referenceValue !== undefined) {
    return value.referenceValue;
  }
  return value;
}

/**
 * Parses Firestore REST API document fields to JS object
 * @param {Object} fields - Firestore fields object
 * @returns {Object} - JavaScript object
 */
function parseFirestoreDocument(fields) {
  const result = {};
  for (const [key, value] of Object.entries(fields)) {
    result[key] = parseFirestoreValue(value);
  }
  return result;
}

/**
 * Converts JS data object to Firestore fields format
 * @param {Object} data - JavaScript data object
 * @returns {Object} - Firestore fields object
 */
function dataToFirestoreFields(data) {
  const fields = {};
  for (const [key, value] of Object.entries(data)) {
    fields[key] = convertToFirestoreValue(value);
  }
  return fields;
}

/**
 * Decodes a Firestore document into plain cloneable data.
 * Unlike doc.data(), references become plain strings instead of
 * DocumentReference instances, which cannot cross the IPC boundary.
 * @param {Object} doc - Firestore DocumentSnapshot
 * @returns {Object} - Plain data object
 */
function firestoreDocumentToData(doc) {
  return parseFirestoreDocument(doc._fieldsProto || {});
}

module.exports = {
  convertToFirestoreValue,
  toFirestoreAdminValue,
  parseFirestoreValue,
  parseFirestoreDocument,
  dataToFirestoreFields,
  firestoreDocumentToData,
};
