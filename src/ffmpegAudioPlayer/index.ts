import ffmpegPath from 'ffmpeg-static';

import type { AudioPlayer, AudioPlayerInfo } from '../audioPlayer/index.ts';
import {
  AUDIO_QUEUE_CAP_MS,
  AUDIO_UNAVAILABLE_MESSAGE,
  CHANNELS,
  DEVICE_FRAME_SIZE,
  MS_PER_SECOND,
  SAMPLE_RATE,
  VOLUME_FULL,
  VOLUME_MUTED,
} from './consts.ts';
import { probeHasAudio } from './probe.ts';
import { createRtAudioDevice } from './rtAudioDevice.ts';
import type { AudioDecoder, AudioDevice, FfmpegAudioPlayerOptions } from './types.ts';

export * from './consts.ts';
export * from './types.ts';
export { probeHasAudio } from './probe.ts';
export { createRtAudioDevice } from './rtAudioDevice.ts';

/**
 * Creates an AudioPlayer decoding a file's audio track with the bundled
 * ffmpeg into an audify (RtAudio) output stream. One ffmpeg process per
 * playFrom decodes s16le PCM from an input-side -ss offset, mirroring the
 * video decoder's respawn-on-seek pattern. pause kills the decoder and
 * clears the device queue, so resume is always a fresh playFrom at the
 * playhead and sync is exact after every transition. Audio problems never
 * reject: open resolves hasAudio false (with a one-time notice when a
 * device exists to complain about) and the player plays silent video.
 */
export const createFfmpegAudioPlayer = (options: FfmpegAudioPlayerOptions): AudioPlayer => {
  const { filePath, createDevice = createRtAudioDevice } = options;

  let device: AudioDevice | null = null;
  let decoder: AudioDecoder | null = null;
  let closed = false;
  let muted = false;

  // Feed accounting. framesWritten minus framesPlayed is the queued backlog,
  // which drives ffmpeg stdout backpressure. framesPlayed drives the audible
  // position. Both reset on every playFrom and pause.
  let framesWritten = 0;
  let framesPlayed = 0;

  const frameDurationMs = (activeDevice: AudioDevice): number =>
    (activeDevice.frameSize / SAMPLE_RATE) * MS_PER_SECOND;

  const queueCapFrames = (activeDevice: AudioDevice): number =>
    Math.ceil(AUDIO_QUEUE_CAP_MS / frameDurationMs(activeDevice));

  const onFrameDone = (): void => {
    framesPlayed += 1;
    if (
      device !== null &&
      decoder !== null &&
      !decoder.killed &&
      framesWritten - framesPlayed < queueCapFrames(device)
    ) {
      decoder.child.stdout.resume();
    }
  };

  const killDecoder = (): void => {
    if (decoder !== null) {
      decoder.killed = true;
      decoder.child.kill('SIGKILL');
      decoder = null;
    }
  };

  const open = async (): Promise<AudioPlayerInfo> => {
    const hasStream = await probeHasAudio(filePath);
    if (!hasStream || ffmpegPath === null || closed) {
      return { hasAudio: false };
    }
    device = await createDevice({
      sampleRate: SAMPLE_RATE,
      channels: CHANNELS,
      frameSize: DEVICE_FRAME_SIZE,
      onFrameDone,
    });
    if (device === null) {
      process.stderr.write(`${AUDIO_UNAVAILABLE_MESSAGE}\n`);
      return { hasAudio: false };
    }
    device.setVolume(muted ? VOLUME_MUTED : VOLUME_FULL);
    return { hasAudio: true };
  };

  // Task 6 replaces this stub with the decode feed. A no-arg arrow is
  // assignable to the contract's (timeMs: number) => void and keeps the
  // unused-parameter lint quiet until then.
  const playFrom = (): void => undefined;

  const pause = (): void => {
    if (closed || device === null) {
      return;
    }
    killDecoder();
    device.clearQueue();
    framesWritten = 0;
    framesPlayed = 0;
  };

  const setMuted = (nextMuted: boolean): void => {
    muted = nextMuted;
    if (!closed && device !== null) {
      device.setVolume(muted ? VOLUME_MUTED : VOLUME_FULL);
    }
  };

  const getPositionMs = (): number | null => {
    if (closed || device === null || decoder === null) {
      return null;
    }
    return decoder.startMs + framesPlayed * frameDurationMs(device);
  };

  const close = (): Promise<void> => {
    if (closed) {
      return Promise.resolve();
    }
    closed = true;
    killDecoder();
    device?.close();
    device = null;
    return Promise.resolve();
  };

  return { open, playFrom, pause, setMuted, getPositionMs, close };
};
