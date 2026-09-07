/** Keeps long cell content inside a resizable column while preserving the full value in a native tooltip. */
export const singleLineTruncation = {
  display: 'block',
  minWidth: 0,
  maxWidth: '100%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
} as const;
