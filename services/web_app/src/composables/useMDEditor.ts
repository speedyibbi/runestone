import { onMounted, onUnmounted, type Ref } from 'vue';
import { EditorView } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { markdown } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';

export function useMDEditor(editorElement: Ref<HTMLElement | undefined>) {
  let editorView: EditorView | null = null;

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
