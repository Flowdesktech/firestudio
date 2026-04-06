import { useRef } from 'react';
import { Box, Typography, useTheme, Button } from '@mui/material';
import { Save as SaveIcon } from '@mui/icons-material';
import JsonSearchBar from './json/JsonSearchBar';
import { useJsonSearch } from './json/useJsonSearch';
import { MONOSPACE_FONT_FAMILY } from '../../../shared/utils/constants';
import { countLines } from '../../../shared/utils/commonUtils';
import CodeEditor from '../../../shared/ui/CodeEditor';

interface JsonViewProps {
  jsonEditData: string;
  setJsonEditData: (data: string) => void;
  jsonHasChanges: boolean;
  setJsonHasChanges: (hasChanges: boolean) => void;
  onSave: () => void | Promise<void>;
}

const JsonView: React.FC<JsonViewProps> = ({
  jsonEditData,
  setJsonEditData,
  jsonHasChanges,
  setJsonHasChanges,
  onSave,
}) => {
  const theme = useTheme();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const editorColors = theme.custom.editor;

  // Use custom hook for search logic
  const {
    searchVisible,
    setSearchVisible,
    searchText,
    setSearchText,
    matchCount,
    currentMatch,
    searchInputRef,
    nextMatch,
    prevMatch,
  } = useJsonSearch(jsonEditData, textareaRef);

  const lineCount = countLines(jsonEditData || '');

  return (
    <Box
      sx={{
        flexGrow: 1,
        display: 'flex',
        flexDirection: 'column',
        bgcolor: editorColors.bg,
        borderTop: 1,
        borderColor: 'divider',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Editor Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 0.5,
          bgcolor: editorColors.gutter,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Typography
          sx={{
            fontSize: '0.75rem',
            color: 'text.secondary',
            fontFamily: MONOSPACE_FONT_FAMILY,
          }}
        >
          JSON Editor
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography
            sx={{
              fontSize: '0.7rem',
              color: 'text.disabled',
            }}
          >
            {lineCount} lines
          </Typography>
          <Button
            size="small"
            variant="contained"
            disableElevation
            startIcon={<SaveIcon />}
            onClick={onSave}
            disabled={!jsonHasChanges}
            sx={{ textTransform: 'none', fontSize: '0.75rem', py: 0.25, minHeight: 28 }}
          >
            Save
          </Button>
        </Box>
      </Box>

      {/* Editor Body */}
      <Box
        sx={{
          flexGrow: 1,
          display: 'flex',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <CodeEditor
          value={jsonEditData}
          onChange={(newValue) => {
            setJsonEditData(newValue);
            setJsonHasChanges(true);
          }}
          language="json"
          textareaRef={textareaRef}
          placeholder="Enter JSON data..."
          searchText={searchVisible ? searchText : ''}
          currentMatchIndex={currentMatch}
        >
          <JsonSearchBar
            visible={searchVisible}
            searchText={searchText}
            setSearchText={setSearchText}
            matchCount={matchCount}
            currentMatch={currentMatch}
            onNext={nextMatch}
            onPrev={prevMatch}
            onClose={() => setSearchVisible(false)}
            inputRef={searchInputRef}
          />
        </CodeEditor>
      </Box>
    </Box>
  );
};

export default JsonView;
