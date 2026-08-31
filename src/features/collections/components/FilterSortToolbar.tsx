import React, { useEffect, useMemo, useRef } from 'react';
import {
  Autocomplete,
  Box,
  Button,
  IconButton,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import { FilterList as FilterIcon, Sort as SortIcon } from '@mui/icons-material';
import { Filter, SortConfig } from '../store/collectionSlice';

interface FilterSortToolbarProps {
  filters: Filter[];
  setFilters: (filters: Filter[]) => void;
  sortConfig: SortConfig;
  setSortConfig: (config: SortConfig) => void;
  allFields: string[];
  onApply?: () => void;
}

const FilterSortToolbar: React.FC<FilterSortToolbarProps> = ({
  filters,
  setFilters,
  sortConfig,
  setSortConfig,
  allFields,
  onApply,
}) => {
  const [filterMenuOpen, setFilterMenuOpen] = React.useState(false);
  const [sortMenuOpen, setSortMenuOpen] = React.useState(false);
  const fieldOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...allFields,
          ...filters.map((filter) => filter.field).filter(Boolean),
          ...(sortConfig.field ? [sortConfig.field] : []),
        ]),
      ).sort(),
    [allFields, filters, sortConfig.field],
  );

  const filterMenuRef = useRef<HTMLDivElement>(null);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  // Close popups when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Element;
      // MUI Select/Autocomplete menus can render in a portal outside these refs.
      if (target.closest('.MuiPopover-root, .MuiAutocomplete-popper')) return;

      if (filterMenuRef.current && !filterMenuRef.current.contains(e.target as Node)) {
        setFilterMenuOpen(false);
      }
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) {
        setSortMenuOpen(false);
      }
    };

    if (filterMenuOpen || sortMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [filterMenuOpen, sortMenuOpen]);

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', p: 0.5, borderBottom: 1, borderColor: 'divider', gap: 1 }}>
      {/* Filter Button */}
      <Box sx={{ position: 'relative' }} ref={filterMenuRef}>
        <Button
          size="small"
          onClick={() => setFilterMenuOpen(!filterMenuOpen)}
          startIcon={<FilterIcon sx={{ fontSize: 16 }} />}
          sx={{
            textTransform: 'none',
            fontSize: '0.75rem',
            bgcolor: filters.length > 0 ? 'action.selected' : 'transparent',
          }}
        >
          Filter {filters.length > 0 && `(${filters.length})`}
        </Button>
        {filterMenuOpen && (
          <Box
            sx={{
              position: 'absolute',
              top: '100%',
              left: 0,
              mt: 0.5,
              bgcolor: 'background.paper',
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
              boxShadow: 3,
              zIndex: 1000,
              minWidth: 560,
              maxWidth: 'calc(100vw - 32px)',
              p: 1.5,
            }}
          >
            <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, mb: 1, color: 'text.primary' }}>
              Add Filter
            </Typography>
            {filters.map((filter, idx) => (
              <Box key={idx} sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
                <Autocomplete
                  freeSolo
                  disablePortal
                  options={fieldOptions}
                  value={filter.field}
                  onInputChange={(_event, value) => {
                    setFilters(filters.map((f, i) => (i === idx ? { ...f, field: value } : f)));
                  }}
                  renderInput={(params) => <TextField {...params} size="small" placeholder="Field" />}
                  sx={{
                    flex: 1.4,
                    minWidth: 180,
                    '& .MuiInputBase-root': { fontSize: '0.8rem', height: 32 },
                  }}
                />
                <Select
                  size="small"
                  value={filter.operator}
                  onChange={(e) => {
                    setFilters(filters.map((f, i) => (i === idx ? { ...f, operator: e.target.value } : f)));
                  }}
                  sx={{ width: 140, height: 32, fontSize: '0.8rem' }}
                >
                  <MenuItem value="==">equals (==)</MenuItem>
                  <MenuItem value="!=">not equal (!=)</MenuItem>
                  <MenuItem value="<">less than (&lt;)</MenuItem>
                  <MenuItem value="<=">at most (≤)</MenuItem>
                  <MenuItem value=">">greater than (&gt;)</MenuItem>
                  <MenuItem value=">=">at least (≥)</MenuItem>
                  <MenuItem value="array-contains">array contains</MenuItem>
                  <MenuItem value="array-contains-any">array contains any</MenuItem>
                  <MenuItem value="in">in</MenuItem>
                  <MenuItem value="not-in">not in</MenuItem>
                </Select>
                <TextField
                  size="small"
                  value={filter.value === null || filter.value === undefined ? '' : String(filter.value)}
                  onChange={(e) => {
                    setFilters(filters.map((f, i) => (i === idx ? { ...f, value: e.target.value } : f)));
                  }}
                  placeholder="Value"
                  title="Use JSON arrays for in, not-in, and array-contains-any"
                  sx={{ flex: 1, minWidth: 140, '& .MuiInputBase-root': { fontSize: '0.8rem', height: 32 } }}
                />
                <IconButton
                  size="small"
                  aria-label="Remove filter"
                  onClick={() => {
                    setFilters(filters.filter((_, i) => i !== idx));
                    onApply?.();
                  }}
                >
                  ×
                </IconButton>
              </Box>
            ))}
            <Button
              size="small"
              onClick={() => setFilters([...filters, { field: '', operator: '==', value: '' }])}
              sx={{ fontSize: '0.75rem', textTransform: 'none' }}
            >
              + Add Filter
            </Button>
            {filters.length > 0 && (
              <Button
                size="small"
                variant="contained"
                onClick={() => {
                  setFilterMenuOpen(false);
                  onApply?.();
                }}
                sx={{ fontSize: '0.75rem', ml: 1 }}
              >
                Apply
              </Button>
            )}
          </Box>
        )}
      </Box>

      {/* Sort Button */}
      <Box sx={{ position: 'relative' }} ref={sortMenuRef}>
        <Button
          size="small"
          onClick={() => setSortMenuOpen(!sortMenuOpen)}
          startIcon={<SortIcon sx={{ fontSize: 16 }} />}
          sx={{
            textTransform: 'none',
            fontSize: '0.75rem',
            bgcolor: sortConfig.field ? 'action.selected' : 'transparent',
          }}
        >
          Sort {sortConfig.field && `(${sortConfig.field} ${sortConfig.direction === 'asc' ? '↑' : '↓'})`}
        </Button>
        {sortMenuOpen && (
          <Box
            sx={{
              position: 'absolute',
              top: '100%',
              left: 0,
              mt: 0.5,
              bgcolor: 'background.paper',
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
              boxShadow: 3,
              zIndex: 1000,
              minWidth: 360,
              p: 1.5,
            }}
          >
            <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, mb: 1, color: 'text.primary' }}>Sort By</Typography>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
              <Autocomplete
                freeSolo
                disablePortal
                options={fieldOptions}
                value={sortConfig.field || ''}
                onInputChange={(_event, value) => {
                  setSortConfig({ field: value || null, direction: sortConfig.direction });
                }}
                renderInput={(params) => <TextField {...params} size="small" placeholder="Search fields…" />}
                sx={{
                  flex: 1,
                  '& .MuiInputBase-root': { fontSize: '0.8rem', height: 32 },
                }}
              />
              <Select
                size="small"
                value={sortConfig.direction}
                onChange={(event) =>
                  setSortConfig({
                    field: sortConfig.field,
                    direction: event.target.value as 'asc' | 'desc',
                  })
                }
                sx={{ width: 120, height: 32, fontSize: '0.8rem' }}
              >
                <MenuItem value="asc">Ascending</MenuItem>
                <MenuItem value="desc">Descending</MenuItem>
              </Select>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 1.5 }}>
              <Button
                size="small"
                onClick={() => {
                  setSortConfig({ field: null, direction: 'asc' });
                  setSortMenuOpen(false);
                  onApply?.();
                }}
                sx={{ fontSize: '0.75rem', textTransform: 'none' }}
              >
                Clear
              </Button>
              <Button
                size="small"
                variant="contained"
                disabled={!sortConfig.field}
                onClick={() => {
                  setSortMenuOpen(false);
                  onApply?.();
                }}
                sx={{ fontSize: '0.75rem', textTransform: 'none' }}
              >
                Apply
              </Button>
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default FilterSortToolbar;
