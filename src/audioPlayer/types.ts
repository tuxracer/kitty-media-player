export interface AudioPlayerInfo {
  /** False when the file has no audio stream or no output device exists, every other call is then a no-op */
  hasAudio: boolean;
}

export interface AudioPlayer {
  /** Probes the file and opens the audio device. Must be called before any other method. */
  open(): Promise<AudioPlayerInfo>;
  /**
   * Starts (or restarts) audible playback from timeMs. Covers play,
   * seek-while-playing, loop-around, and drift resync. Implementations
   * with startup latency may aim past timeMs by their expected
   * time-to-first-sound so the audio lands in sync with a running clock.
   */
  playFrom(timeMs: number): void;
  /** Stops audible output. Covers pause, seek-while-paused, and ended. */
  pause(): void;
  /** Silences output without stopping the decode or position tracking */
  setMuted(muted: boolean): void;
  /**
   * Current audible position in ms (the playFrom offset plus audio actually
   * delivered to the device), or null when there is nothing audible to
   * report: not playing, drained after the track ended, or still spinning
   * up after playFrom with no sound out yet. Drives the clock's drift
   * correction, and null tells the clock to leave the player alone.
   */
  getPositionMs(): number | null;
  /** Releases the decoder and the audio device. Idempotent. */
  close(): Promise<void>;
}
