import type { AudioPlayer } from '../audioPlayer/index.ts';

export interface FallbackKeyInput {
  on(event: 'data', listener: (chunk: Buffer) => void): unknown;
  off(event: 'data', listener: (chunk: Buffer) => void): unknown;
  setRawMode?(mode: boolean): unknown;
  resume?(): void;
  pause?(): void;
}

export interface FallbackAudioPlayerOptions {
  audio: AudioPlayer | null;
  durationMs: number;
  input: FallbackKeyInput;
  output: Pick<NodeJS.WritableStream, 'write'>;
  muted?: boolean;
  label?: string;
}
