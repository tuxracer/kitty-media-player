import { REMOTE_URL_PATTERN } from './consts.ts';

export * from './consts.ts';

/**
 * True when the string is an http or https URL, the two remote protocols the
 * player accepts. Everything else (including other ffmpeg protocols like
 * rtsp or concat) is treated as a local file path.
 */
export const isRemoteUrl = (value: string): boolean => REMOTE_URL_PATTERN.test(value);
