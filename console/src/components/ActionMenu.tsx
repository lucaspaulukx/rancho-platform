import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal } from 'lucide-react';
import { useI18n } from '../i18n/provider';

export interface MenuAction {
  id: string;
  label: string;
  disabled?: boolean;
  reason?: string;
  danger?: boolean;
  onSelect: () => void;
}
export function ActionMenu({ label, actions }: { label: string; actions: MenuAction[] }) {
  const { direction } = useI18n();
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ left: number; top: number; maxHeight: number } | null>(
    null,
  );
  const last = useRef(false);
  const focused = useRef(false);
  function close(restore = false) {
    setOpen(false);
    if (restore) trigger.current?.focus();
  }
  useLayoutEffect(() => {
    if (!open) return;
    function place() {
      if (!trigger.current || !menu.current) return;
      const box = trigger.current.getBoundingClientRect();
      if (box.bottom < 0 || box.top > window.innerHeight) {
        setOpen(false);
        return;
      }
      const width = Math.min(264, window.innerWidth - 24);
      const below = window.innerHeight - box.bottom - 20;
      const above = box.top - 20;
      const upwards = below < Math.min(menu.current.scrollHeight, 260) && above > below;
      const maxHeight = Math.max(80, Math.min(420, upwards ? above : below));
      const height = Math.min(menu.current.scrollHeight, maxHeight);
      setPosition({
        left: Math.max(
          12,
          Math.min(
            direction === 'rtl' ? box.left : box.right - width,
            window.innerWidth - width - 12,
          ),
        ),
        top: Math.max(
          12,
          Math.min(
            upwards ? box.top - height - 6 : box.bottom + 6,
            window.innerHeight - height - 12,
          ),
        ),
        maxHeight,
      });
    }
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, actions.length, direction]);
  useLayoutEffect(() => {
    if (!open) {
      focused.current = false;
      return;
    }
    if (!position || focused.current) return;
    const items = menu.current?.querySelectorAll<HTMLButtonElement>(
      '[role="menuitem"]:not(:disabled)',
    );
    (last.current ? items?.[items.length - 1] : items?.[0])?.focus();
    focused.current = true;
  }, [open, position]);
  useEffect(() => {
    if (!open) return;
    function outside(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !menu.current?.contains(event.target) &&
        !trigger.current?.contains(event.target)
      )
        close();
    }
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="button ghost action-menu-trigger"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        disabled={!actions.length}
        onClick={() => {
          last.current = false;
          setOpen((value) => !value);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && open) {
            event.preventDefault();
            close(true);
          }
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            last.current = event.key === 'ArrowUp';
            if (open) {
              const items = menu.current?.querySelectorAll<HTMLButtonElement>(
                '[role="menuitem"]:not(:disabled)',
              );
              (last.current ? items?.[items.length - 1] : items?.[0])?.focus();
            } else setOpen(true);
          }
        }}
      >
        <MoreHorizontal size={20} />
      </button>
      {open &&
        createPortal(
          <div
            ref={menu}
            id={id}
            role="menu"
            aria-label={label}
            className="context-action-menu"
            style={{
              left: position?.left,
              top: position?.top,
              maxHeight: position?.maxHeight,
              visibility: position ? 'visible' : 'hidden',
            }}
            onBlur={(event) => {
              if (
                event.relatedTarget instanceof Node &&
                !event.currentTarget.contains(event.relatedTarget) &&
                event.relatedTarget !== trigger.current
              )
                close();
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                close(true);
                return;
              }
              if (event.key === 'Tab') {
                close(true);
                return;
              }
              const items = [
                ...event.currentTarget.querySelectorAll<HTMLButtonElement>(
                  '[role="menuitem"]:not(:disabled)',
                ),
              ];
              if (!items.length) return;
              const current = items.indexOf(document.activeElement as HTMLButtonElement);
              let next = current;
              if (event.key === 'ArrowDown') next = (current + 1) % items.length;
              else if (event.key === 'ArrowUp') next = (current - 1 + items.length) % items.length;
              else if (event.key === 'Home') next = 0;
              else if (event.key === 'End') next = items.length - 1;
              else return;
              event.preventDefault();
              items[next]?.focus();
            }}
          >
            {actions.map((action, index) => (
              <div key={action.id}>
                {action.danger && !actions[index - 1]?.danger && (
                  <div role="separator" className="context-action-separator" />
                )}
                <button
                  type="button"
                  role="menuitem"
                  tabIndex={-1}
                  disabled={action.disabled}
                  title={action.reason}
                  className={action.danger ? 'danger' : ''}
                  onClick={() => {
                    close(true);
                    action.onSelect();
                  }}
                >
                  {action.label}
                </button>
              </div>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
