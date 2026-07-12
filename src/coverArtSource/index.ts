import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import ffmpegPath from 'ffmpeg-static';

import { FfmpegSourceError, computeDecodeSize } from '../ffmpegSource/index.ts';
import type { FrameSource, FrameSourceInfo } from '../frameSource/index.ts';
import { COVER_ART_FPS, RGB_CHANNELS } from './consts.ts';
import type { CoverArtSourceOptions } from './types.ts';

export * from './consts.ts';
export * from './types.ts';

const execFileAsync = promisify(execFile);

/**
 * Creates a FrameSource showing an audio file's embedded cover art as a
 * static image. One ffmpeg run at open() decodes the attached picture to a
 * single rgb24 frame, scaled within the decode caps. getFrameAt always
 * returns that frame, because the player's buffering gate retries
 * getFrameAt at the playhead on startup, seeks, loop wraps, replays,
 * resumes, and drift resyncs, and a source that goes quiet after its first
 * delivery would strand the gate. Identical pushes are cheap (kitty-motion
 * diffs them away) and COVER_ART_FPS keeps the tick rate low. open()
 * rejects with DECODE_FAILED when the art cannot be decoded, and the cli
 * falls back to the waveform source.
 */
export const createCoverArtSource = (options: CoverArtSourceOptions): FrameSource => {
  const { filePath, durationMs, nativeWidth, nativeHeight } = options;
  const { width, height } = computeDecodeSize(nativeWidth, nativeHeight);
  const frameBytes = width * height * RGB_CHANNELS;

  let frame: Uint8Array | null = null;
  let closed = false;

  const info: FrameSourceInfo = {
    width,
    height,
    colorSpace: 'rgb24',
    durationMs,
    fps: COVER_ART_FPS,
    hasAudio: true,
  };

  const open = async (): Promise<FrameSourceInfo> => {
    if (ffmpegPath === null) {
      throw new FfmpegSourceError(
        'DECODE_FAILED',
        'ffmpeg-static provides no binary for this platform',
      );
    }
    let stdout: Buffer;
    try {
      ({ stdout } = await execFileAsync(
        ffmpegPath,
        [
          '-hide_banner',
          '-loglevel', 'error',
          '-i', filePath,
          '-map', '0:v:0',
          '-frames:v', '1',
          '-vf', `scale=${width}:${height}`,
          '-f', 'rawvideo',
          '-pix_fmt', 'rgb24',
          'pipe:1',
        ],
        { encoding: 'buffer', maxBuffer: frameBytes },
      ));
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      throw new FfmpegSourceError(
        'DECODE_FAILED',
        `${filePath}: could not decode the embedded cover art (${detail})`,
      );
    }
    if (stdout.length !== frameBytes) {
      throw new FfmpegSourceError(
        'DECODE_FAILED',
        `${filePath}: cover art decode produced ${stdout.length} bytes, expected ${frameBytes}`,
      );
    }
    frame = new Uint8Array(stdout);
    return info;
  };

  return {
    open,
    getFrameAt: () => Promise.resolve(closed ? null : frame),
    seek: () => Promise.resolve(),
    close: () => {
      closed = true;
      return Promise.resolve();
    },
  };
};
