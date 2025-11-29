import { onMounted, onUnmounted, type Ref } from 'vue';
import { EditorView, keymap } from '@codemirror/view';
import { EditorState, type SelectionRange } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { syntaxHighlighting, HighlightStyle } from '@codemirror/language';
import { tags } from '@lezer/highlight';

/**
 * Helper function to toggle wrapper characters around selection
 */
function toggleWrapper(view: EditorView, wrapper: string, wrapperEnd?: string): boolean {
  const endWrapper = wrapperEnd || wrapper;
  const state = view.state;
  const changes: any[] = [];
  const newSelections: any[] = [];

  state.selection.ranges.forEach((range: SelectionRange) => {
    const { from, to } = range;
    const selectedText = state.doc.sliceString(from, to);
    
    // Check if text is already wrapped
    const before = state.doc.sliceString(Math.max(0, from - wrapper.length), from);
    const after = state.doc.sliceString(to, Math.min(state.doc.length, to + endWrapper.length));
    
    if (before === wrapper && after === endWrapper) {
      // Remove wrapper - delete the wrapper characters before and after
      changes.push({
        from: from - wrapper.length,
        to: to + endWrapper.length,
        insert: selectedText
      });
      // Update selection to account for removed wrapper
      newSelections.push({
        anchor: from - wrapper.length,
        head: from - wrapper.length + selectedText.length
      });
    } else {
      // Add wrapper
      const wrappedText = `${wrapper}${selectedText}${endWrapper}`;
      changes.push({
        from,
        to,
        insert: wrappedText
      });
      // Update selection to be inside the wrapper
      newSelections.push({
        anchor: from + wrapper.length,
        head: from + wrapper.length + selectedText.length
      });
    }
  });

  if (changes.length > 0) {
    view.dispatch({
      changes,
      selection: { anchor: newSelections[0].anchor, head: newSelections[0].head }
    });
    return true;
  }
  return false;
}

/**
 * Helper function to toggle line prefix (for headings, blockquotes, etc.)
 */
function toggleLinePrefix(view: EditorView, prefix: string): boolean {
  const state = view.state;
  const changes: any[] = [];
  const selections: any[] = [];

  state.selection.ranges.forEach((range: SelectionRange) => {
    const line = state.doc.lineAt(range.from);
    const lineText = line.text;
    const trimmedLine = lineText.trimStart();
    const leadingSpaces = lineText.length - trimmedLine.length;

    let cursorOffset = 0;
    
    if (trimmedLine.startsWith(prefix)) {
      // Remove prefix
      const newText = lineText.slice(0, leadingSpaces) + trimmedLine.slice(prefix.length);
      changes.push({ from: line.from, to: line.to, insert: newText });
      cursorOffset = -prefix.length;
    } else {
      // Add prefix
      const newText = lineText.slice(0, leadingSpaces) + prefix + trimmedLine;
      changes.push({ from: line.from, to: line.to, insert: newText });
      cursorOffset = prefix.length;
    }
    
    // Maintain cursor position relative to the change
    const newPos = Math.max(line.from + leadingSpaces, range.from + cursorOffset);
    selections.push({ anchor: newPos, head: newPos });
  });

  if (changes.length > 0) {
    view.dispatch({
      changes,
      selection: { anchor: selections[0].anchor, head: selections[0].head }
    });
    return true;
  }
  return false;
}

/**
 * Helper function to set heading level
 */
function setHeading(view: EditorView, level: number): boolean {
  const state = view.state;
  const changes: any[] = [];
  const selections: any[] = [];

  state.selection.ranges.forEach((range: SelectionRange) => {
    const line = state.doc.lineAt(range.from);
    const lineText = line.text;
    const trimmedLine = lineText.trimStart();
    const leadingSpaces = lineText.length - trimmedLine.length;

    // Remove existing heading markers
    const headingMatch = trimmedLine.match(/^#+\s*/);
    const oldPrefixLength = headingMatch ? headingMatch[0].length : 0;
    const textWithoutHeading = headingMatch 
      ? trimmedLine.slice(headingMatch[0].length)
      : trimmedLine;

    // Add new heading level
    const prefix = '#'.repeat(level) + ' ';
    const newText = lineText.slice(0, leadingSpaces) + prefix + textWithoutHeading;
    changes.push({ from: line.from, to: line.to, insert: newText });
    
    // Adjust cursor position based on the change in prefix length
    const offset = prefix.length - oldPrefixLength;
    const newPos = Math.max(line.from + leadingSpaces + prefix.length, range.from + offset);
    selections.push({ anchor: newPos, head: newPos });
  });

  if (changes.length > 0) {
    view.dispatch({
      changes,
      selection: { anchor: selections[0].anchor, head: selections[0].head }
    });
    return true;
  }
  return false;
}

/**
 * Insert horizontal rule
 */
function insertHorizontalRule(view: EditorView): boolean {
  const state = view.state;
  const line = state.doc.lineAt(state.selection.main.from);
  const isLineEmpty = line.text.trim() === '';
  
  // Insert on new line if current line is not empty
  const insertPos = isLineEmpty ? line.from : line.to;
  const hr = isLineEmpty ? '---' : '\n\n---\n\n';
  
  view.dispatch({
    changes: { from: insertPos, insert: hr },
    selection: { anchor: insertPos + hr.length }
  });
  
  return true;
}

export function useMDEditor(editorElement: Ref<HTMLElement | undefined>) {
  let editorView: EditorView | null = null;

  // Custom theme using global.css colors
  const customTheme = EditorView.theme({
    '&': {
      backgroundColor: 'var(--color-background)',
      color: 'var(--color-foreground)',
    },
    '.cm-content': {
      caretColor: 'var(--color-accent)',
    },
    '&.cm-focused .cm-cursor': {
      borderLeftColor: 'var(--color-accent)',
    },
    '&.cm-focused .cm-selectionBackground, ::selection': {
      backgroundColor: 'var(--color-selection-focused)',
    },
    '.cm-selectionBackground': {
      backgroundColor: 'var(--color-selection)',
    },
  });

  // Custom highlight style using global.css colors
  const customHighlightStyle = HighlightStyle.define([
    { tag: tags.heading1, color: 'var(--color-foreground)', fontWeight: '700', fontSize: '1.5em' },
    { tag: tags.heading2, color: 'var(--color-foreground)', fontWeight: '700', fontSize: '1.3em' },
    { tag: tags.heading3, color: 'var(--color-foreground)', fontWeight: '700', fontSize: '1.1em' },
    { tag: tags.heading4, color: 'var(--color-foreground)', fontWeight: '600' },
    { tag: tags.heading5, color: 'var(--color-foreground)', fontWeight: '600' },
    { tag: tags.heading6, color: 'var(--color-foreground)', fontWeight: '600' },
    { tag: tags.emphasis, color: 'var(--color-foreground)', fontStyle: 'italic' },
    { tag: tags.strong, color: 'var(--color-foreground)', fontWeight: '700' },
    { tag: tags.link, color: 'var(--color-foreground)', textDecoration: 'underline' },
    { tag: tags.monospace, color: 'var(--color-foreground)', fontFamily: 'monospace' },
    { tag: tags.quote, color: 'var(--color-accent)', fontStyle: 'italic' },
    { tag: tags.list, color: 'var(--color-foreground)' },
    { tag: tags.content, color: 'var(--color-foreground)' },
  ]);

  // Formatting functions
  const toggleBold = () => {
    if (!editorView) return false;
    return toggleWrapper(editorView, '**');
  };

  const toggleItalic = () => {
    if (!editorView) return false;
    return toggleWrapper(editorView, '*');
  };

  const toggleStrikethrough = () => {
    if (!editorView) return false;
    return toggleWrapper(editorView, '~~');
  };

  const toggleInlineCode = () => {
    if (!editorView) return false;
    return toggleWrapper(editorView, '`');
  };

  const toggleBlockquote = () => {
    if (!editorView) return false;
    return toggleLinePrefix(editorView, '> ');
  };

  const setHeadingLevel = (level: number) => {
    if (!editorView) return false;
    if (level < 1 || level > 6) return false;
    return setHeading(editorView, level);
  };

  const insertHR = () => {
    if (!editorView) return false;
    return insertHorizontalRule(editorView);
  };

  // Keyboard shortcuts (case-insensitive for letters)
  const customKeymap = keymap.of([
    // Bold - Ctrl/Cmd+B (and uppercase variant)
    {
      key: 'Mod-b',
      run: () => toggleBold(),
      preventDefault: true,
    },
    {
      key: 'Mod-B',
      run: () => toggleBold(),
      preventDefault: true,
    },
    // Italic - Ctrl/Cmd+I (and uppercase variant)
    {
      key: 'Mod-i',
      run: () => toggleItalic(),
      preventDefault: true,
    },
    {
      key: 'Mod-I',
      run: () => toggleItalic(),
      preventDefault: true,
    },
    // Inline Code - Ctrl/Cmd+E (and uppercase variant)
    {
      key: 'Mod-e',
      run: () => toggleInlineCode(),
      preventDefault: true,
    },
    {
      key: 'Mod-E',
      run: () => toggleInlineCode(),
      preventDefault: true,
    },
    // Strikethrough - Ctrl/Cmd+Shift+S (case-insensitive)
    {
      key: 'Mod-Shift-s',
      run: () => toggleStrikethrough(),
      preventDefault: true,
    },
    {
      key: 'Mod-Shift-S',
      run: () => toggleStrikethrough(),
      preventDefault: true,
    },
    // Blockquote - Ctrl/Cmd+Shift+. (period)
    {
      key: 'Mod-Shift-.',
      run: () => toggleBlockquote(),
      preventDefault: true,
    },
    // Headings - Ctrl/Cmd+Alt+1-6
    {
      key: 'Mod-Alt-1',
      run: () => setHeadingLevel(1),
      preventDefault: true,
    },
    {
      key: 'Mod-Alt-2',
      run: () => setHeadingLevel(2),
      preventDefault: true,
    },
    {
      key: 'Mod-Alt-3',
      run: () => setHeadingLevel(3),
      preventDefault: true,
    },
    {
      key: 'Mod-Alt-4',
      run: () => setHeadingLevel(4),
      preventDefault: true,
    },
    {
      key: 'Mod-Alt-5',
      run: () => setHeadingLevel(5),
      preventDefault: true,
    },
    {
      key: 'Mod-Alt-6',
      run: () => setHeadingLevel(6),
      preventDefault: true,
    },
    // Horizontal Rule - Ctrl/Cmd+Shift+H (case-insensitive)
    {
      key: 'Mod-Shift-h',
      run: () => insertHR(),
      preventDefault: true,
    },
    {
      key: 'Mod-Shift-H',
      run: () => insertHR(),
      preventDefault: true,
    },
  ]);

  const initializeEditor = () => {
    if (!editorElement.value) {
      console.error('Editor element not found');
      return;
    }

    const startState = EditorState.create({
      doc: '',
      extensions: [
        markdown({
          codeLanguages: languages,
        }),
        customTheme,
        syntaxHighlighting(customHighlightStyle),
        EditorView.lineWrapping,
        customKeymap,
      ],
    });

    editorView = new EditorView({
      state: startState,
      parent: editorElement.value,
    });
  };

  const getContent = (): string => {
    return editorView?.state.doc.toString() || '';
  };

  const setContent = (content: string) => {
    if (!editorView) return;

    editorView.dispatch({
      changes: {
        from: 0,
        to: editorView.state.doc.length,
        insert: content,
      },
    });
  };

  const destroy = () => {
    if (editorView) {
      editorView.destroy();
      editorView = null;
    }
  };

  onMounted(() => {
    initializeEditor();
  });

  onUnmounted(() => {
    destroy();
  });

  return {
    getContent,
    setContent,
    destroy,
    // Formatting methods
    toggleBold,
    toggleItalic,
    toggleStrikethrough,
    toggleInlineCode,
    toggleBlockquote,
    setHeadingLevel,
    insertHR,
  };
}
