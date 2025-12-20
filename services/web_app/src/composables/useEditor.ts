import { onMounted, onUnmounted, ref, type Ref } from 'vue'
import { EditorView, keymap } from '@codemirror/view'
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
} from '@/utils/editor/livePreview'
import {
  markdownHeadingFolding,
  markdownFoldGutter,
  activeLineFoldGutter,
} from '@/utils/editor/folding'
import { createKeyboardShortcuts } from '@/utils/editor/keyboardShortcuts'

export function useEditor(editorElement: Ref<HTMLElement | undefined>) {
  const editorView = ref<EditorView | null>(null)
  const isPreviewMode = ref(false)

  // Compartment for dynamically reconfiguring read-only state
  const readOnlyCompartment = new Compartment()

  const initializeEditor = () => {
    if (!editorElement.value) {
      console.error('Editor element not found')
      return
    }

    const startState = EditorState.create({
      doc: '# Welcome to Runestone\n\nA markdown editor that fully complies with the [Markdown Guide](https://www.markdownguide.org/basic-syntax/) specification.\n\n---\n\n## Headings\n\n# Heading 1\n## Heading 2\n### Heading 3\n#### Heading 4\n##### Heading 5\n###### Heading 6\n\n---\n\n## Emphasis\n\n**Bold text** with double asterisks or __double underscores__\n\n*Italic text* with single asterisk or _single underscore_\n\n***Bold and italic*** together\n\n~~Strikethrough~~ with double tildes (GFM extension)\n\n---\n\n## Lists\n\n### Ordered Lists\n\n1. First item\n2. Second item\n3. Third item\n\t1. Nested item (press Tab on numbered list)\n\t2. Another nested item\n4. Fourth item\n\n### Unordered Lists\n\n- Item with dash\n- Another item\n\t- Nested item\n\t- Another nested\n- Back to main level\n\n### Task Lists (GFM)\n\n- [ ] Unchecked task\n- [x] Checked task\n- [ ] Another task\n\n---\n\n## Code\n\nInline `code` with backticks.\n\nCode block with triple backticks:\n\n```javascript\nconst greeting = "Hello, World!";\nconsole.log(greeting);\n```\n\n---\n\n## Blockquotes\n\n> This is a blockquote.\n> It can span multiple lines.\n>\n> And include multiple paragraphs.\n\n---\n\n## Links\n\n[Inline link](https://example.com "Optional title")\n\n[Reference-style link][ref]\n\n[ref]: https://example.com\n\nAutolink: https://example.com\n\n---\n\n## Images\n\n![Alt text](https://images.alphacoders.com/113/thumb-1920-1130469.png "Pixel Art")\n\n---\n\n## Tables (GFM)\n\n| Syntax | Description | Notes |\n|--------|-------------|-------|\n| Header | Title | Here |\n| List | Paragraph | Text |\n\n---\n\n## Math Equations\n\nInline math: $E = mc^2$\n\nBlock math:\n\n$$\n\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}\n$$\n\n---\n\n## Horizontal Rules\n\nThree or more hyphens:\n\n---\n\nOr asterisks:\n\n***\n\nOr underscores:\n\n___\n\n---\n\n## Try These Features\n\n1. Press **Enter** in a list to continue it automatically\n2. Press **Tab** on a numbered list to indent (resets to 1.)\n3. Press **Shift+Tab** to outdent (smart numbering)\n4. Press **Enter** on an empty list item to exit the list\n5. Press **Enter** in a blockquote to continue it\n\nHappy writing! 📝\n',
      extensions: [
        // Custom theme
        theme,

        // Preview mode state field and theme
        previewModeField,
        previewModeTheme,
        previewModeExtension,

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

  onMounted(() => {
    initializeEditor()
  })

  onUnmounted(() => {
    destroy()
  })

  return {
    editorView: editorView as Ref<EditorView | null>,
    isPreviewMode,
    getContent,
    setContent,
    togglePreview,
    destroy,
  }
}
