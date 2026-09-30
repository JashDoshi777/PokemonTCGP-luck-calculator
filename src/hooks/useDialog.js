import { useEffect, useRef } from 'react';

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]';

// Dialogs currently open, oldest first. Only the top one reacts to the keyboard,
// so pressing Escape with a dialog stacked on another closes just the top one.
const openDialogs = [];

const tabbable = (root) =>
  [...root.querySelectorAll(FOCUSABLE)].filter(el => el.tabIndex >= 0 && el.getClientRects().length > 0);

// Makes a modal behave like a real dialog: Escape closes it, Tab stays inside it,
// focus moves in when it opens and returns to where it was when it closes.
// Attach the returned ref to the dialog element (give it role="dialog" and aria-modal="true").
// Mark the element that should receive focus first with data-autofocus; otherwise
// the first focusable control is used.
export function useDialog(onClose) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);

  useEffect(() => { closeRef.current = onClose; }, [onClose]);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    const previouslyFocused = document.activeElement;
    openDialogs.push(node);

    const target = node.querySelector('[data-autofocus]') || tabbable(node)[0] || node;
    if (!node.hasAttribute('tabindex')) node.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });

    const onKeyDown = (event) => {
      if (openDialogs[openDialogs.length - 1] !== node) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        closeRef.current?.();
        return;
      }
      if (event.key !== 'Tab') return;

      const items = tabbable(node);
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === node)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      const index = openDialogs.indexOf(node);
      if (index !== -1) openDialogs.splice(index, 1);
      if (previouslyFocused instanceof HTMLElement && document.contains(previouslyFocused)) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, []);

  return ref;
}
