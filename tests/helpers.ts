import { fireEvent } from '@testing-library/react';

/** Fixed size and no transitions, so drawing is synchronous and deterministic. */
export const STATIC = { width: 400, height: 300, animation: false } as const;

export const q = <E extends Element = Element>(container: Element, selector: string) =>
  Array.from(container.querySelectorAll<E>(selector));

export function hover(el: Element) {
  fireEvent.pointerEnter(el, { clientX: 10, clientY: 10 });
}

export function tooltipText(container: Element) {
  return container.querySelector('.d3c-tooltip')?.textContent ?? null;
}
