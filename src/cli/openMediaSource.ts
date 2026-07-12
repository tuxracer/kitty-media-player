import { createCoverArtSource } from '../coverArtSource/index.ts';
import { createFfmpegSource } from '../ffmpegSource/index.ts';
import { createWaveformSource } from '../waveformSource/index.ts';
import type { OpenMediaSourceOptions, OpenedMediaSource } from './types.ts';

/**
 * Builds and opens the FrameSource for a probed media file. Video files get
 * the ffmpeg decoder, reusing the classification so nothing is probed
 * twice. Audio files get the cover art source when the probe found an
 * attached picture, falling back to the waveform oscilloscope when the art
 * fails to decode, and the waveform directly when the file has no art.
 */
export const openMediaSource = async (
  options: OpenMediaSourceOptions,
): Promise<OpenedMediaSource> => {
  const {
    filePath,
    probe,
    createVideoSource = createFfmpegSource,
    createArtSource = createCoverArtSource,
    createWaveSource = createWaveformSource,
  } = options;
  if (probe.kind === 'video') {
    const source = createVideoSource({ filePath, probe });
    return { source, info: await source.open() };
  }
  if (probe.coverArt !== null) {
    const art = createArtSource({
      filePath,
      durationMs: probe.durationMs,
      nativeWidth: probe.coverArt.nativeWidth,
      nativeHeight: probe.coverArt.nativeHeight,
    });
    try {
      return { source: art, info: await art.open() };
    } catch {
      // Unreadable art never fails playback, the waveform takes over
      await art.close().catch(() => undefined);
    }
  }
  const wave = createWaveSource({ filePath, durationMs: probe.durationMs });
  return { source: wave, info: await wave.open() };
};
