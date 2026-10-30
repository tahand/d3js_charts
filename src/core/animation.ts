import { easeCubicOut } from 'd3';
import type { Selection } from 'd3';
import type { AnimationOptions, ResolvedAnimation } from '../types';

const DEFAULT_DURATION = 600;

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function resolveAnimation(input: boolean | AnimationOptions | undefined): ResolvedAnimation {
  const opts: AnimationOptions = typeof input === 'object' ? input : {};
  const explicitlyOff = input === false || opts.enabled === false;
  // An explicit `enabled: true` overrides the reduced-motion preference.
  const enabled = !explicitlyOff && (opts.enabled === true || !prefersReducedMotion());
  return {
    enabled,
    duration: enabled ? (opts.duration ?? DEFAULT_DURATION) : 0,
    delay: opts.delay ?? 0,
    easing: opts.easing ?? easeCubicOut,
    stagger: opts.stagger ?? 0,
  };
}

/**
 * Returns a transition when animation is on, or the selection itself when off,
 * so drawing code can call `.attr()` / `.style()` / `.remove()` the same way in
 * both cases and the result is applied synchronously when animation is off.
 *
 * Attach event listeners to the selection *before* calling this: `.on()` on a
 * transition listens for transition events, not DOM events.
 */
export function animate<S extends Selection<any, any, any, any>>(
  selection: S,
  anim: ResolvedAnimation,
  name?: string,
): S {
  if (!anim.enabled || anim.duration <= 0) return selection;
  const t = selection
    .transition(name)
    .duration(anim.duration)
    .ease(anim.easing)
    .delay((_d: unknown, i: number) => anim.delay + i * anim.stagger);
  return t as unknown as S;
}

export function isAnimated(anim: ResolvedAnimation): boolean {
  return anim.enabled && anim.duration > 0;
}
