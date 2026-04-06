import { useState, useCallback, useRef, useEffect, useMemo, RefObject } from 'react';

interface JsonSearchReturn {
  searchVisible: boolean;
  setSearchVisible: (visible: boolean) => void;
  searchText: string;
  setSearchText: (text: string) => void;
  matchCount: number;
  currentMatch: number;
  searchInputRef: RefObject<HTMLInputElement | null>;
  nextMatch: () => void;
  prevMatch: () => void;
}

function findMatchIndices(haystack: string, needle: string): number[] {
  if (!needle || !haystack) return [];
  const text = haystack.toLowerCase();
  const search = needle.toLowerCase();
  const matches: number[] = [];
  let index = 0;
  while ((index = text.indexOf(search, index)) !== -1) {
    matches.push(index);
    index += search.length;
  }
  return matches;
}

/**
 * Custom hook for JSON search functionality
 * @param jsonEditData - The JSON string to search within
 * @param textareaRef - Ref to the textarea element
 * @returns Search state and handlers
 */
export const useJsonSearch = (
  jsonEditData: string,
  textareaRef: RefObject<HTMLTextAreaElement | null>,
): JsonSearchReturn => {
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [currentMatch, setCurrentMatch] = useState(0);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const matchIndices = useMemo(() => findMatchIndices(jsonEditData, searchText), [jsonEditData, searchText]);

  const matchCount = matchIndices.length;

  useEffect(() => {
    if (matchCount === 0) {
      setCurrentMatch(0);
      return;
    }
    setCurrentMatch((prev) => {
      if (prev === 0) return 1;
      if (prev > matchCount) return 1;
      return prev;
    });
  }, [matchCount]);

  const goToMatch = useCallback(
    (matchIndex: number, focusTextarea = false) => {
      if (matchIndices.length === 0 || !textareaRef.current) return;

      const index = matchIndices[matchIndex - 1];
      if (index === undefined) return;

      const ta = textareaRef.current;
      if (focusTextarea) {
        ta.focus();
      }
      ta.setSelectionRange(index, index + searchText.length);

      const scrollRatio = jsonEditData.length > 0 ? index / jsonEditData.length : 0;
      ta.scrollTop = Math.max(0, ta.scrollHeight * scrollRatio - 100);
    },
    [matchIndices, searchText.length, jsonEditData.length, textareaRef],
  );

  const nextMatch = useCallback(() => {
    if (matchCount === 0) return;
    const next = currentMatch >= matchCount ? 1 : currentMatch + 1;
    setCurrentMatch(next);
    goToMatch(next, false);
  }, [matchCount, currentMatch, goToMatch]);

  const prevMatch = useCallback(() => {
    if (matchCount === 0) return;
    const prev = currentMatch <= 1 ? matchCount : currentMatch - 1;
    setCurrentMatch(prev);
    goToMatch(prev, false);
  }, [matchCount, currentMatch, goToMatch]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setSearchVisible(true);
        setTimeout(() => searchInputRef.current?.focus(), 50);
      }
      if (e.key === 'Escape' && searchVisible) {
        setSearchVisible(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchVisible]);

  return {
    searchVisible,
    setSearchVisible,
    searchText,
    setSearchText,
    matchCount,
    currentMatch,
    searchInputRef,
    nextMatch,
    prevMatch,
  };
};
