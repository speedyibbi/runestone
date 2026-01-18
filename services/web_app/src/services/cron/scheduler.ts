import type { SchedulerOptions } from '@/interfaces/scheduler'

/**
 * SchedulerService manages recurring callbacks at specified intervals
 * Registered callbacks that will be executed repeatedly at specified intervals.
 */
export default class SchedulerService {
  private static nextId: number = 0
  private static readonly intervals: Map<string, number> = new Map()

  /**
   * Schedule a callback to run repeatedly at the specified interval
   */
  static schedule(
    callback: () => void | Promise<void>,
    intervalMs: number,
    options?: SchedulerOptions,
  ): string {
    if (intervalMs <= 0) {
      throw new Error('Interval must be greater than 0')
    }

    const id = `interval_${this.nextId++}`

    // Execute immediately on first registration if immediate option is true
    if (options?.immediate) {
      this.executeCallback(callback, id)
    }

    // Set up the interval
    const intervalId = window.setInterval(() => {
      this.executeCallback(callback, id)
    }, intervalMs)

    this.intervals.set(id, intervalId)

    return id
  }

  /**
   * Stop a scheduled task by its ID
   */
  static stop(id: string): void {
    const intervalId = this.intervals.get(id)
    if (intervalId !== undefined) {
      clearInterval(intervalId)
      this.intervals.delete(id)
    }
  }

  /**
   * Stop all scheduled tasks
   */
  static stopAll(): void {
    for (const intervalId of this.intervals.values()) {
      clearInterval(intervalId)
    }
    this.intervals.clear()
  }

  /**
   * Check if a scheduled task is currently active
   */
  static isActive(id: string): boolean {
    return this.intervals.has(id)
  }

  /**
   * Get the number of active scheduled tasks
   */
  static getActiveCount(): number {
    return this.intervals.size
  }

  /**
   * Execute a callback and handle any errors
   */
  private static async executeCallback(
    callback: () => void | Promise<void>,
    id: string,
  ): Promise<void> {
    try {
      await callback()
    } catch (error) {
      console.error(`Error in scheduled task ${id}:`, error)
    }
  }
}
