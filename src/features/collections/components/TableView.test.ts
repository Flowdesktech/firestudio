import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from '@mui/material';
import { createAppTheme } from '../../../app/theme';
import { formatDisplayValue, getTypeColor, getValueType } from '../../../shared/utils/firestoreUtils';
import TableView from './TableView';

it('wraps complete values without saving data and remembers the preference', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const container = document.createElement('div');
  document.body.appendChild(container);
  const longValue = 'First line\n' + 'https://example.com/' + 'long-text'.repeat(80);
  const onCellSave = vi.fn();
  const props = {
    documents: [{ id: 'document-id', data: { text: longValue, nested: { text: longValue } } }],
    visibleFields: ['text', 'nested'],
    editingCell: null,
    editValue: '',
    setEditValue: vi.fn(),
    onCellEdit: vi.fn(),
    onCellSave,
    onCellKeyDown: vi.fn(),
    columnWidths: {},
    setColumnWidths: vi.fn(),
    getType: getValueType,
    getTypeColor,
    formatValue: formatDisplayValue,
    selectedRows: [],
    setSelectedRows: vi.fn(),
  };
  const renderTable = () =>
    React.createElement(
      ThemeProvider,
      { theme: createAppTheme('light', 'medium') },
      React.createElement(TableView, props),
    );
  let root = createRoot(container);
  try {
    await act(async () => root.render(renderTable()));
    const cell = () => Array.from(container.querySelectorAll('div')).find((el) => el.title === longValue)!;
    expect(cell().textContent).toBe(longValue);
    expect(cell().style.whiteSpace).toBe('nowrap');
    const toggle = () => container.querySelector<HTMLInputElement>('.MuiSwitch-input')!;
    await act(async () => toggle().click());
    expect(cell().style.whiteSpace).toBe('pre-wrap');
    expect(cell().style.overflowWrap).toBe('anywhere');
    expect(container.textContent).toContain(JSON.stringify({ text: longValue }));
    expect(localStorage.getItem('firestudio.table.wrapText')).toBe('true');
    await act(async () => root.unmount());
    root = createRoot(container);
    await act(async () => root.render(renderTable()));
    expect(toggle().checked).toBe(true);
    expect(cell().style.whiteSpace).toBe('pre-wrap');
    await act(async () => toggle().click());
    expect(cell().style.whiteSpace).toBe('nowrap');
    expect(onCellSave).not.toHaveBeenCalled();
  } finally {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  }
}, 15000);
