/**
 * Options for configuring a FlowManager instance.
 */
export interface FlowManagerOptions {
  /**
   * Timeout in milliseconds for each task (default: 30000 ms)
   */
  timeout?: number;
  /**
   * Enable debug logging.
   */
  debug?: boolean;
}
