import React, { useState } from 'react';
import {
    Box,
    Typography,
    Button,
    IconButton,
    TextField,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Collapse,
    Chip,
} from '@mui/material';
import {
    Search as SearchIcon,
    FilterList as FilterIcon,
    Add as AddIcon,
    Delete as DeleteIcon,
    Clear as ClearIcon,
    ExpandMore as ExpandMoreIcon,
    ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';

const OPERATORS = [
    { value: '==', label: '==' },
    { value: '!=', label: '!=' },
    { value: '<', label: '<' },
    { value: '<=', label: '<=' },
    { value: '>', label: '>' },
    { value: '>=', label: '>=' },
    { value: 'array-contains', label: 'array-contains' },
    { value: 'in', label: 'in' },
    { value: 'not-in', label: 'not-in' },
];

function QueryBuilder({ open, onToggle, onRunQuery, onClearQuery, hasActiveQuery }) {
    const [queries, setQueries] = useState([{ field: '', operator: '==', value: '' }]);
    const [orderByField, setOrderByField] = useState('');
    const [orderByDirection, setOrderByDirection] = useState('asc');
    const [limit, setLimit] = useState(50);

    const addQuery = () => {
        setQueries([...queries, { field: '', operator: '==', value: '' }]);
    };

    const removeQuery = (index) => {
        const newQueries = queries.filter((_, i) => i !== index);
        setQueries(newQueries.length > 0 ? newQueries : [{ field: '', operator: '==', value: '' }]);
    };

    const updateQuery = (index, field, value) => {
        const newQueries = [...queries];
        newQueries[index][field] = value;
        setQueries(newQueries);
    };

    const parseValue = (value, operator) => {
        // Handle array operators
        if (operator === 'in' || operator === 'not-in' || operator === 'array-contains-any') {
            try {
                return JSON.parse(value);
            } catch {
                return value.split(',').map(v => parseSimpleValue(v.trim()));
            }
        }
        return parseSimpleValue(value);
    };

    const parseSimpleValue = (value) => {
        // Try to parse as number
        if (!isNaN(value) && value !== '') {
            return Number(value);
        }
        // Try to parse as boolean
        if (value === 'true') return true;
        if (value === 'false') return false;
        if (value === 'null') return null;
        // Return as string
        return value;
    };

    const handleRunQuery = () => {
        const validQueries = queries
            .filter(q => q.field && q.value !== '')
            .map(q => ({
                field: q.field,
                operator: q.operator,
                value: parseValue(q.value, q.operator),
            }));

        const queryParams = {
            queries: validQueries,
            limit: Number(limit) || 50,
        };

        if (orderByField) {
            queryParams.orderBy = {
                field: orderByField,
                direction: orderByDirection,
            };
        }

        onRunQuery(queryParams);
    };

    const handleClear = () => {
        setQueries([{ field: '', operator: '==', value: '' }]);
        setOrderByField('');
        setOrderByDirection('asc');
        setLimit(50);
        onClearQuery();
    };

    return (
        <Box sx={{ borderBottom: '1px solid #1e3a5f' }}>
            {/* Toggle Header */}
            <Box
                sx={{
                    p: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    backgroundColor: open ? '#1a1a2e' : 'transparent',
                    '&:hover': {
                        backgroundColor: '#1a1a2e',
                    },
                }}
                onClick={onToggle}
            >
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <FilterIcon sx={{ mr: 1, fontSize: 18, color: hasActiveQuery ? '#ff9800' : '#666' }} />
                    <Typography variant="body2" sx={{ color: hasActiveQuery ? '#ff9800' : 'inherit' }}>
                        Query Builder
                    </Typography>
                    {hasActiveQuery && (
                        <Chip
                            label="Active"
                            size="small"
                            sx={{
                                ml: 1,
                                height: 18,
                                fontSize: '0.65rem',
                                backgroundColor: 'rgba(255, 152, 0, 0.2)',
                                color: '#ff9800',
                            }}
                        />
                    )}
                </Box>
                {open ? <ExpandLessIcon sx={{ fontSize: 18 }} /> : <ExpandMoreIcon sx={{ fontSize: 18 }} />}
            </Box>

            {/* Query Builder Content */}
            <Collapse in={open}>
                <Box sx={{ p: 2, backgroundColor: '#1a1a2e' }}>
                    {/* Where Clauses */}
                    <Typography variant="caption" sx={{ color: '#888', mb: 1, display: 'block' }}>
                        WHERE
                    </Typography>

                    {queries.map((query, index) => (
                        <Box key={index} sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
                            <TextField
                                size="small"
                                placeholder="Field"
                                value={query.field}
                                onChange={(e) => updateQuery(index, 'field', e.target.value)}
                                sx={{
                                    width: 120,
                                    '& .MuiInputBase-input': { fontSize: '0.8rem' }
                                }}
                            />
                            <FormControl size="small" sx={{ width: 120 }}>
                                <Select
                                    value={query.operator}
                                    onChange={(e) => updateQuery(index, 'operator', e.target.value)}
                                    sx={{ fontSize: '0.8rem' }}
                                >
                                    {OPERATORS.map((op) => (
                                        <MenuItem key={op.value} value={op.value} sx={{ fontSize: '0.8rem' }}>
                                            {op.label}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                            <TextField
                                size="small"
                                placeholder="Value"
                                value={query.value}
                                onChange={(e) => updateQuery(index, 'value', e.target.value)}
                                sx={{
                                    flexGrow: 1,
                                    '& .MuiInputBase-input': { fontSize: '0.8rem' }
                                }}
                            />
                            <IconButton
                                size="small"
                                onClick={() => removeQuery(index)}
                                sx={{ color: '#666' }}
                            >
                                <DeleteIcon fontSize="small" />
                            </IconButton>
                        </Box>
                    ))}

                    <Button
                        size="small"
                        startIcon={<AddIcon />}
                        onClick={addQuery}
                        sx={{ mb: 2, fontSize: '0.75rem' }}
                    >
                        Add Condition
                    </Button>

                    {/* Order By */}
                    <Typography variant="caption" sx={{ color: '#888', mb: 1, display: 'block' }}>
                        ORDER BY
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                        <TextField
                            size="small"
                            placeholder="Field name"
                            value={orderByField}
                            onChange={(e) => setOrderByField(e.target.value)}
                            sx={{
                                flexGrow: 1,
                                '& .MuiInputBase-input': { fontSize: '0.8rem' }
                            }}
                        />
                        <FormControl size="small" sx={{ width: 100 }}>
                            <Select
                                value={orderByDirection}
                                onChange={(e) => setOrderByDirection(e.target.value)}
                                sx={{ fontSize: '0.8rem' }}
                            >
                                <MenuItem value="asc" sx={{ fontSize: '0.8rem' }}>ASC</MenuItem>
                                <MenuItem value="desc" sx={{ fontSize: '0.8rem' }}>DESC</MenuItem>
                            </Select>
                        </FormControl>
                    </Box>

                    {/* Limit */}
                    <Typography variant="caption" sx={{ color: '#888', mb: 1, display: 'block' }}>
                        LIMIT
                    </Typography>
                    <TextField
                        size="small"
                        type="number"
                        value={limit}
                        onChange={(e) => setLimit(e.target.value)}
                        inputProps={{ min: 1, max: 500 }}
                        sx={{
                            width: 100,
                            mb: 2,
                            '& .MuiInputBase-input': { fontSize: '0.8rem' }
                        }}
                    />

                    {/* Actions */}
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                            variant="contained"
                            size="small"
                            startIcon={<SearchIcon />}
                            onClick={handleRunQuery}
                            sx={{ fontSize: '0.75rem' }}
                        >
                            Run Query
                        </Button>
                        <Button
                            variant="outlined"
                            size="small"
                            startIcon={<ClearIcon />}
                            onClick={handleClear}
                            sx={{ fontSize: '0.75rem' }}
                        >
                            Clear
                        </Button>
                    </Box>
                </Box>
            </Collapse>
        </Box>
    );
}

export default QueryBuilder;
