import { useEffect, useRef, useState } from 'react';

import { createFfmpegSource } from '../ffmpegSource/index.ts';
import type { FrameSource } from '../frameSource/index.ts';
import { computeEmbeddedRegion } from '../playerLayout/index.ts';
import { MS_PER_SECOND } from './consts.ts';
import { canDisplayVideo, createManagedScreen } from './managedScreen.ts';
import type { ManagedResources, ManagedResourcesOptions, PlayerScreen } from './types.ts';
import { VideoError } from './types.ts';

const IDLE: ManagedResources = { status: 'loading', screen: null, source: null, info: null };

/**
 * Owns the Screen and FrameSource lifecycle for self-managed Video mode.
 * Creates both on mount (or when src/srcObject change), disposes and closes
 * them on cleanup. The Screen is constructed only after the source opens, so
 * its region can letterbox the real source dimensions into the prop box.
 */
export const useManagedResources = ({
  enabled,
  src,
  srcObject,
  width,
  height,
  onLoadedMetadata,
  onError,
}: ManagedResourcesOptions): ManagedResources => {
  const [resources, setResources] = useState<ManagedResources>(IDLE);

  // Callbacks and the current box size live in refs so the resource effect
  // only reruns when the source identity changes. The screen also lives in a
  // ref because the cleanup must dispose it even during unmount, when state
  // updaters no longer run.
  const callbacksRef = useRef({ onLoadedMetadata, onError });
  callbacksRef.current = { onLoadedMetadata, onError };
  const boxRef = useRef({ width, height });
  boxRef.current = { width, height };
  const screenRef = useRef<PlayerScreen | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    if (!canDisplayVideo()) {
      setResources({ status: 'unsupported', screen: null, source: null, info: null });
      return;
    }
    if ((src === undefined) === (srcObject === undefined)) {
      // Exactly one of src and srcObject must be given
      setResources({ status: 'error', screen: null, source: null, info: null });
      callbacksRef.current.onError?.(new VideoError('INVALID_SRC'));
      return;
    }
    const source: FrameSource = srcObject ?? createFfmpegSource({ filePath: src ?? '' });
    let cancelled = false;
    setResources(IDLE);
    void source
      .open()
      .then((info) => {
        if (cancelled) {
          return;
        }
        const region = computeEmbeddedRegion({
          cols: boxRef.current.width,
          rows: boxRef.current.height,
          sourceWidth: info.width,
          sourceHeight: info.height,
        });
        const screen = createManagedScreen({
          region,
          sourceWidth: info.width,
          sourceHeight: info.height,
          colorSpace: info.colorSpace,
        });
        screenRef.current = screen;
        setResources({ status: 'ready', screen, source, info });
        callbacksRef.current.onLoadedMetadata?.({
          videoWidth: info.width,
          videoHeight: info.height,
          duration: info.durationMs / MS_PER_SECOND,
        });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setResources({ status: 'error', screen: null, source: null, info: null });
          callbacksRef.current.onError?.(error);
        }
      });
    return () => {
      cancelled = true;
      screenRef.current?.dispose();
      screenRef.current = null;
      setResources(IDLE);
      void source.close().catch(() => undefined);
    };
  }, [enabled, src, srcObject]);

  return resources;
};
