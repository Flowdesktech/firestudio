import React, { useEffect, useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from '@mui/material';
import { FirestoreValue } from '../../../../shared/utils/firestoreUtils';
import { formatDateForDateTimeLocal } from '../../../../shared/utils/dateUtils';
import { MONOSPACE_FONT_FAMILY } from '../../../../shared/utils/constants';

export type AddFieldType =
  'String' | 'Integer' | 'Number' | 'Boolean' | 'Null' | 'Timestamp' | 'GeoPoint' | 'Array' | 'Map' | 'Reference';

const FIELD_TYPES: AddFieldType[] = [
  'String',
  'Integer',
  'Number',
  'Boolean',
  'Null',
  'Timestamp',
  'GeoPoint',
  'Array',
  'Map',
  'Reference',
];

interface AddFieldDialogProps {
  open: boolean;
  parentPathLabel: string;
  existingKeys: string[];
  onClose: () => void;
  onSubmit: (fieldName: string, value: FirestoreValue) => void;
}

const defaultTimestampLocal = (): string => {
  try {
    const formatted = formatDateForDateTimeLocal(new Date());
    if (formatted) return formatted.slice(0, 16);
  } catch {
    // fall through to ISO fallback
  }
  return new Date().toISOString().slice(0, 16);
};

/**
 * AddFieldDialog Component
 * Type-aware dialog for adding a field to a document or nested map in Tree view
 */
const AddFieldDialog: React.FC<AddFieldDialogProps> = ({ open, parentPathLabel, existingKeys, onClose, onSubmit }) => {
  const [fieldName, setFieldName] = useState('');
  const [fieldType, setFieldType] = useState<AddFieldType>('String');
  const [stringValue, setStringValue] = useState('');
  const [numberValue, setNumberValue] = useState('0');
  const [boolValue, setBoolValue] = useState('true');
  const [timestampValue, setTimestampValue] = useState(defaultTimestampLocal());
  const [latValue, setLatValue] = useState('0');
  const [lngValue, setLngValue] = useState('0');
  const [jsonValue, setJsonValue] = useState('[]');
  const [referenceValue, setReferenceValue] = useState('');

  useEffect(() => {
    if (open) {
      setFieldName('');
      setFieldType('String');
      setStringValue('');
      setNumberValue('0');
      setBoolValue('true');
      setTimestampValue(defaultTimestampLocal());
      setLatValue('0');
      setLngValue('0');
      setJsonValue('[]');
      setReferenceValue('');
    }
  }, [open]);

  useEffect(() => {
    if (fieldType === 'Array') setJsonValue('[]');
    if (fieldType === 'Map') setJsonValue('{}');
  }, [fieldType]);

  const trimmedName = fieldName.trim();
  const nameError = !trimmedName
    ? 'Field name is required'
    : trimmedName.includes('.')
      ? 'Field name cannot contain dots'
      : existingKeys.includes(trimmedName)
        ? 'Field already exists'
        : '';

  const jsonError = (() => {
    if (fieldType !== 'Array' && fieldType !== 'Map') return '';
    try {
      const parsed = JSON.parse(jsonValue);
      if (fieldType === 'Array' && !Array.isArray(parsed)) return 'Must be a valid JSON array';
      if (fieldType === 'Map' && (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)))
        return 'Must be a valid JSON object';
      return '';
    } catch {
      return 'Invalid JSON';
    }
  })();

  const geoError = (() => {
    if (fieldType !== 'GeoPoint') return '';
    if (latValue.trim() === '' || lngValue.trim() === '' || isNaN(Number(latValue)) || isNaN(Number(lngValue)))
      return 'Latitude and longitude must be numbers';
    return '';
  })();

  const numberError = (() => {
    if (fieldType !== 'Integer' && fieldType !== 'Number') return '';
    if (numberValue.trim() === '' || isNaN(Number(numberValue))) return 'Must be a valid number';
    return '';
  })();

  const isValid = !nameError && !jsonError && !geoError && !numberError;

  const buildValue = (): FirestoreValue => {
    switch (fieldType) {
      case 'String':
        return stringValue;
      case 'Integer':
        return Math.trunc(Number(numberValue));
      case 'Number':
        return Number(numberValue);
      case 'Boolean':
        return boolValue === 'true';
      case 'Null':
        return null;
      case 'Timestamp': {
        const date = new Date(timestampValue);
        return { _seconds: Math.floor(date.getTime() / 1000), _nanoseconds: 0 };
      }
      case 'GeoPoint':
        return { _latitude: Number(latValue), _longitude: Number(lngValue) };
      case 'Array':
      case 'Map':
        return JSON.parse(jsonValue) as FirestoreValue;
      case 'Reference':
        return referenceValue;
      default:
        return stringValue;
    }
  };

  const handleSave = () => {
    if (!isValid) return;
    onSubmit(trimmedName, buildValue());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleSave();
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>
        Add Field
        <Typography variant="caption" display="block" sx={{ color: 'text.secondary', mt: 0.5 }}>
          {parentPathLabel}
        </Typography>
      </DialogTitle>
      <DialogContent>
        <Typography
          variant="caption"
          sx={{
            display: 'inline-block',
            bgcolor: 'action.hover',
            px: 1,
            py: 0.25,
            borderRadius: 1,
            color: 'text.secondary',
            mb: 1,
          }}
        >
          Type: {fieldType}
        </Typography>
        <TextField
          autoFocus
          fullWidth
          label="Field name"
          value={fieldName}
          onChange={(e) => setFieldName(e.target.value)}
          onKeyDown={handleKeyDown}
          error={Boolean(nameError)}
          helperText={nameError || 'Name for the new field'}
          sx={{ mt: 1 }}
        />
        <FormControl fullWidth sx={{ mt: 2 }}>
          <InputLabel id="add-field-type-label">Type</InputLabel>
          <Select
            labelId="add-field-type-label"
            label="Type"
            value={fieldType}
            onChange={(e) => setFieldType(e.target.value as AddFieldType)}
          >
            {FIELD_TYPES.map((t) => (
              <MenuItem key={t} value={t}>
                {t}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {fieldType === 'String' && (
          <TextField
            fullWidth
            label="Value"
            value={stringValue}
            onChange={(e) => setStringValue(e.target.value)}
            onKeyDown={handleKeyDown}
            sx={{
              mt: 2,
              '& .MuiInputBase-input': { fontFamily: MONOSPACE_FONT_FAMILY, fontSize: '0.9rem' },
            }}
          />
        )}
        {(fieldType === 'Integer' || fieldType === 'Number') && (
          <TextField
            fullWidth
            type="number"
            label="Value"
            value={numberValue}
            onChange={(e) => setNumberValue(e.target.value)}
            onKeyDown={handleKeyDown}
            error={Boolean(numberError)}
            helperText={numberError || undefined}
            sx={{
              mt: 2,
              '& .MuiInputBase-input': { fontFamily: MONOSPACE_FONT_FAMILY, fontSize: '0.9rem' },
            }}
          />
        )}
        {fieldType === 'Boolean' && (
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel id="add-field-bool-label">Value</InputLabel>
            <Select
              labelId="add-field-bool-label"
              label="Value"
              value={boolValue}
              onChange={(e) => setBoolValue(e.target.value)}
            >
              <MenuItem value="true">True</MenuItem>
              <MenuItem value="false">False</MenuItem>
            </Select>
          </FormControl>
        )}
        {fieldType === 'Null' && (
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 2 }}>
            No value needed — saves as null.
          </Typography>
        )}
        {fieldType === 'Timestamp' && (
          <TextField
            fullWidth
            type="datetime-local"
            label="Value"
            value={timestampValue}
            onChange={(e) => setTimestampValue(e.target.value)}
            onKeyDown={handleKeyDown}
            InputLabelProps={{ shrink: true }}
            sx={{
              mt: 2,
              '& .MuiInputBase-input': { fontFamily: MONOSPACE_FONT_FAMILY, fontSize: '0.9rem' },
            }}
          />
        )}
        {fieldType === 'GeoPoint' && (
          <>
            <TextField
              fullWidth
              type="number"
              label="Latitude"
              value={latValue}
              onChange={(e) => setLatValue(e.target.value)}
              onKeyDown={handleKeyDown}
              sx={{
                mt: 2,
                '& .MuiInputBase-input': { fontFamily: MONOSPACE_FONT_FAMILY, fontSize: '0.9rem' },
              }}
            />
            <TextField
              fullWidth
              type="number"
              label="Longitude"
              value={lngValue}
              onChange={(e) => setLngValue(e.target.value)}
              onKeyDown={handleKeyDown}
              sx={{
                mt: 2,
                '& .MuiInputBase-input': { fontFamily: MONOSPACE_FONT_FAMILY, fontSize: '0.9rem' },
              }}
            />
            {geoError && (
              <Typography variant="caption" sx={{ color: 'error.main', mt: 1, display: 'block' }}>
                {geoError}
              </Typography>
            )}
          </>
        )}
        {(fieldType === 'Array' || fieldType === 'Map') && (
          <TextField
            fullWidth
            multiline
            minRows={4}
            maxRows={12}
            label="Value (JSON)"
            value={jsonValue}
            onChange={(e) => setJsonValue(e.target.value)}
            onKeyDown={handleKeyDown}
            error={Boolean(jsonError)}
            helperText={
              jsonError || (fieldType === 'Array' ? 'JSON array, e.g. ["a", 1]' : 'JSON object, e.g. {"k": "v"}')
            }
            placeholder={fieldType === 'Array' ? '["item1", "item2"]' : '{"key": "value"}'}
            sx={{
              mt: 2,
              '& .MuiInputBase-input': {
                fontFamily: MONOSPACE_FONT_FAMILY,
                fontSize: '0.9rem',
                lineHeight: 1.5,
              },
            }}
          />
        )}
        {fieldType === 'Reference' && (
          <TextField
            fullWidth
            label="Reference path"
            value={referenceValue}
            onChange={(e) => setReferenceValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="projects/p/databases/d/documents/c/doc"
            sx={{
              mt: 2,
              '& .MuiInputBase-input': { fontFamily: MONOSPACE_FONT_FAMILY, fontSize: '0.9rem' },
            }}
          />
        )}
        <Typography variant="caption" sx={{ color: 'text.disabled', mt: 1, display: 'block' }}>
          Press Ctrl+Enter to save, Escape to cancel
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained" color="primary" disabled={!isValid}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default AddFieldDialog;
