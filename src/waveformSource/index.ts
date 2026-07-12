import { spawn } from 'node:child_process';
import type { ChildProcessByStdio } from 'node:child_process';
import type { Readable } from 'node:stream';

import ffmpegPath from 'ffmpeg-static';

import { FfmpegSourceError } from '../ffmpegSource/index.ts';
import type { FrameSource, FrameSourceInfo } from '../frameSource/index.ts';
import {
  AMPLITUDE_SCALE,
  BUFFER_MARGIN_MS,
  BYTES_PER_SAMPLE,
  MS_PER_SECOND,
  PCM_SAMPLE_RATE,
  RGB_CHANNELS,
  S16_MAX,
  TRACE_RGB,
  WAVEFORM_FPS,
  WAVEFORM_HEIGHT,
  WAVEFORM_WIDTH,
  WINDOW_MS,
} from './consts.ts';
import type { WaveformSourceOptions } from './types.ts';

export * from './consts.ts';
export * from './types.ts';

const msToSamples = (timeMs: number): number =>
  Math.floor((timeMs / MS_PER_SECOND) * PCM_SAMPLE_RATE);

/**
 * Creates a FrameSource rendering a live oscilloscope of a file's audio.
 * One ffmpeg process decodes the whole audio track to mono s16le PCM at
 * PCM_SAMPLE_RATE in a single pass into a preallocated buffer (about 57 MB
 * per hour), so seeks are free window moves and there is no respawn logic.
 * getFrameAt resolves null until the window at the playhead is decoded,
 * and isBuffering holds the player's gate until the decode is comfortably
 * ahead of the playhead. A decoder death freezes the trace at the last
 * decoded window instead of failing playback (missing samples draw as
 * silence), matching the audio pipeline's fail-to-silent philosophy.
 */
export const createWaveformSource = (options: WaveformSourceOptions): FrameSource => {
  const { filePath, durationMs } = options;
  const totalSamples = msToSamples(durationMs);
  const samples = new Int16Array(totalSamples);
  const windowSamples = msToSamples(WINDOW_MS);
  const frameBuffer = new Uint8Array(WAVEFORM_WIDTH * WAVEFORM_HEIGHT * RGB_CHANNELS);

  let decodedSamples = 0;
  let decoderExited = false;
  let closed = false;
  let lastRequestedMs = 0;
  let child: ChildProcessByStdio<null, Readable, null> | null = null;
  let pending: Buffer | null = null;

  const info: FrameSourceInfo = {
    width: WAVEFORM_WIDTH,
    height: WAVEFORM_HEIGHT,
    colorSpace: 'rgb24',
    durationMs,
    fps: WAVEFORM_FPS,
    hasAudio: true,
  };

  // Copies whole samples out of the byte stream, keeping a split trailing
  // byte for the next chunk. Samples past the duration estimate are dropped
  // (the estimate is close, and a clamped tail just freezes the last window).
  const ingest = (chunk: Buffer): void => {
    const merged = pending === null ? chunk : Buffer.concat([pending, chunk]);
    const usableBytes = merged.length - (merged.length % BYTES_PER_SAMPLE);
    const count = Math.min(usableBytes / BYTES_PER_SAMPLE, totalSamples - decodedSamples);
    for (let i = 0; i < count; i++) {
      samples[decodedSamples + i] = merged.readInt16LE(i * BYTES_PER_SAMPLE);
    }
    decodedSamples += count;
    pending = usableBytes < merged.length ? merged.subarray(usableBytes) : null;
  };

  // One column per pixel, drawing the min..max span of its sample slice
  // (the standard oscilloscope fill, so brief transients stay visible).
  // Spans are anchored at zero so silence draws a single centerline pixel.
  const renderFrame = (timeMs: number): Uint8Array => {
    frameBuffer.fill(0);
    const startSample = msToSamples(timeMs);
    const centerY = WAVEFORM_HEIGHT / 2;
    const scale = ((centerY - 1) * AMPLITUDE_SCALE) / S16_MAX;
    for (let x = 0; x < WAVEFORM_WIDTH; x++) {
      const from = startSample + Math.floor((x / WAVEFORM_WIDTH) * windowSamples);
      const to = Math.max(
        from + 1,
        startSample + Math.floor(((x + 1) / WAVEFORM_WIDTH) * windowSamples),
      );
      let min = 0;
      let max = 0;
      for (let i = from; i < to; i++) {
        const sample = i < decodedSamples ? samples[i] : 0;
        min = Math.min(min, sample);
        max = Math.max(max, sample);
      }
      const yTop = Math.round(centerY - max * scale);
      const yBottom = Math.round(centerY - min * scale);
      for (let y = yTop; y <= yBottom; y++) {
        const offset = (y * WAVEFORM_WIDTH + x) * RGB_CHANNELS;
        frameBuffer[offset] = TRACE_RGB[0];
        frameBuffer[offset + 1] = TRACE_RGB[1];
        frameBuffer[offset + 2] = TRACE_RGB[2];
      }
    }
    return frameBuffer;
  };

  const open = (): Promise<FrameSourceInfo> => {
    if (ffmpegPath === null) {
      return Promise.reject(
        new FfmpegSourceError(
          'DECODE_FAILED',
          'ffmpeg-static provides no binary for this platform',
        ),
      );
    }
    child = spawn(
      ffmpegPath,
      [
        '-hide_banner',
        '-loglevel', 'error',
        '-i', filePath,
        '-map', '0:a:0',
        '-ac', '1',
        '-ar', `${PCM_SAMPLE_RATE}`,
        '-f', 's16le',
        'pipe:1',
      ],
      { stdio: ['ignore', 'pipe', 'ignore'] },
    );
    child.stdout.on('data', ingest);
    child.on('error', () => {
      decoderExited = true;
    });
    child.on('close', () => {
      decoderExited = true;
    });
    return Promise.resolve(info);
  };

  const getFrameAt = (timeMs: number): Promise<Uint8Array | null> => {
    if (closed) {
      return Promise.resolve(null);
    }
    lastRequestedMs = timeMs;
    const windowEnd = Math.min(totalSamples, msToSamples(timeMs) + windowSamples);
    if (!decoderExited && decodedSamples < windowEnd) {
      return Promise.resolve(null);
    }
    return Promise.resolve(renderFrame(timeMs));
  };

  // Still buffering while a live decode has not reached the margin past the
  // playhead. A finished or dead decoder reads as done, so a caller waiting
  // on this (the player's buffering gate) is never stranded.
  const isBuffering = (): boolean => {
    if (closed || decoderExited) {
      return false;
    }
    const targetSamples = Math.min(totalSamples, msToSamples(lastRequestedMs + BUFFER_MARGIN_MS));
    return decodedSamples < targetSamples;
  };

  // The PCM is random access once decoded, a seek just moves the window
  const seek = (timeMs: number): Promise<void> => {
    lastRequestedMs = timeMs;
    return Promise.resolve();
  };

  const close = (): Promise<void> => {
    closed = true;
    if (child !== null) {
      child.kill('SIGKILL');
      child = null;
    }
    return Promise.resolve();
  };

  return { open, getFrameAt, isBuffering, seek, close };
};
