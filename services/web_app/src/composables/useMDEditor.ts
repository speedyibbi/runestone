import { onMounted, onUnmounted, type Ref } from 'vue';
import { EditorView } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { syntaxHighlighting, HighlightStyle } from '@codemirror/language';
import { tags } from '@lezer/highlight';

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
  };
}
