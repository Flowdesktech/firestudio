import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Box, Typography, IconButton, Button, TextField, Chip, useTheme } from '@mui/material';
import {
  Close as CloseIcon,
  Delete as ClearIcon,
  Terminal as TerminalIcon,
  ContentCopy as CopyIcon,
  HelpOutline as HelpIcon,
} from '@mui/icons-material';
import hljs from 'highlight.js/lib/core';
import json from 'highlight.js/lib/languages/json';
import {
  consoleCompletions,
  Completion,
  firestoreOperatorCompletions,
  orderDirectionCompletions,
} from '../../../shared/utils/completions';
import AutocompletePopover from '../../../shared/ui/AutocompletePopover';
import { EDITOR_FONT_FAMILY } from '../../../shared/utils/constants';
import { useAutocomplete, AutocompleteContext } from '../../../shared/hooks/useAutocomplete';
import { Project, GoogleAccount } from '../../projects/store/projectsSlice';
import { isGoogleAccount } from '../../projects/types';
import { electronService } from '../../../shared/services/electronService';

// Register JSON language
hljs.registerLanguage('json', json);

// Types
interface SyntaxColors {
  string: string;
  number: string;
  literal: string;
  bracket: string;
  key: string;
}

interface HighlightedJsonProps {
  content: string;
  syntaxColors: SyntaxColors;
}

interface ConsoleResult {
  id: string;
  type: 'command' | 'success' | 'error' | 'info' | 'data';
  content: string;
  timestamp: string;
}

type ProjectOrGroup = Project | GoogleAccount;
type FlatProject = Project & { accountEmail?: string };

interface ConsolePanelProps {
  open: boolean;
  onClose: () => void;
  projects?: ProjectOrGroup[];
  addLog?: (type: string, message: string) => void;
  allCollections?: string[];
}

// Highlighted JSON component
function HighlightedJson({ content, syntaxColors }: HighlightedJsonProps) {
  const highlighted = useMemo(() => {
    try {
      const result = hljs.highlight(content, { language: 'json' });
      return result.value;
    } catch {
      return content.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
  }, [content]);

  return (
    <>
      <style>{`
                .console-json .hljs-string { color: ${syntaxColors.string}; }
                .console-json .hljs-number { color: ${syntaxColors.number}; }
                .console-json .hljs-literal { color: ${syntaxColors.literal}; }
                .console-json .hljs-punctuation { color: ${syntaxColors.bracket}; }
                .console-json .hljs-attr { color: ${syntaxColors.key}; }
            `}</style>
      <code className="console-json" dangerouslySetInnerHTML={{ __html: highlighted }} />
    </>
  );
}

function ConsolePanel({ onClose, projects = [], addLog, allCollections = [] }: ConsolePanelProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const electron = electronService.api;
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ConsoleResult[]>([]);
  const [selectedProject, setSelectedProject] = useState<FlatProject | null>(null);
  const [running, setRunning] = useState(false);
  const resultsEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLDivElement>(null);

  // Command history
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Dynamic completions for useAutocomplete
  const getDynamicCompletions = useCallback(
    (context?: AutocompleteContext): Completion[] => {
      const unique = [...new Set(allCollections)];
      const completions: Completion[] = [];
      const methodName = context?.methodCall?.name;
      const argIndex = context?.methodCall?.argIndex ?? -1;
      const isInString = Boolean(context?.isInString);

      const isMethodContext = Boolean(methodName);
      const wantsOperator = methodName === 'where' && argIndex === 1;
      const wantsDirection = methodName === 'orderBy' && argIndex === 1;
      const expectsCollection = ['collection', 'collectionGroup', 'doc'].includes(methodName || '');
      const shouldSuggestCollections = expectsCollection || (!isMethodContext && isInString);

      if (wantsOperator) {
        completions.push(...firestoreOperatorCompletions);
      }
      if (wantsDirection) {
        completions.push(...orderDirectionCompletions);
      }

      if (shouldSuggestCollections) {
        unique.forEach((col) => {
          completions.push({
            trigger: `'${col}`,
            suggestion: `'`,
            cursorOffset: 0,
            description: `Collection: ${col}`,
            kind: 'collection',
          });
          completions.push({
            trigger: `"${col}`,
            suggestion: `"`,
            cursorOffset: 0,
            description: `Collection: ${col}`,
            kind: 'collection',
          });
        });
      }
      return completions;
    },
    [allCollections],
  );

  // Use shared autocomplete hook
  const {
    showAutocomplete,
    setShowAutocomplete,
    completionItems,
    selectedIndex,
    position,
    setPosition,
    handleInputChange: handleAutocompleteChange,
    handleKeyDown: handleAutocompleteKeyDown,
    currentTrigger,
  } = useAutocomplete(consoleCompletions, getDynamicCompletions);

  // Flatten all projects including nested Google OAuth projects
  const allProjects = useMemo((): FlatProject[] => {
    const flat: FlatProject[] = [];
    if (!projects) return flat;
    projects.forEach((p) => {
      if (isGoogleAccount(p)) {
        p.projects?.forEach((proj: Project) => flat.push({ ...proj, accountEmail: p.email }));
        return;
      }
      flat.push(p);
    });
    return flat;
  }, [projects]);

  useEffect(() => {
    if (allProjects.length > 0 && !selectedProject) {
      setSelectedProject(allProjects[0]);
    }
  }, [allProjects, selectedProject]);

  useEffect(() => {
    resultsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [results]);

  const addResult = (type: ConsoleResult['type'], content: string) => {
    setResults((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type,
        content,
        timestamp: new Date().toLocaleTimeString(),
      },
    ]);
  };

  const handleRun = async () => {
    if (!query.trim() || !selectedProject) return;

    const trimmedQuery = query.trim();

    // Add to command history (avoid duplicates at the end)
    if (commandHistory.length === 0 || commandHistory[commandHistory.length - 1] !== trimmedQuery) {
      setCommandHistory((prev) => [...prev, trimmedQuery]);
    }
    setHistoryIndex(-1); // Reset history navigation

    setRunning(true);
    addResult('command', query);

    try {
      if (trimmedQuery === 'help') {
        addResult(
          'info',
          `Available commands:
• db.collection("path").get() - Get documents from a collection
• db.collection("path").limit(n).get() - Get n documents
• db.doc("collection/docId").get() - Get a single document
• clear - Clear console output
• help - Show this help message

Examples:
  db.collection("users").limit(10).get()
  db.doc("users/user123").get()`,
        );
      } else if (trimmedQuery === 'clear') {
        setResults([]);
      } else if (trimmedQuery.startsWith('db.collection(')) {
        const match = trimmedQuery.match(/db\.collection\(['"](.+?)['"]\)/);
        if (match) {
          const collectionPath = match[1];

          if (trimmedQuery.includes('.get()')) {
            const limitMatch = trimmedQuery.match(/\.limit\((\d+)\)/);
            const limit = limitMatch ? parseInt(limitMatch[1]) : 50;

            let result: { success: boolean; documents?: unknown[]; error?: string };
            if (selectedProject.authMethod === 'google') {
              // Google OAuth project
              result = await electron.googleGetDocuments({
                projectId: selectedProject.projectId,
                collectionPath,
                limit,
              });
            } else {
              // Service account project - connect first
              if (!selectedProject.serviceAccountPath) {
                throw new Error('Missing service account path for project');
              }
              await electron.disconnectFirebase();
              await electron.connectFirebase({
                serviceAccountPath: selectedProject.serviceAccountPath,
                databaseId: selectedProject.databaseId,
              });
              result = await electron.getDocuments({
                collectionPath,
                limit,
              });
            }

            if (result.success && result.documents) {
              addResult('success', `Found ${result.documents.length} documents in "${collectionPath}"`);
              addResult('data', JSON.stringify(result.documents, null, 2));
              addLog?.('success', `Console: Fetched ${result.documents.length} docs from ${collectionPath}`);
            } else {
              addResult('error', result.error || 'Unknown error');
            }
          } else {
            addResult('info', `Collection reference: ${collectionPath}\nAdd .get() to fetch documents.`);
          }
        } else {
          addResult('error', 'Invalid collection path. Use: db.collection("path")');
        }
      } else if (trimmedQuery.startsWith('db.doc(')) {
        const match = trimmedQuery.match(/db\.doc\(['"](.+?)['"]\)/);
        if (match) {
          const documentPath = match[1];

          let result: { success: boolean; document?: unknown; error?: string };
          if (selectedProject.authMethod === 'google') {
            // Google OAuth project
            result = await electron.googleGetDocument({
              projectId: selectedProject.projectId,
              documentPath,
            });
          } else {
            // Service account project - connect first
            if (!selectedProject.serviceAccountPath) {
              throw new Error('Missing service account path for project');
            }
            await electron.disconnectFirebase();
            await electron.connectFirebase({
              serviceAccountPath: selectedProject.serviceAccountPath,
              databaseId: selectedProject.databaseId,
            });
            result = await electron.getDocument(documentPath);
          }

          if (result.success) {
            addResult('success', `Document found: ${documentPath}`);
            addResult('data', JSON.stringify(result.document, null, 2));
          } else {
            addResult('error', result.error || 'Unknown error');
          }
        } else {
          addResult('error', 'Invalid document path. Use: db.doc("collection/docId")');
        }
      } else {
        addResult('error', `Unknown command. Type 'help' for available commands.`);
      }
    } catch (error) {
      addResult('error', (error as Error).message);
    } finally {
      setRunning(false);
      setQuery('');
    }
  };

  // Apply completion
  const applyCompletion = useCallback(
    (completion: Completion, trigger: string) => {
      if (!completion) return;
      const triggerLen = trigger ? trigger.length : 0;
      const fullText = completion.insertText ?? completion.trigger + completion.suggestion;
      const text = query;
      const input = inputRef.current?.querySelector('input') as HTMLInputElement | null;
      const cursorPos = input?.selectionStart ?? text.length;

      const stripQuotes = (value: string) => {
        if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) {
          return value.slice(1, -1);
        }
        if (value.startsWith("'") || value.startsWith('"')) return value.slice(1);
        if (value.endsWith("'") || value.endsWith('"')) return value.slice(0, -1);
        return value;
      };

      const isEscaped = (index: number) => {
        let count = 0;
        for (let i = index - 1; i >= 0; i -= 1) {
          if (text[i] !== '\\') break;
          count += 1;
        }
        return count % 2 === 1;
      };

      const replaceInsideQuotes = (quote: "'" | '"') => {
        let start = -1;
        for (let i = cursorPos - 1; i >= 0; i -= 1) {
          if (text[i] === quote && !isEscaped(i)) {
            start = i;
            break;
          }
        }
        if (start === -1) return false;
        let end = -1;
        for (let i = cursorPos; i < text.length; i += 1) {
          if (text[i] === quote && !isEscaped(i)) {
            end = i;
            break;
          }
        }
        if (end === -1 || end < cursorPos) return false;

        const value = stripQuotes(fullText);
        const before = text.substring(0, start + 1);
        const after = text.substring(end);
        const newQuery = before + value + after;
        setQuery(newQuery);
        setShowAutocomplete(false);

        setTimeout(() => {
          if (input) {
            const newPos = start + 1 + value.length;
            input.selectionStart = newPos;
            input.selectionEnd = newPos;
            input.focus();
          }
        }, 0);
        return true;
      };

      const quoteChar = trigger?.startsWith("'") ? "'" : trigger?.startsWith('"') ? '"' : null;
      if (quoteChar && replaceInsideQuotes(quoteChar)) {
        return;
      }

      const before = text.substring(0, cursorPos - triggerLen);
      const after = text.substring(cursorPos);
      const newQuery = before + fullText + after;

      setQuery(newQuery);
      setShowAutocomplete(false);

      setTimeout(() => {
        if (inputRef.current) {
          if (input) {
            const newPos = cursorPos - triggerLen + fullText.length + completion.cursorOffset;
            input.selectionStart = newPos;
            input.selectionEnd = newPos;
            input.focus();
          }
        }
      }, 0);
    },
    [query, setShowAutocomplete],
  );

  // Handle input change
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      const cursorPos = e.target.selectionStart || 0;
      setQuery(newValue);

      // Update autocomplete
      const isActive = handleAutocompleteChange(newValue, cursorPos);
      if (isActive) {
        const rect = e.target.getBoundingClientRect();
        const popoverHeight = 220;
        const padding = 8;
        const above = rect.top - popoverHeight - padding;
        const below = rect.bottom + padding;
        const top = above > 0 ? above : below;
        const maxLeft = Math.max(0, window.innerWidth - 360);
        setPosition({
          top,
          left: Math.min(rect.left, maxLeft),
        });
      }
    },
    [handleAutocompleteChange, setPosition],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Handle autocomplete navigation
    if (handleAutocompleteKeyDown(e, applyCompletion)) {
      return;
    }

    // Normal key handling
    if (e.key === 'Enter' && !e.shiftKey && !showAutocomplete) {
      e.preventDefault();
      handleRun();
    } else if (e.key === 'ArrowUp' && !showAutocomplete) {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIndex = historyIndex === -1 ? commandHistory.length - 1 : Math.max(0, historyIndex - 1);
        setHistoryIndex(newIndex);
        setQuery(commandHistory[newIndex]);
      }
    } else if (e.key === 'ArrowDown' && !showAutocomplete) {
      e.preventDefault();
      if (historyIndex !== -1) {
        const newIndex = historyIndex + 1;
        if (newIndex >= commandHistory.length) {
          setHistoryIndex(-1);
          setQuery('');
        } else {
          setHistoryIndex(newIndex);
          setQuery(commandHistory[newIndex]);
        }
      }
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const commandColor = isDark ? '#58a6ff' : '#0969da';
  const successColor = isDark ? '#7ee787' : '#1a7f37';
  const errorColor = isDark ? '#f85149' : '#cf222e';

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        bgcolor: 'background.paper',
        borderTop: 1,
        borderColor: 'divider',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 1,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.default',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TerminalIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
          <Typography sx={{ fontSize: '0.9rem', fontWeight: 600 }}>Console</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <IconButton
            size="small"
            onClick={() => {
              setQuery('help');
              handleRun();
            }}
            sx={{ color: 'text.secondary' }}
          >
            <HelpIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => setResults([])}
            disabled={results.length === 0}
            sx={{ color: 'text.secondary' }}
          >
            <ClearIcon fontSize="small" />
          </IconButton>
          <IconButton onClick={onClose} size="small" sx={{ color: 'text.secondary' }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>

      {/* Project Selector */}
      {allProjects.length > 0 && (
        <Box
          sx={{
            px: 2,
            py: 1,
            borderBottom: 1,
            borderColor: 'divider',
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            flexWrap: 'wrap',
          }}
        >
          <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>Project:</Typography>
          {allProjects.map((p) => (
            <Chip
              key={p.id}
              label={p.projectId}
              size="small"
              onClick={() => setSelectedProject(p)}
              color={selectedProject?.id === p.id ? 'primary' : 'default'}
              variant={selectedProject?.id === p.id ? 'filled' : 'outlined'}
              sx={{
                fontSize: '0.75rem',
                height: 24,
              }}
            />
          ))}
        </Box>
      )}

      {/* Results */}
      <Box
        sx={{
          flexGrow: 1,
          overflow: 'auto',
          p: 2,
          fontFamily: '"JetBrains Mono", "Fira Code", Consolas, monospace',
          fontSize: '0.8rem',
          bgcolor: isDark ? '#0d1117' : '#f6f8fa',
        }}
      >
        {results.length === 0 ? (
          <Box sx={{ color: 'text.disabled', textAlign: 'center', mt: 4 }}>
            <TerminalIcon sx={{ fontSize: 48, opacity: 0.3, mb: 2 }} />
            <Typography sx={{ fontSize: '0.85rem' }}>Type a command and press Enter to run</Typography>
            <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mt: 1 }}>
              Type{' '}
              <code
                style={{
                  backgroundColor: isDark ? '#21262d' : '#eaeef2',
                  padding: '2px 6px',
                  borderRadius: 4,
                }}
              >
                help
              </code>{' '}
              for available commands
            </Typography>
          </Box>
        ) : (
          results.map((result) => (
            <Box key={result.id} sx={{ mb: 1.5 }}>
              {result.type === 'command' && (
                <Box sx={{ display: 'flex', alignItems: 'flex-start', color: commandColor }}>
                  <Typography
                    component="span"
                    sx={{
                      mr: 1,
                      fontWeight: 600,
                      userSelect: 'none',
                    }}
                  >
                    ❯
                  </Typography>
                  <Typography component="span" sx={{ fontFamily: 'inherit' }}>
                    {result.content}
                  </Typography>
                </Box>
              )}
              {result.type === 'success' && (
                <Typography
                  sx={{
                    color: successColor,
                    pl: 2.5,
                    fontFamily: 'inherit',
                  }}
                >
                  ✓ {result.content}
                </Typography>
              )}
              {result.type === 'error' && (
                <Typography
                  sx={{
                    color: errorColor,
                    pl: 2.5,
                    fontFamily: 'inherit',
                  }}
                >
                  ✗ {result.content}
                </Typography>
              )}
              {result.type === 'info' && (
                <Typography
                  sx={{
                    color: 'text.secondary',
                    whiteSpace: 'pre-wrap',
                    pl: 2.5,
                    fontFamily: 'inherit',
                    lineHeight: 1.6,
                  }}
                >
                  {result.content}
                </Typography>
              )}
              {result.type === 'data' && (
                <Box sx={{ position: 'relative', pl: 2.5 }}>
                  <IconButton
                    size="small"
                    onClick={() => copyToClipboard(result.content)}
                    sx={{
                      position: 'absolute',
                      right: 8,
                      top: 8,
                      bgcolor: 'background.paper',
                      '&:hover': { bgcolor: 'action.hover' },
                    }}
                  >
                    <CopyIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                  <Box
                    component="pre"
                    sx={{
                      backgroundColor: isDark ? '#161b22' : '#ffffff',
                      border: 1,
                      borderColor: 'divider',
                      p: 1.5,
                      pr: 5,
                      borderRadius: 1,
                      overflow: 'auto',
                      maxHeight: 250,
                      fontSize: '0.75rem',
                      fontFamily: EDITOR_FONT_FAMILY,
                      m: 0,
                    }}
                  >
                    <HighlightedJson content={result.content} syntaxColors={theme.custom.syntax} />
                  </Box>
                </Box>
              )}
            </Box>
          ))
        )}
        <div ref={resultsEndRef} />
      </Box>

      {/* Input */}
      <Box
        ref={inputRef}
        sx={{
          display: 'flex',
          alignItems: 'center',
          p: 1.5,
          borderTop: 1,
          borderColor: 'divider',
          bgcolor: 'background.default',
          gap: 1,
          position: 'relative',
        }}
      >
        <Typography
          sx={{
            color: commandColor,
            fontFamily: '"JetBrains Mono", "Fira Code", Consolas, monospace',
            fontWeight: 600,
            fontSize: '0.9rem',
          }}
        >
          ❯
        </Typography>
        <TextField
          fullWidth
          size="small"
          placeholder={selectedProject ? 'db.collection("users").limit(10).get()' : 'Connect a project first...'}
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          disabled={running || !selectedProject}
          sx={{
            '& .MuiInputBase-input': {
              fontFamily: EDITOR_FONT_FAMILY,
              fontSize: '0.85rem',
            },
            '& .MuiOutlinedInput-root': {
              bgcolor: 'background.paper',
            },
          }}
        />
        <Button
          variant="contained"
          size="small"
          onClick={handleRun}
          disabled={running || !query.trim() || !selectedProject}
          disableElevation
          sx={{
            minWidth: 70,
            textTransform: 'none',
            fontWeight: 600,
          }}
        >
          {running ? '...' : 'Run'}
        </Button>

        {/* Autocomplete Popover */}
        <AutocompletePopover
          show={showAutocomplete}
          items={completionItems}
          selectedIndex={selectedIndex}
          position={position}
          onSelect={(item) => applyCompletion(item, currentTrigger || item.trigger)}
          maxWidth={350}
        />
      </Box>
    </Box>
  );
}

export default ConsolePanel;
