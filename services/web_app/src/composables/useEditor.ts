import { onMounted, onUnmounted, type Ref } from 'vue';
import { EditorView, keymap } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { indentUnit } from '@codemirror/language';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { search, searchKeymap } from '@codemirror/search';
import { autocompletion, completionKeymap } from '@codemirror/autocomplete';
import { editorTheme } from '@/utils/editor/editorTheme';
import { customListKeyBindings } from '@/utils/editor/editorCustomizations';

export function useEditor(editorElement: Ref<HTMLElement | undefined>) {
  let editorView: EditorView | null = null;

  const initializeEditor = () => {
    if (!editorElement.value) {
      console.error('Editor element not found');
      return;
    }

    const startState = EditorState.create({
      doc: '# Welcome to Runestone\n\nStart writing your markdown here...\n\n---\n## Features\n\n- **Bold text**\n- *Italic text*\n- ***Bold and italic text***\n- ~~Strikethrough text~~\n- `Code snippets`\n\n```javascript\nconst example = "code block";\n```\n\n> Blockquote example\n\n## Tables\n\n| Column 1 | Column 2 | Column 3 |\n|-----------|-----------|-----------|\n| Row 1, Col 1 | Row 1, Col 2 | Row 1, Col 3 |\n| Row 2, Col 1 | Row 2, Col 2 | Row 2, Col 3 |\n',
      extensions: [
        // Custom theme
        editorTheme,
        
        // Use tabs instead of spaces
        indentUnit.of("\t"),
        
        // GitHub Flavored Markdown support (includes strikethrough, tables, task lists, etc.)
        markdown({
          base: markdownLanguage,
          codeLanguages: [],
        }),
        
        // Line wrapping
        EditorView.lineWrapping,
        
        // History (undo/redo)
        history(),
        
        // Search
        search({
          top: true,
        }),
        
        // Autocompletion
        autocompletion(),
        
        // Keymaps (order matters - more specific keymaps should come first)
        keymap.of([
          // Custom key bindings (must come before default keymaps)
          ...customListKeyBindings,
          ...completionKeymap,
          ...searchKeymap,
          ...historyKeymap,
          ...defaultKeymap,
        ]),
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
