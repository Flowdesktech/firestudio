/**
 * Autocomplete Hook
 * Reusable autocomplete logic for code editors and console
 */

import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Custom hook for autocomplete functionality
 * @param {Object} options - Hook options
 * @param {Array} options.completions - Array of completion objects
 * @param {Function} options.onChange - Callback when value changes
 * @param {string} options.value - Current input value
 * @returns {Object} - Autocomplete state and handlers
 */
export function useAutocomplete({ completions, onChange, value }) {
    const inputRef = useRef(null);
    const [showAutocomplete, setShowAutocomplete] = useState(false);
    const [autocompleteItems, setAutocompleteItems] = useState([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [autocompletePosition, setAutocompletePosition] = useState({ top: 0, left: 0 });
    const [currentTrigger, setCurrentTrigger] = useState('');

    // Get word at cursor for autocomplete
    const getWordAtCursor = useCallback((text, cursorPos) => {
        const textBefore = text.substring(0, cursorPos);
        // Find the start of current word/trigger
        const match = textBefore.match(/[\w.]*$/);
        return match ? match[0] : '';
    }, []);

    // Filter completions based on current input
    const filterCompletions = useCallback((trigger) => {
        if (!trigger || trigger.length < 1) return [];

        const lowerTrigger = trigger.toLowerCase();
        return completions.filter(c => {
            const lowerT = c.trigger.toLowerCase();
            return lowerT.startsWith(lowerTrigger) ||
                lowerT.includes(lowerTrigger) ||
                (c.description && c.description.toLowerCase().includes(lowerTrigger));
        }).slice(0, 10); // Limit to 10 items
    }, [completions]);

    // Calculate autocomplete position
    const calculatePosition = useCallback((inputElement, cursorPos, isMultiline = false) => {
        if (!inputElement) return { top: 0, left: 0 };

        const rect = inputElement.getBoundingClientRect();

        if (isMultiline) {
            const textBefore = (value || '').substring(0, cursorPos);
            const lines = textBefore.split('\n');
            const currentLineIndex = lines.length - 1;
            const currentLineText = lines[currentLineIndex];

            // Approximate position
            const charWidth = 7.8;
            const lineHeight = 19.5;
            const paddingTop = 8;
            const paddingLeft = 16;

            const top = rect.top + paddingTop + (currentLineIndex * lineHeight) + lineHeight - inputElement.scrollTop;
            const left = rect.left + paddingLeft + (currentLineText.length * charWidth) - inputElement.scrollLeft;

            return { top: Math.max(0, top), left: Math.max(0, Math.min(left, rect.right - 300)) };
        } else {
            // Single line input
            return {
                top: rect.bottom + 4,
                left: rect.left
            };
        }
    }, [value]);

    // Handle input change
    const handleChange = useCallback((e, isMultiline = false) => {
        const newValue = e.target.value;
        onChange(newValue);

        // Check for autocomplete
        const cursorPos = e.target.selectionStart;
        const trigger = getWordAtCursor(newValue, cursorPos);

        if (trigger && trigger.length >= 1) {
            const items = filterCompletions(trigger);
            if (items.length > 0) {
                setAutocompleteItems(items);
                setSelectedIndex(0);
                setCurrentTrigger(trigger);
                setAutocompletePosition(calculatePosition(e.target, cursorPos, isMultiline));
                setShowAutocomplete(true);
            } else {
                setShowAutocomplete(false);
            }
        } else {
            setShowAutocomplete(false);
        }
    }, [onChange, getWordAtCursor, filterCompletions, calculatePosition]);

    // Apply selected completion
    const applyCompletion = useCallback((completion, isMultiline = false) => {
        const inputElement = inputRef.current;
        if (!inputElement || !completion) return;

        const cursorPos = inputElement.selectionStart || (value || '').length;
        const triggerLen = currentTrigger.length;

        // Replace the trigger with full completion
        const fullText = completion.trigger + completion.suggestion;
        const before = (value || '').substring(0, cursorPos - triggerLen);
        const after = (value || '').substring(cursorPos);
        const newText = before + fullText + after;

        onChange(newText);
        setShowAutocomplete(false);

        // Set cursor position after completion
        setTimeout(() => {
            const newPos = cursorPos - triggerLen + fullText.length + completion.cursorOffset;
            inputElement.selectionStart = newPos;
            inputElement.selectionEnd = newPos;
            inputElement.focus();
        }, 0);
    }, [value, onChange, currentTrigger]);

    // Handle keyboard events for autocomplete
    const handleKeyDown = useCallback((e, customHandlers = {}) => {
        if (showAutocomplete) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(prev => Math.min(prev + 1, autocompleteItems.length - 1));
                return true;
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(prev => Math.max(prev - 1, 0));
                return true;
            }
            if (e.key === 'Tab' || e.key === 'Enter') {
                e.preventDefault();
                if (autocompleteItems[selectedIndex]) {
                    applyCompletion(autocompleteItems[selectedIndex], customHandlers.isMultiline);
                }
                return true;
            }
            if (e.key === 'Escape') {
                e.preventDefault();
                setShowAutocomplete(false);
                return true;
            }
        }
        return false;
    }, [showAutocomplete, autocompleteItems, selectedIndex, applyCompletion]);

    // Close autocomplete on outside click
    useEffect(() => {
        const handleClickOutside = () => setShowAutocomplete(false);
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, []);

    // Close on scroll
    const handleScroll = useCallback(() => {
        setShowAutocomplete(false);
    }, []);

    return {
        inputRef,
        showAutocomplete,
        setShowAutocomplete,
        autocompleteItems,
        selectedIndex,
        setSelectedIndex,
        autocompletePosition,
        currentTrigger,
        handleChange,
        handleKeyDown,
        handleScroll,
        applyCompletion,
    };
}

export default useAutocomplete;
