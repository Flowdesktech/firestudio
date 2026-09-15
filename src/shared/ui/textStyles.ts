/** Keeps long cell content inside a resizable column while preserving the full value in a native tooltip. */
export const singleLineTruncation = {
  display: 'block',
  minWidth: 0,
  maxWidth: '100%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
} as const;

/** Preserves line breaks and wraps even long URLs within the column width. */
export const wrappedCellText = {
  display: 'block',
  minWidth: 0,
  maxWidth: '100%',
  whiteSpace: 'pre-wrap',
  overflowWrap: 'anywhere',
} as const;
