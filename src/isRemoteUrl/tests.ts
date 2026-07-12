import { describe, expect, it } from 'vitest';

import { isRemoteUrl } from './index.ts';

describe('isRemoteUrl', () => {
  it('accepts http and https URLs', () => {
    expect(isRemoteUrl('http://example.com/video.mp4')).toBe(true);
    expect(isRemoteUrl('https://example.com/video.mp4')).toBe(true);
  });

  it('accepts uppercase schemes', () => {
    expect(isRemoteUrl('HTTPS://example.com/video.mp4')).toBe(true);
    expect(isRemoteUrl('Http://example.com/video.mp4')).toBe(true);
  });

  it('rejects local paths', () => {
    expect(isRemoteUrl('movie.mp4')).toBe(false);
    expect(isRemoteUrl('/home/user/movie.mp4')).toBe(false);
    expect(isRemoteUrl('./relative/movie.mp4')).toBe(false);
  });

  it('rejects other ffmpeg protocols', () => {
    expect(isRemoteUrl('rtsp://example.com/stream')).toBe(false);
    expect(isRemoteUrl('file:///home/user/movie.mp4')).toBe(false);
    expect(isRemoteUrl('concat:one.mp4|two.mp4')).toBe(false);
  });

  it('rejects paths that merely contain a scheme', () => {
    expect(isRemoteUrl('videos/http://example.com')).toBe(false);
  });
});
