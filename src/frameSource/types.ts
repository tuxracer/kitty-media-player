import type { ColorSpace } from 'kitty-motion';

export interface FrameSourceInfo {
  /** Source framebuffer width in pixels */
  width: number;
  /** Source framebuffer height in pixels */
  height: number;
  /** Pixel format of buffers returned by getFrameAt (rgb24 in v1) */
  colorSpace: ColorSpace;
  /** Total duration in ms */
  durationMs: number;
  /** Native frame rate, drives the playback tick interval */
  fps: number;
}

export interface FrameSource {
  /** Opens the source and returns stream info. Must be called before any frame access. */
  open(): Promise<FrameSourceInfo>;
  /**
   * Resolves the frame at or nearest after timeMs, or null when no frame is
   * available yet (the player keeps showing the last frame). The returned
   * buffer is only valid until the next call (sources may reuse it).
   */
  getFrameAt(timeMs: number): Promise<Uint8Array | null>;
  /** Repositions the source so getFrameAt near timeMs is cheap. No-op for random-access sources. */
  seek(timeMs: number): Promise<void>;
  /** Releases decoder resources. Idempotent. */
  close(): Promise<void>;
}
