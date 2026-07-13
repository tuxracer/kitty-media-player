import { useCallback, useEffect, useRef, useState } from 'react';

import { MS_PER_SECOND } from './consts.ts';
import type { AudioVisualRenderer, AudioVisualRendererOptions } from './types.ts';

export const useAudioVisualRenderer = ({
  source,
  info,
  screen,
  playing,
  getElapsedMs,
  onReady,
  onVisualError,
}: AudioVisualRendererOptions): AudioVisualRenderer => {
  const [ready, setReady] = useState(false);
  const timelineRef = useRef(0);
  const requestRef = useRef<() => void>(() => undefined);
  const callbacksRef = useRef({ getElapsedMs, onReady, onVisualError });
  callbacksRef.current = { getElapsedMs, onReady, onVisualError };

  useEffect(() => {
    timelineRef.current += 1;
    const timeline = timelineRef.current;
    let inFlight = false;
    let stopped = false;
    let sourceReady = false;
    setReady(false);

    if (source === null || info === null || screen === null) {
      requestRef.current = () => undefined;
      return;
    }

    const requestFrame = (): void => {
      if (stopped || inFlight || !screen.isWritable()) {
        return;
      }
      inFlight = true;
      void source
        .getFrameAt(callbacksRef.current.getElapsedMs())
        .then((frame) => {
          if (stopped || timelineRef.current !== timeline) {
            return;
          }
          if (frame !== null) {
            screen.pushFrame(frame);
          }
          if (frame !== null && !sourceReady && !(source.isBuffering?.() ?? false)) {
            sourceReady = true;
            setReady(true);
            callbacksRef.current.onReady();
          }
        })
        .catch((error: unknown) => {
          if (stopped || timelineRef.current !== timeline) {
            return;
          }
          stopped = true;
          callbacksRef.current.onVisualError(error);
        })
        .finally(() => {
          inFlight = false;
        });
    };
    requestRef.current = requestFrame;
    requestFrame();

    return () => {
      stopped = true;
      if (requestRef.current === requestFrame) {
        requestRef.current = () => undefined;
      }
    };
  }, [info, screen, source]);

  useEffect(() => {
    if (!playing || info === null) {
      return;
    }
    const interval = setInterval(() => requestRef.current(), Math.round(MS_PER_SECOND / info.fps));
    return () => clearInterval(interval);
  }, [info, playing]);

  const repaint = useCallback((): void => requestRef.current(), []);

  return { ready, repaint };
};
