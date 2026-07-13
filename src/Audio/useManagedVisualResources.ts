import { useCallback, useEffect, useRef, useState } from 'react';

import { openAudioVisual } from '../audioVisual/index.ts';
import type { FrameSource } from '../frameSource/index.ts';
import { computeEmbeddedRegion } from '../playerLayout/index.ts';
import { canDisplayVideo, createManagedScreen } from '../Video/managedScreen.ts';
import type { PlayerScreen } from '../Video/index.tsx';
import { INITIAL_MANAGED_AUDIO_VISUAL_RESOURCES } from './consts.ts';
import type {
  ManagedAudioVisualResources,
  ManagedAudioVisualResourcesOptions,
} from './types.ts';

interface OwnedVisualResources {
  source: FrameSource;
  screen: PlayerScreen | null;
  released: boolean;
}

const releaseVisualResources = (owned: OwnedVisualResources): void => {
  if (owned.released) {
    return;
  }
  owned.released = true;
  owned.screen?.dispose();
  void owned.source.close().catch(() => undefined);
};

export const useManagedVisualResources = ({
  enabled,
  src,
  probe,
  mode,
  width,
  height,
}: ManagedAudioVisualResourcesOptions): ManagedAudioVisualResources => {
  const [resources, setResources] = useState<ManagedAudioVisualResources>(
    INITIAL_MANAGED_AUDIO_VISUAL_RESOURCES,
  );
  const sizeRef = useRef({ width, height });
  sizeRef.current = { width, height };
  const ownedRef = useRef<OwnedVisualResources | null>(null);
  const labelRef = useRef<string | null>(null);

  const degradeToPlaceholder = useCallback((): void => {
    const owned = ownedRef.current;
    if (owned !== null) {
      releaseVisualResources(owned);
      ownedRef.current = null;
    }
    setResources({
      status: 'placeholder',
      label: labelRef.current,
      source: null,
      info: null,
      screen: null,
      placeholderRows: [],
      degradeToPlaceholder,
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    let owned: OwnedVisualResources | null = null;

    if (!enabled || mode === 'none') {
      labelRef.current = null;
      setResources({
        status: 'none',
        label: null,
        source: null,
        info: null,
        screen: null,
        placeholderRows: [],
        degradeToPlaceholder,
      });
      return;
    }
    if (probe === null) {
      setResources({ ...INITIAL_MANAGED_AUDIO_VISUAL_RESOURCES, degradeToPlaceholder });
      return;
    }

    setResources({ ...INITIAL_MANAGED_AUDIO_VISUAL_RESOURCES, degradeToPlaceholder });
    void openAudioVisual({ filePath: src, probe, mode }).then((selection) => {
      if (cancelled) {
        if (selection.kind === 'source') {
          void selection.source.close().catch(() => undefined);
        }
        return;
      }
      if (selection.kind === 'none') {
        labelRef.current = null;
        setResources({
          status: 'none',
          label: null,
          source: null,
          info: null,
          screen: null,
          placeholderRows: [],
          degradeToPlaceholder,
        });
        return;
      }
      labelRef.current = selection.label;
      if (selection.kind === 'placeholder') {
        setResources({
          status: 'placeholder',
          label: selection.label,
          source: null,
          info: null,
          screen: null,
          placeholderRows: [],
          degradeToPlaceholder,
        });
        return;
      }

      owned = { source: selection.source, screen: null, released: false };
      if (!canDisplayVideo()) {
        releaseVisualResources(owned);
        setResources({
          status: 'placeholder',
          label: selection.label,
          source: null,
          info: null,
          screen: null,
          placeholderRows: [],
          degradeToPlaceholder,
        });
        return;
      }
      const region = computeEmbeddedRegion({
        cols: sizeRef.current.width,
        rows: sizeRef.current.height,
        sourceWidth: selection.info.width,
        sourceHeight: selection.info.height,
      });
      const screen = createManagedScreen({
        region,
        sourceWidth: selection.info.width,
        sourceHeight: selection.info.height,
        colorSpace: selection.info.colorSpace,
      });
      owned.screen = screen;
      ownedRef.current = owned;
      setResources({
        status: 'ready',
        label: selection.label,
        source: selection.source,
        info: selection.info,
        screen,
        placeholderRows: screen.getPlaceholderRows(),
        degradeToPlaceholder,
      });
    });

    return () => {
      cancelled = true;
      if (owned !== null) {
        releaseVisualResources(owned);
      }
      if (ownedRef.current === owned) {
        ownedRef.current = null;
      }
    };
  }, [degradeToPlaceholder, enabled, mode, probe, src]);

  useEffect(() => {
    if (resources.screen === null || resources.info === null) {
      return;
    }
    const screen = resources.screen;
    screen.setRegion(
      computeEmbeddedRegion({
        cols: width,
        rows: height,
        sourceWidth: resources.info.width,
        sourceHeight: resources.info.height,
      }),
    );
    const placeholderRows = screen.getPlaceholderRows();
    setResources((current) =>
      current.screen === screen ? { ...current, placeholderRows } : current,
    );
  }, [height, resources.info, resources.screen, width]);

  return resources;
};
