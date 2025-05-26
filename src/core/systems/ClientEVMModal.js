import { System } from './System'
import { EventEmitter } from 'events'

export class ClientEVMModal extends System {
  constructor(world) {
    super(world)
    this.visible = false
    this.events = new EventEmitter()
  }

  show() {
    if (this.visible) return
    this.visible = true
    this.events.emit('change', true)
  }

  hide() {
    if (!this.visible) return
    this.visible = false
    this.events.emit('change', false)
  }

  toggle() {
    if (this.visible) {
      this.hide()
    } else {
      this.show()
    }
  }

  destroy() {
    this.events.removeAllListeners()
  }
} 