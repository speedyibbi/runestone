/**
 * Utility Widgets - Simple widgets for various markdown elements
 * Includes HorizontalRule, ReferenceDefinition, and Bullet widgets
 */

import { WidgetType } from '@codemirror/view'

/**
 * Widget for horizontal rules
 * Replaces the markdown syntax with a visual line
 */
export class HorizontalRuleWidget extends WidgetType {
  toDOM(): HTMLElement {
    const hr = document.createElement('div')
    hr.className = 'cm-hr-widget'
    return hr
  }

  ignoreEvent(): boolean {
    return false
  }
}

/**
 * Widget for reference definitions
 * Hides reference definition lines like [ref]: url
 */
export class ReferenceDefinitionWidget extends WidgetType {
  toDOM(): HTMLElement {
    const placeholder = document.createElement('span')
    placeholder.className = 'cm-reference-definition'
    placeholder.textContent = '🔗'
    placeholder.title = 'Link reference (hidden in preview)'
    return placeholder
  }

  ignoreEvent(): boolean {
    return false
  }
}

/**
 * Widget for regular bullet list items
 * Replaces - , *, + with a bullet character
 */
export class BulletWidget extends WidgetType {
  eq(other: BulletWidget): boolean {
    return true // All bullet widgets are the same
  }

  toDOM(): HTMLElement {
    const span = document.createElement('span')
    span.className = 'cm-bullet'
    span.textContent = '• '
    span.style.color = 'var(--color-muted)'
    span.style.userSelect = 'none'
    span.style.marginRight = '0.5rem'
    return span
  }

  ignoreEvent(): boolean {
    return false
  }
}
