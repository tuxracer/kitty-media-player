export interface CoverArtSourceOptions {
  /** Path or http(s) URL of the audio file carrying the attached picture */
  filePath: string;
  /** Audio duration from the media probe, in ms */
  durationMs: number;
  /** Native pixel width of the attached picture, from the media probe */
  nativeWidth: number;
  /** Native pixel height of the attached picture, from the media probe */
  nativeHeight: number;
}
