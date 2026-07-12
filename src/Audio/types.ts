import type { ReactNode } from 'react';

import type { AudioPlayer } from '../audioPlayer/index.ts';

export interface AudioTimeUpdateEvent {
  currentTime: number;
  duration: number;
}

export interface AudioLoadedMetadataEvent {
  duration: number;
}

export interface AudioPlaybackCallbacks {
  onTimeUpdate?: (event: AudioTimeUpdateEvent) => void;
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  onError?: (error: unknown) => void;
}

export interface AudioPlaybackClockOptions extends AudioPlaybackCallbacks {
  audio: AudioPlayer | null;
  durationMs: number | null;
  autoPlay: boolean;
  loop: boolean;
}

export interface AudioPlaybackClock {
  playing: boolean;
  elapsedMs: number;
  ended: boolean;
  buffering: boolean;
  play(): void;
  pause(): void;
  togglePlay(): void;
  seekToMs(targetMs: number): void;
  getElapsedMs(): number;
}

export interface AudioRef {
  play(): Promise<void>;
  pause(): void;
  currentTime: number;
  readonly paused: boolean;
  readonly ended: boolean;
  muted: boolean;
  readonly duration: number;
}

export interface AudioProps extends AudioPlaybackCallbacks {
  src: string;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  controls?: boolean;
  keyboard?: boolean;
  width?: number;
  height?: number;
  children?: ReactNode;
  onLoadedMetadata?: (event: AudioLoadedMetadataEvent) => void;
}
