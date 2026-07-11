export interface ProceduralSourceOptions {
  /** Source framebuffer width in pixels (default 240) */
  width?: number;
  /** Source framebuffer height in pixels (default 140) */
  height?: number;
  /** Loop duration in ms. Any timeMs is valid because time wraps modulo this (default 20000). */
  durationMs?: number;
}
