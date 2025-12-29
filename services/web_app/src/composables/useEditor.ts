import { ref, type Ref } from 'vue'
import { EditorView, keymap, ViewUpdate } from '@codemirror/view'
import { EditorState, Compartment } from '@codemirror/state'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { indentUnit, foldKeymap } from '@codemirror/language'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { search, searchKeymap } from '@codemirror/search'
import { autocompletion, completionKeymap } from '@codemirror/autocomplete'
import { theme } from '@/utils/editor/theme'
import { customMarkdownKeyBindings } from '@/utils/editor/customizations'
import {
  livePreviewPlugin,
  clickableLinks,
  previewModeField,
  togglePreviewMode,
  previewModeTheme,
  previewModeExtension,
  sigilResolverFacet,
} from '@/utils/editor/livePreview'
import {
  markdownHeadingFolding,
  markdownFoldGutter,
  activeLineFoldGutter,
} from '@/utils/editor/folding'
import { createKeyboardShortcuts } from '@/utils/editor/keyboardShortcuts'
import type { SigilUrlResolver } from '@/utils/editor/widgets'

export function useEditor(
  editorElement: Ref<HTMLElement | undefined>,
  onUpdate?: (update: ViewUpdate) => void,
  sigilResolver?: SigilUrlResolver,
) {
  const editorView = ref<EditorView | null>(null)
  const isPreviewMode = ref(false)

  // Compartment for dynamically reconfiguring read-only state
  const readOnlyCompartment = new Compartment()

  const initializeEditor = () => {
    if (!editorElement.value) {
      console.error('Editor element not found')
      return
    }

    // Don't reinitialize if already initialized
    if (editorView.value) {
      console.log('Editor already initialized')
      return
    }

    const startState = EditorState.create({
      doc: '',
      extensions: [
        // Custom theme
        theme,

        // Preview mode state field and theme
        previewModeField,
        previewModeTheme,
        previewModeExtension,

        // Sigil resolver facet - provide the resolver for encrypted images
        sigilResolverFacet.of(sigilResolver || null),

        // Use tabs instead of spaces
        indentUnit.of('\t'),

        // GitHub Flavored Markdown support (CommonMark + GFM extensions)
        markdown({
          base: markdownLanguage,
        }),

        // Live preview - hide markdown syntax when not editing
        livePreviewPlugin,

        // Clickable links - Ctrl/Cmd+Click to open
        clickableLinks,

        // Folding support for headings
        markdownHeadingFolding,
        markdownFoldGutter,
        activeLineFoldGutter,

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

        // Keyboard shortcuts for formatting and markdown features
        createKeyboardShortcuts(),

        // Keymaps (order matters - more specific keymaps should come first)
        keymap.of([
          // Custom markdown key bindings (must come before default keymaps)
          // Handles Enter for list continuation, Tab/Shift-Tab for smart indentation
          ...customMarkdownKeyBindings,
          ...foldKeymap,
          ...completionKeymap,
          ...searchKeymap,
          ...historyKeymap,
          ...defaultKeymap,
        ]),

        // Read-only compartment for dynamic reconfiguration
        readOnlyCompartment.of(EditorState.readOnly.of(false)),

        // Update listener for auto-save and other update callbacks
        ...(onUpdate ? [EditorView.updateListener.of(onUpdate)] : []),
      ],
    })

    editorView.value = new EditorView({
      state: startState,
      parent: editorElement.value,
    })
  }

  const getContent = (): string => {
    return editorView.value?.state.doc.toString() || ''
  }

  const setContent = (content: string) => {
    if (!editorView.value) return

    editorView.value.dispatch({
      changes: {
        from: 0,
        to: editorView.value.state.doc.length,
        insert: content,
      },
    })
  }

  const togglePreview = () => {
    if (!editorView.value) return

    isPreviewMode.value = !isPreviewMode.value

    editorView.value.dispatch({
      effects: [
        togglePreviewMode.of(isPreviewMode.value),
        readOnlyCompartment.reconfigure(EditorState.readOnly.of(isPreviewMode.value)),
      ],
    })
  }

  const destroy = () => {
    if (editorView.value) {
      editorView.value.destroy()
      editorView.value = null
    }
  }

  return {
    editorView: editorView as Ref<EditorView | null>,
    isPreviewMode,
    getContent,
    setContent,
    togglePreview,
    destroy,
    initializeEditor,
  }
}
