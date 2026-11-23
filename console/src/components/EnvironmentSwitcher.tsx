import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, ChevronDown, Layers3, Search } from 'lucide-react';
import type { Project } from '../api';
import { useI18n } from '../i18n/provider';

const searchable = (value: string, locale: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase(locale);
export function EnvironmentSwitcher({
  projects,
  currentId,
  onSelect,
  manageEnabled = true,
}: {
  projects: Project[];
  currentId?: string;
  onSelect: (id: string) => void;
  manageEnabled?: boolean;
}) {
  const { t, locale } = useI18n();
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const current = projects.find((project) => project.id === currentId);
  const choices = useMemo(
    () =>
      projects
        .filter((project) => !project.removed)
        .sort((a, b) =>
          a.id === currentId
            ? -1
            : b.id === currentId
              ? 1
              : a.name.localeCompare(b.name, locale, { numeric: true }),
        )
        .filter((project) =>
          searchable(`${project.name} ${project.id}`, locale).includes(searchable(query, locale)),
        ),
    [projects, query, currentId, locale],
  );
  function close(restoreFocus = false) {
    setOpen(false);
    if (restoreFocus) trigger.current?.focus();
  }
  function show() {
    setQuery('');
    setActive(0);
    setOpen(true);
  }
  function choose(project: Project) {
    if (project.id !== currentId) onSelect(project.id);
    close(true);
  }
  useEffect(() => {
    if (!open) return;
    search.current?.focus();
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  useEffect(() => {
    if (open)
      document
        .getElementById(`${id}-option-${Math.min(active, choices.length - 1)}`)
        ?.scrollIntoView?.({ block: 'nearest' });
  }, [open, active, choices.length, id]);
  return (
    <div
      className="environment-switcher"
      ref={root}
      onBlur={(event) => {
        if (
          event.relatedTarget instanceof Node &&
          !event.currentTarget.contains(event.relatedTarget)
        )
          close();
      }}
    >
      <button
        ref={trigger}
        type="button"
        className="environment-trigger"
        disabled={!projects.length}
        aria-label={t('shell.environment.label', {
          name: current?.name || t('shell.environment.none'),
        })}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? `${id}-panel` : undefined}
        title={current?.name || t('shell.environment.none')}
        onClick={() => (open ? close() : show())}
        onKeyDown={(event) => {
          if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
            event.preventDefault();
            show();
          }
        }}
      >
        <span className="environment-trigger-icon">
          <Layers3 size={18} />
        </span>
        <span className="environment-trigger-copy">
          <span className="environment-caption">{t('shell.environment.caption')}</span>
          <strong>{current?.name || t('shell.environment.none')}</strong>
        </span>
        <ChevronDown
          size={14}
          className={open ? 'environment-chevron expanded' : 'environment-chevron'}
        />
      </button>
      {open && (
        <section
          id={`${id}-panel`}
          role="dialog"
          aria-label={t('shell.environment.select')}
          className="environment-popover"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              event.stopPropagation();
              close(true);
            }
          }}
        >
          <div className="environment-popover-heading">
            <strong>{t('shell.environment.switch')}</strong>
            <span>{t('shell.environment.availableCount', { count: projects.length })}</span>
          </div>
          <div className="environment-search">
            <Search size={16} />
            <input
              ref={search}
              role="combobox"
              aria-label={t('shell.environment.search')}
              aria-expanded="true"
              aria-autocomplete="list"
              aria-controls={`${id}-list`}
              aria-activedescendant={
                choices.length ? `${id}-option-${Math.min(active, choices.length - 1)}` : undefined
              }
              placeholder={t('shell.environment.placeholder')}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
              }}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                  event.preventDefault();
                  setActive((index) =>
                    choices.length
                      ? (index + (event.key === 'ArrowDown' ? 1 : -1) + choices.length) %
                        choices.length
                      : 0,
                  );
                }
                if (event.key === 'Enter') {
                  event.preventDefault();
                  const choice = choices[Math.min(active, choices.length - 1)];
                  if (choice) choose(choice);
                }
              }}
            />
          </div>
          <div
            className="environment-options"
            id={`${id}-list`}
            role="listbox"
            aria-label={t('shell.environment.available')}
          >
            {choices.map((project, index) => (
              <button
                type="button"
                role="option"
                aria-selected={project.id === currentId}
                tabIndex={-1}
                id={`${id}-option-${index}`}
                key={project.id}
                className={`environment-option ${index === active ? 'highlighted' : ''} ${project.id === currentId ? 'selected' : ''}`}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(project)}
              >
                <span
                  className={`environment-status ${project.state === 'active' ? 'active' : ''}`}
                  aria-hidden="true"
                />
                <span className="environment-option-copy">
                  <strong>{project.name}</strong>
                  <small>
                    {project.orchestration || 'Cattle'} ·{' '}
                    {project.state === 'active'
                      ? t('shell.environment.active')
                      : project.state === 'inactive'
                        ? t('shell.environment.inactive')
                        : project.state}
                  </small>
                </span>
                {project.id === currentId && (
                  <Check size={17} aria-label={t('shell.environment.current')} />
                )}
              </button>
            ))}
          </div>
          {!choices.length && (
            <p className="environment-search-empty" role="status">
              {t('shell.environment.empty')}
            </p>
          )}
          <div className="environment-popover-footer">
            {manageEnabled ? (
              <Link to="/environments" onClick={() => close()}>
                {t('shell.environment.manage')} <ArrowRight size={13} />
              </Link>
            ) : (
              <span>{t('shell.environment.authorized')}</span>
            )}
            <kbd>Esc</kbd>
          </div>
        </section>
      )}
    </div>
  );
}
