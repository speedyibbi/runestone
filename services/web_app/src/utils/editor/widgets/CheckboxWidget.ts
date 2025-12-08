/**
 * CheckboxWidget - Interactive checkboxes for task lists
 * Renders [ ] and [x] as clickable checkboxes that toggle state
 */

import { WidgetType, EditorView } from '@codemirror/view'

export class CheckboxWidget extends WidgetType {
  constructor(
    readonly checked: boolean,
    readonly pos: number
  ) {
    super()
  }
  
  eq(other: CheckboxWidget): boolean {
    return other.checked === this.checked && other.pos === this.pos
  }
  
  toDOM(view: EditorView): HTMLElement {
    const wrapper = document.createElement('span')
    wrapper.className = 'cm-checkbox-wrapper'
    wrapper.style.display = 'inline-block'
    
    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    checkbox.checked = this.checked
    checkbox.className = 'cm-task-checkbox'
    
    // Add inline styling to ensure visibility
    checkbox.style.width = '16px'
        checkbox.style.height = '16px'
        checkbox.style.margin = '0 0.5rem 0 0'
        checkbox.style.cursor = 'pointer'
        checkbox.style.verticalAlign = 'middle'
        checkbox.style.appearance = 'auto'
        
        // Handle checkbox toggle on mousedown (before the checkbox toggles)
        checkbox.addEventListener('mousedown', (e) => {
        e.preventDefault()
        e.stopPropagation()
        
        // Toggle the checkbox state manually
        const newChecked = !this.checked
        const newValue = newChecked ? '[x]' : '[ ]'
        
        // Update the document - this will rebuild decorations with new state
        view.dispatch({
            changes: {
            from: this.pos,
            to: this.pos + 3,
            insert: newValue,
            },
        })
        })
        
        wrapper.appendChild(checkbox)
        return wrapper
    }
    
    ignoreEvent(): boolean {
        // Let the widget handle all events
        return false
    }
}
