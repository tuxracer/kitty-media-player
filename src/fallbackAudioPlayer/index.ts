import {
  AUDIO_TICK_MS,
  DRIFT_RESYNC_THRESHOLD_MS,
  KEY_ARROW_LEFT,
  KEY_ARROW_RIGHT,
  KEY_CTRL_C,
  KEY_MUTE,
  KEY_QUIT,
  KEY_SPACE,
  MS_PER_SECOND,
  SEEK_STEP_MS,
} from './consts.ts';
import type { FallbackAudioPlayerOptions } from './types.ts';

export * from './consts.ts';
export * from './types.ts';

export const runFallbackAudioPlayer = ({
  audio,
  durationMs,
  input,
  output,
  muted = false,
  label,
}: FallbackAudioPlayerOptions): Promise<void> =>
  new Promise((resolve) => {
    const initialRawMode = input.isRaw ?? false;
    const initiallyFlowing = input.readableFlowing === true;
    let playing = true;
    let elapsedMs = 0;
    let waiting = audio !== null;
    let audioMuted = muted;
    let anchorWallMs = Date.now();
    let anchorElapsedMs = 0;
    let quitting = false;
    let pendingKeyText = '';

    const startAt = (targetMs: number): void => {
      if (audio === null) {
        waiting = false;
        anchorWallMs = Date.now();
        anchorElapsedMs = targetMs;
        return;
      }
      waiting = true;
      audio.playFrom(targetMs);
    };

    const seekToMs = (targetMs: number): void => {
      elapsedMs = Math.min(Math.max(targetMs, 0), durationMs);
      if (playing) {
        startAt(elapsedMs);
      } else {
        waiting = false;
        audio?.pause();
      }
    };

    audio?.setMuted(audioMuted);
    startAt(0);
    if (label !== undefined) {
      output.write(`${label}\n`);
    }

    const interval = setInterval(() => {
      if (!playing) {
        return;
      }
      if (waiting) {
        if (audio?.isStarting() ?? false) {
          return;
        }
        waiting = false;
        anchorWallMs = Date.now();
        anchorElapsedMs = elapsedMs;
        return;
      }

      const nextMs = anchorElapsedMs + (Date.now() - anchorWallMs);
      if (nextMs < durationMs) {
        const previousSecond = Math.floor(elapsedMs / MS_PER_SECOND);
        const nextSecond = Math.floor(nextMs / MS_PER_SECOND);
        elapsedMs = nextMs;
        if (nextSecond !== previousSecond) {
          const audioPositionMs = audio?.getPositionMs() ?? null;
          if (
            audioPositionMs !== null &&
            Math.abs(audioPositionMs - nextMs) > DRIFT_RESYNC_THRESHOLD_MS
          ) {
            startAt(nextMs);
          }
        }
        return;
      }

      if (durationMs > 0) {
        elapsedMs = nextMs % durationMs;
        startAt(elapsedMs);
      }
    }, AUDIO_TICK_MS);

    const quit = (): void => {
      if (quitting) {
        return;
      }
      quitting = true;
      clearInterval(interval);
      input.off('data', onKey);
      input.setRawMode?.(initialRawMode);
      if (initiallyFlowing) {
        input.resume?.();
      } else {
        input.pause?.();
      }
      void Promise.resolve()
        .then(() => audio?.close())
        .catch(() => undefined)
        .then(resolve);
    };

    const onKey = (chunk: Buffer): void => {
      const text = pendingKeyText + chunk.toString('utf8');
      pendingKeyText = '';
      let index = 0;
      while (index < text.length) {
        if (text.startsWith(KEY_ARROW_RIGHT, index)) {
          seekToMs(elapsedMs + SEEK_STEP_MS);
          index += KEY_ARROW_RIGHT.length;
          continue;
        }
        if (text.startsWith(KEY_ARROW_LEFT, index)) {
          seekToMs(elapsedMs - SEEK_STEP_MS);
          index += KEY_ARROW_LEFT.length;
          continue;
        }

        const remainingText = text.slice(index);
        if (
          KEY_ARROW_RIGHT.startsWith(remainingText) ||
          KEY_ARROW_LEFT.startsWith(remainingText)
        ) {
          pendingKeyText = remainingText;
          return;
        }

        const key = text[index];
        if (key === KEY_QUIT || key === KEY_CTRL_C) {
          quit();
          return;
        }
        if (key === KEY_SPACE) {
          playing = !playing;
          if (playing) {
            startAt(elapsedMs);
          } else {
            waiting = false;
            audio?.pause();
          }
        }
        if (key === KEY_MUTE) {
          audioMuted = !audioMuted;
          audio?.setMuted(audioMuted);
        }
        index += 1;
      }
    };

    input.setRawMode?.(true);
    input.resume?.();
    input.on('data', onKey);
  });
