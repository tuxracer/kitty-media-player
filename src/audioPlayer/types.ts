export interface AudioPlayerInfo {
  /** False when the file has no audio stream or no output device exists, every other call is then a no-op */
  hasAudio: boolean;
}

export interface AudioPlayer {
  /** Probes the file and opens the audio device. Must be called before any other method. */
  open(): Promise<AudioPlayerInfo>;
  /**
   * Starts (or restarts) audible playback from timeMs. Covers play,
   * seek-while-playing, loop-around, and drift resync. The clock holds
   * its buffering gate through the spin-up (isStarting), so starting
   * exactly at timeMs is correct even when the first sound takes seconds.
   */
  playFrom(timeMs: number): void;
  /** Stops audible output. Covers pause, seek-while-paused, and ended. */
  pause(): void;
  /** Silences output without stopping the decode or position tracking */
  setMuted(muted: boolean): void;
  /**
   * True while the latest playFrom is still spinning up: the decode
   * attempt is alive but no sound has played yet. False when idle, once
   * sound plays, or when the attempt died without producing any. The
   * clock's buffering gate holds playback while this is true, so picture
   * and sound start together, and a dead attempt releases the gate
   * instead of stalling it.
   */
  isStarting(): boolean;
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
