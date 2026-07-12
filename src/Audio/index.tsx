import { ProgressBar, Spinner } from '@inkjs/ui';
import { Box, Text, useApp, useInput } from 'ink';
import type { ReactElement } from 'react';
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';

import { formatTime } from '../formatTime/index.ts';
import {
  BUFFERING_TEXT,
  LOADING_DELAY_MS,
  LOADING_TEXT,
  MIN_PROGRESS_BAR_WIDTH,
  MS_PER_SECOND,
  PAUSE_GLYPH,
  PERCENT_MAX,
  PLAY_GLYPH,
  PROGRESS_BAR_WIDTH,
  SEEK_STEP_MS,
} from './consts.ts';
import type { AudioProps, AudioRef } from './types.ts';
import { useAudioPlaybackClock } from './useAudioPlaybackClock.ts';
import { useManagedResources } from './useManagedResources.ts';

export * from './consts.ts';
export * from './types.ts';
export { useAudioPlaybackClock } from './useAudioPlaybackClock.ts';
export { useManagedResources } from './useManagedResources.ts';

export const Audio = forwardRef<AudioRef, AudioProps>((props, ref): ReactElement | null => {
  const {
    autoPlay = false,
    loop = false,
    muted: initialMuted = false,
    controls = true,
    keyboard = false,
    width,
    height = 1,
    children,
    onTimeUpdate,
    onLoadedMetadata,
    onPlay,
    onPause,
    onEnded,
    onError,
  } = props;
  const managed = useManagedResources({ src: props.src, onLoadedMetadata, onError });
  const [muted, setMuted] = useState(initialMuted);
  const clock = useAudioPlaybackClock({
    audio: managed.audio,
    durationMs: managed.durationMs,
    autoPlay,
    loop,
    onTimeUpdate,
    onPlay,
    onPause,
    onEnded,
    onError,
  });

  useEffect(() => managed.audio?.setMuted(muted), [managed.audio, muted]);

  useImperativeHandle(
    ref,
    () => ({
      play: (): Promise<void> => {
        clock.play();
        return Promise.resolve();
      },
      pause: clock.pause,
      get currentTime(): number {
        return clock.getElapsedMs() / MS_PER_SECOND;
      },
      set currentTime(seconds: number) {
        clock.seekToMs(seconds * MS_PER_SECOND);
      },
      get paused(): boolean {
        return !clock.playing;
      },
      get ended(): boolean {
        return clock.ended;
      },
      get muted(): boolean {
        return muted;
      },
      set muted(value: boolean) {
        setMuted(value);
      },
      get duration(): number {
        return managed.durationMs === null ? Number.NaN : managed.durationMs / MS_PER_SECOND;
      },
    }),
    [clock, managed.durationMs, muted],
  );

  const { exit } = useApp();
  useInput(
    (input, key) => {
      if (input === 'q' || (key.ctrl && input === 'c')) {
        void managed.audio?.close().catch(() => undefined);
        exit();
        return;
      }
      if (input === ' ') {
        clock.togglePlay();
        return;
      }
      if (input === 'm') {
        setMuted((value) => !value);
        return;
      }
      if (key.leftArrow) {
        clock.seekToMs(clock.getElapsedMs() - SEEK_STEP_MS);
        return;
      }
      if (key.rightArrow) {
        clock.seekToMs(clock.getElapsedMs() + SEEK_STEP_MS);
      }
    },
    { isActive: keyboard && managed.status === 'ready' },
  );

  const [showLoading, setShowLoading] = useState(false);
  useEffect(() => {
    if (!controls || managed.status !== 'loading') {
      setShowLoading(false);
      return;
    }
    const timer = setTimeout(() => setShowLoading(true), LOADING_DELAY_MS);
    return () => clearTimeout(timer);
  }, [controls, managed.status]);

  const [showBuffering, setShowBuffering] = useState(false);
  useEffect(() => {
    if (!controls || !clock.buffering) {
      setShowBuffering(false);
      return;
    }
    const timer = setTimeout(() => setShowBuffering(true), LOADING_DELAY_MS);
    return () => clearTimeout(timer);
  }, [clock.buffering, controls]);

  if (managed.status === 'error') {
    return <>{children}</>;
  }
  if (!controls) {
    return null;
  }
  if (managed.status === 'loading') {
    return (
      <Box width={width} height={height} justifyContent="center" alignItems="center">
        {showLoading ? <Spinner label={LOADING_TEXT} /> : null}
      </Box>
    );
  }

  const durationMs = managed.durationMs ?? 0;
  const progressPercent =
    durationMs > 0
      ? Math.min(Math.max(Math.round((clock.elapsedMs / durationMs) * PERCENT_MAX), 0), PERCENT_MAX)
      : 0;
  const timeText = `${formatTime(clock.elapsedMs)} / ${formatTime(durationMs)}`;
  const fixedWidth = PLAY_GLYPH.length + 1 + 1 + timeText.length;
  const progressWidth =
    width === undefined ? PROGRESS_BAR_WIDTH : Math.max(width - fixedWidth, MIN_PROGRESS_BAR_WIDTH);
  const effectiveWidth = width === undefined ? undefined : fixedWidth + progressWidth;

  return (
    <Box height={height} flexDirection="column" justifyContent="center">
      <Box>
        <Box width={effectiveWidth}>
          <Text>{clock.playing ? PLAY_GLYPH : PAUSE_GLYPH} </Text>
          <Box width={progressWidth}>
            <ProgressBar value={progressPercent} />
          </Box>
          <Text> {timeText}</Text>
        </Box>
        {showBuffering ? (
          <Box marginLeft={1}>
            <Spinner label={BUFFERING_TEXT} />
          </Box>
        ) : null}
      </Box>
    </Box>
  );
});

Audio.displayName = 'Audio';
