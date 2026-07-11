import { describe, expect, it } from 'vitest';

import { FfmpegSourceError, isFfmpegSourceError, computeDecodeSize } from './index.ts';

describe('FfmpegSourceError', () => {
  it('is identified by the isFfmpegSourceError guard', () => {
    const error = new FfmpegSourceError('FILE_NOT_FOUND', 'missing.mp4: no such file');
    expect(isFfmpegSourceError(error)).toBe(true);
    expect(error.code).toBe('FILE_NOT_FOUND');
    expect(error.message).toBe('missing.mp4: no such file');
    expect(error.name).toBe('FfmpegSourceError');
  });

  it('rejects plain errors and non-errors', () => {
    expect(isFfmpegSourceError(new Error('FILE_NOT_FOUND'))).toBe(false);
    expect(isFfmpegSourceError('FILE_NOT_FOUND')).toBe(false);
    expect(isFfmpegSourceError(null)).toBe(false);
  });
});

describe('computeDecodeSize', () => {
  it('downscales 1920x1080 to the 960x540 cap', () => {
    expect(computeDecodeSize(1920, 1080)).toEqual({ width: 960, height: 540 });
  });

  it('keeps sources already under the cap at native size', () => {
    expect(computeDecodeSize(640, 360)).toEqual({ width: 640, height: 360 });
  });

  it('never upscales small sources', () => {
    expect(computeDecodeSize(64, 36)).toEqual({ width: 64, height: 36 });
  });

  it('fits tall sources by height and preserves the aspect ratio', () => {
    // scale = 540/1920, width 1080 * scale = 303.75, rounded to even
    expect(computeDecodeSize(1080, 1920)).toEqual({ width: 304, height: 540 });
  });

  it('rounds fitted dimensions to even numbers', () => {
    // scale = 960/963, height 541 * scale = 539.3, rounded to even
    expect(computeDecodeSize(963, 541)).toEqual({ width: 960, height: 540 });
  });
});
