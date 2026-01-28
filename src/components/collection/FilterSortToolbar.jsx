import React, { useRef, useEffect } from 'react';
import {
    Box,
    Button,
    IconButton,
    Typography,
} from '@mui/material';
import {
    FilterList as FilterIcon,
    Sort as SortIcon,
} from '@mui/icons-material';

function FilterSortToolbar({
    filters,
    setFilters,
    sortConfig,
    setSortConfig,
    allFields,
    isDark,
    borderColor,
    textColor,
}) {
    const [filterMenuOpen, setFilterMenuOpen] = React.useState(false);
    const [sortMenuOpen, setSortMenuOpen] = React.useState(false);

    const filterMenuRef = useRef(null);
    const sortMenuRef = useRef(null);

    // Close popups when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (filterMenuRef.current && !filterMenuRef.current.contains(e.target)) {
                setFilterMenuOpen(false);
            }
            if (sortMenuRef.current && !sortMenuRef.current.contains(e.target)) {
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
        <Box sx={{ display: 'flex', alignItems: 'center', p: 0.5, borderBottom: `1px solid ${borderColor}`, gap: 1 }}>
            {/* Filter Button */}
            <Box sx={{ position: 'relative' }} ref={filterMenuRef}>
                <Button
                    size="small"
                    onClick={() => setFilterMenuOpen(!filterMenuOpen)}
                    startIcon={<FilterIcon sx={{ fontSize: 16 }} />}
                    sx={{
                        textTransform: 'none',
                        fontSize: '0.75rem',
                        backgroundColor: filters.length > 0 ? (isDark ? 'rgba(25, 118, 210, 0.3)' : '#e3f2fd') : 'transparent',
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
                            backgroundColor: isDark ? '#2d2d2d' : '#fff',
                            border: `1px solid ${borderColor}`,
                            borderRadius: 1,
                            boxShadow: 3,
                            zIndex: 1000,
                            minWidth: 320,
                            p: 1.5,
                        }}
                    >
                        <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, mb: 1, color: textColor }}>Add Filter</Typography>
                        {filters.map((filter, idx) => (
                            <Box key={idx} sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
                                <select
                                    value={filter.field}
                                    onChange={(e) => {
                                        const newFilters = [...filters];
                                        newFilters[idx].field = e.target.value;
                                        setFilters(newFilters);
                                    }}
                                    style={{ flex: 1, padding: '4px 8px', fontSize: '0.8rem', backgroundColor: isDark ? '#1e1e1e' : '#fff', color: textColor, border: `1px solid ${borderColor}`, borderRadius: 4 }}
                                >
                                    <option value="">Select field</option>
                                    {allFields.map(f => <option key={f} value={f}>{f}</option>)}
                                </select>
                                <select
                                    value={filter.operator}
                                    onChange={(e) => {
                                        const newFilters = [...filters];
                                        newFilters[idx].operator = e.target.value;
                                        setFilters(newFilters);
                                    }}
                                    style={{ width: 70, padding: '4px 8px', fontSize: '0.8rem', backgroundColor: isDark ? '#1e1e1e' : '#fff', color: textColor, border: `1px solid ${borderColor}`, borderRadius: 4 }}
                                >
                                    <option value="==">==</option>
                                    <option value="!=">!=</option>
                                    <option value="<">&lt;</option>
                                    <option value=">">&gt;</option>
                                    <option value="<=">≤</option>
                                    <option value=">=">≥</option>
                                </select>
                                <input
                                    value={filter.value}
                                    onChange={(e) => {
                                        const newFilters = [...filters];
                                        newFilters[idx].value = e.target.value;
                                        setFilters(newFilters);
                                    }}
                                    placeholder="Value"
                                    style={{ flex: 1, padding: '4px 8px', fontSize: '0.8rem', backgroundColor: isDark ? '#1e1e1e' : '#fff', color: textColor, border: `1px solid ${borderColor}`, borderRadius: 4 }}
                                />
                                <IconButton size="small" onClick={() => setFilters(filters.filter((_, i) => i !== idx))}>×</IconButton>
                            </Box>
                        ))}
                        <Button size="small" onClick={() => setFilters([...filters, { field: '', operator: '==', value: '' }])} sx={{ fontSize: '0.75rem', textTransform: 'none' }}>
                            + Add Filter
                        </Button>
                        {filters.length > 0 && (
                            <Button size="small" variant="contained" onClick={() => setFilterMenuOpen(false)} sx={{ fontSize: '0.75rem', ml: 1 }}>
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
                        backgroundColor: sortConfig.field ? (isDark ? 'rgba(25, 118, 210, 0.3)' : '#e3f2fd') : 'transparent',
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
                            backgroundColor: isDark ? '#2d2d2d' : '#fff',
                            border: `1px solid ${borderColor}`,
                            borderRadius: 1,
                            boxShadow: 3,
                            zIndex: 1000,
                            minWidth: 200,
                            p: 1,
                        }}
                    >
                        <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, mb: 1, color: textColor }}>Sort By</Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, maxHeight: 200, overflow: 'auto' }}>
                            <Box
                                onClick={() => { setSortConfig({ field: '', direction: 'asc' }); setSortMenuOpen(false); }}
                                sx={{ px: 1, py: 0.5, cursor: 'pointer', borderRadius: 0.5, '&:hover': { backgroundColor: isDark ? '#333' : '#f5f5f5' }, color: !sortConfig.field ? '#1976d2' : textColor }}
                            >
                                None
                            </Box>
                            {allFields.map(f => (
                                <Box
                                    key={f}
                                    onClick={() => {
                                        if (sortConfig.field === f) {
                                            setSortConfig({ field: f, direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' });
                                        } else {
                                            setSortConfig({ field: f, direction: 'asc' });
                                        }
                                        setSortMenuOpen(false);
                                    }}
                                    sx={{
                                        px: 1,
                                        py: 0.5,
                                        cursor: 'pointer',
                                        borderRadius: 0.5,
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        '&:hover': { backgroundColor: isDark ? '#333' : '#f5f5f5' },
                                        color: sortConfig.field === f ? '#1976d2' : textColor,
                                        fontWeight: sortConfig.field === f ? 600 : 400,
                                    }}
                                >
                                    <span style={{ fontSize: '0.8rem' }}>{f}</span>
                                    {sortConfig.field === f && <span>{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>}
                                </Box>
                            ))}
                        </Box>
                    </Box>
                )}
            </Box>
        </Box>
    );
}

export default FilterSortToolbar;
