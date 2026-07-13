import { closeMediaPlayback, resolvePlaybackRoute } from './resolveMediaPlayback.ts';
import type {
  CliPlaybackScreen,
  CliPlaybackExecutionResult,
  RunCliPlaybackOptions,
} from './types.ts';

export const runCliPlayback = async <Screen extends CliPlaybackScreen>(
  options: RunCliPlaybackOptions<Screen>,
): Promise<CliPlaybackExecutionResult> => {
  let playback;
  try {
    playback = await options.openPlayback();
  } catch (error) {
    await options.closeOpeningResources();
    options.dependencies.reportError(error);
    return 'exit-error';
  } finally {
    options.onOpeningSettled?.();
  }

  let route;
  try {
    route = await resolvePlaybackRoute({
      playback,
      fallback: options.fallback,
      renderMode: options.renderMode,
      detectReasons: options.dependencies.detectReasons,
      resolveFallbackMode: options.dependencies.resolveFallbackMode,
    });
  } catch (error) {
    options.dependencies.reportError(error);
    return 'exit-error';
  }

  let screen = null;
  try {
    if (route.kind === 'visual' && route.reasons.length > 0) {
      const accepted = await options.dependencies.confirmFallback(route);
      if (!accepted) {
        await closeMediaPlayback(playback);
        return 'exit-ok';
      }
    }

    if (playback.kind === 'audio-only') {
      if (route.kind === 'audio-only' && route.fallback) {
        await options.dependencies.runAudioFallback(playback);
        return 'exit-ok';
      }
      options.dependencies.renderAudio(playback);
      return 'rendered';
    }

    if (route.kind === 'visual' && route.fallbackMode !== undefined) {
      if (route.fallbackMode === 'kitty') {
        await options.dependencies.prepareKittyFallback();
      }
      screen = options.dependencies.createFallbackScreen(playback, route.fallbackMode);
      await options.dependencies.runVisualFallback(playback, screen);
      return 'exit-ok';
    }

    screen = await options.dependencies.createVisualScreen(
      playback,
      route.kind === 'visual' && route.forceKitty,
    );
    options.dependencies.renderVisual(playback, screen);
    screen = null;
    return 'rendered';
  } catch (error) {
    try {
      screen?.dispose();
    } catch {
      // Cleanup continues so decoders are not stranded by a Screen failure.
    }
    await closeMediaPlayback(playback);
    options.dependencies.reportError(error);
    return 'exit-error';
  }
};
