/**
 * MathWidget - Renders LaTeX math equations using KaTeX
 * Supports both inline ($...$) and block ($$...$$) math
 */

import { WidgetType } from '@codemirror/view'
import katex from 'katex'

/**
 * Widget for inline math equations
 * Renders LaTeX math using KaTeX
 */
export class InlineMathWidget extends WidgetType {
  constructor(readonly latex: string) {
    super()
  }

  eq(other: InlineMathWidget): boolean {
    return other.latex === this.latex
  }

  toDOM(): HTMLElement {
    const span = document.createElement('span')
    span.className = 'cm-inline-math'

    try {
      katex.render(this.latex, span, {
        throwOnError: false,
        displayMode: false,
      })
    } catch (error) {
      span.textContent = `$${this.latex}$`
      span.style.color = 'var(--color-error)'
      span.title = error instanceof Error ? error.message : 'Math rendering error'
    }

    return span
  }

  ignoreEvent(): boolean {
    return false
  }
}

/**
 * Widget for block/display math equations
 * Renders LaTeX math using KaTeX in display mode
 */
export class BlockMathWidget extends WidgetType {
  constructor(readonly latex: string) {
    super()
  }

  eq(other: BlockMathWidget): boolean {
    return other.latex === this.latex
  }

  toDOM(): HTMLElement {
    const div = document.createElement('div')
    div.className = 'cm-block-math'

    try {
      katex.render(this.latex, div, {
        throwOnError: false,
        displayMode: true,
      })
    } catch (error) {
      div.textContent = `$$${this.latex}$$`
      div.style.color = 'var(--color-error)'
      div.title = error instanceof Error ? error.message : 'Math rendering error'
    }

    return div
  }

  ignoreEvent(): boolean {
    return false
  }
}
