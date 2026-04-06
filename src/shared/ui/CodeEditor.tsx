import React, { useRef, useMemo, useEffect, useCallback } from 'react';
import { Box, useTheme } from '@mui/material';
import hljs from 'highlight.js/lib/core';
import javascript from 'highlight.js/lib/languages/javascript';
import { MONOSPACE_FONT_FAMILY, EDITOR_FONT_FAMILY } from '../utils/constants';
import { countLines } from '../utils/commonUtils';

/** Beyond these limits, skip syntax highlighting and overlay search marks to keep the UI responsive. */
const MAX_SYNTAX_CHARS = 120_000;
const MAX_SYNTAX_LINES = 2_500;

// Register languages
hljs.registerLanguage('javascript', javascript);

/**
 * Shared CodeEditor component with line numbers and syntax highlighting
 */
interface CodeEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  language?: string;
  placeholder?: string;
  className?: string;
  readOnly?: boolean;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
  scrollRef?: React.MutableRefObject<{ scrollTop: (top: number) => void } | null>;
  searchText?: string;
  currentMatchIndex?: number;
  children?: React.ReactNode;
}

function CodeEditor({
  value,
  onChange,
  language = 'text',
  placeholder,
  className,
  readOnly = false,
  onKeyDown,
  textareaRef: externalRef,
  scrollRef: externalScrollRef,
  searchText = '',
  currentMatchIndex = 0,
  children,
}: CodeEditorProps) {
  const theme = useTheme();
  const internalRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLPreElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const editorColors = theme.custom.editor;
  const syntaxColors = theme.custom.syntax;

  // Use external ref if provided, otherwise internal
  const textareaRef = externalRef || internalRef;

  const raw = value || '';
  const lineCount = countLines(raw);
  const minLines = Math.max(lineCount, 8);
  const skipHeavyWork = raw.length > MAX_SYNTAX_CHARS || lineCount > MAX_SYNTAX_LINES;

  const lineNumbersText = useMemo(() => {
    let s = '';
    for (let i = 1; i <= minLines; i++) {
      if (i > 1) s += '\n';
      s += String(i);
    }
    return s;
  }, [minLines]);

  const gutterWidth = Math.min(96, Math.max(40, 12 + String(minLines).length * 7));

  const highlightedCode = useMemo(() => {
    if (!raw) return '';
    const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    if (skipHeavyWork) {
      return escapeHtml(raw);
    }

    try {
      const result = hljs.highlight(raw, { language });
      let html = result.value;

      if (searchText) {
        const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const escapedSearch = escapeRegex(searchText);
        const searchRegex = new RegExp(`(${escapedSearch})`, 'gi');

        let matchIndex = 0;
        html = html.replace(searchRegex, (match: string) => {
          matchIndex++;
          const isCurrent = matchIndex === currentMatchIndex;
          return `<mark class="search-match${isCurrent ? ' current-match' : ''}">${match}</mark>`;
        });
      }

      return html;
    } catch {
      return escapeHtml(raw);
    }
  }, [raw, language, searchText, currentMatchIndex, skipHeavyWork]);

  // Sync scroll
  const syncScroll = useCallback((target: HTMLTextAreaElement) => {
    const { scrollTop, scrollLeft } = target;
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = scrollTop;
    }
    if (highlightRef.current) {
      highlightRef.current.scrollTop = scrollTop;
      highlightRef.current.scrollLeft = scrollLeft;
    }
  }, []);

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLTextAreaElement>) => {
      syncScroll(e.currentTarget);
    },
    [syncScroll],
  );

  // Expose scroll handler
  useEffect(() => {
    if (externalScrollRef) {
      externalScrollRef.current = {
        scrollTop: (top: number) => {
          if (textareaRef.current) {
            textareaRef.current.scrollTop = top;
            syncScroll(textareaRef.current);
          }
        },
      };
    }
  }, [externalScrollRef, syncScroll, textareaRef]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexGrow: 1,
        height: '100%',
        overflow: 'hidden',
        position: 'relative',
        bgcolor: editorColors.bg,
      }}
      className={className}
    >
      {/* Styles for syntax highlighting */}
      <style>{`
                .shared-editor-highlight span.hljs-keyword { color: ${syntaxColors.keyword}; }
                .shared-editor-highlight span.hljs-string { color: ${syntaxColors.string}; }
                .shared-editor-highlight span.hljs-number { color: ${syntaxColors.number}; }
                .shared-editor-highlight span.hljs-function { color: ${syntaxColors.function}; }
                .shared-editor-highlight span.hljs-title { color: ${syntaxColors.function}; }
                .shared-editor-highlight span.hljs-comment { color: ${syntaxColors.comment}; font-style: italic; }
                .shared-editor-highlight span.hljs-operator { color: ${syntaxColors.operator}; }
                .shared-editor-highlight span.hljs-variable { color: ${syntaxColors.variable}; }
                .shared-editor-highlight span.hljs-property { color: ${syntaxColors.property}; }
                .shared-editor-highlight span.hljs-built_in { color: ${syntaxColors.builtin}; }
                .shared-editor-highlight span.hljs-params { color: ${syntaxColors.variable}; }
                .shared-editor-highlight span.hljs-literal { color: ${syntaxColors.keyword}; }
                .shared-editor-highlight span.hljs-attr { color: ${syntaxColors.property}; }
                .shared-editor-highlight span.hljs-punctuation { color: ${syntaxColors.bracket}; }
                .shared-editor-highlight mark.search-match { background-color: rgba(255, 235, 59, 0.4); color: inherit; border-radius: 2px; }
                .shared-editor-highlight mark.search-match.current-match { background-color: rgba(255, 152, 0, 0.6); outline: 1px solid #ff9800; }
            `}</style>

      {/* Line Numbers */}
      <Box
        ref={lineNumbersRef}
        component="pre"
        sx={{
          width: gutterWidth,
          minWidth: gutterWidth,
          bgcolor: editorColors.gutter,
          borderRight: 1,
          borderColor: 'divider',
          overflow: 'hidden',
          pt: 1,
          m: 0,
          userSelect: 'none',
          textAlign: 'right',
          pr: 1.5,
          fontSize: '13px',
          lineHeight: '1.5em',
          fontFamily: MONOSPACE_FONT_FAMILY,
          color: editorColors.lineNumber,
        }}
      >
        {lineNumbersText}
      </Box>

      {/* Editor Area */}
      <Box
        sx={{
          position: 'relative',
          flexGrow: 1,
          overflow: 'hidden',
          display: 'flex',
        }}
      >
        {/* Highlight Overlay (Background) */}
        <pre
          ref={highlightRef}
          className="shared-editor-highlight"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            margin: 0,
            padding: '8px 16px',
            fontFamily: EDITOR_FONT_FAMILY,
            fontSize: '13px',
            lineHeight: '1.5em',
            backgroundColor: editorColors.bg,
            color: theme.palette.text.primary,
            overflow: 'auto',
            whiteSpace: 'pre',
            pointerEvents: 'none',
          }}
          dangerouslySetInnerHTML={{ __html: highlightedCode || '&nbsp;' }}
        />

        {/* Textarea (Foreground) */}
        <textarea
          ref={textareaRef}
          value={value || ''}
          onChange={(e) => onChange && onChange(e.target.value)}
          onScroll={handleScroll}
          onKeyDown={onKeyDown}
          spellCheck={false}
          readOnly={readOnly}
          placeholder={placeholder}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: '100%',
            height: '100%',
            fontFamily: EDITOR_FONT_FAMILY,
            fontSize: '13px',
            lineHeight: '1.5em',
            border: 'none',
            outline: 'none',
            padding: '8px 16px',
            resize: 'none',
            backgroundColor: 'transparent',
            color: 'transparent',
            caretColor: theme.palette.primary.main,
            tabSize: 2,
            whiteSpace: 'pre',
            overflow: 'auto',
          }}
        />

        {children}
      </Box>
    </Box>
  );
}

export default CodeEditor;
