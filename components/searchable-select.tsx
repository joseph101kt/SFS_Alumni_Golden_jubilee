'use client';

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';

export type SearchableOption = { value: string; label: string };

type Props = {
  options: readonly SearchableOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  emptyLabel?: string;
  'aria-label'?: string;
  className?: string;
};

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Search…',
  disabled = false,
  required = false,
  emptyLabel = 'No matches',
  'aria-label': ariaLabel,
  className = '',
}: Props) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);

  const selected = options.find((o) => o.value === value) || null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.slice(0, 80);
    return options.filter((o) => o.label.toLowerCase().includes(q)).slice(0, 80);
  }, [options, query]);

  useEffect(() => {
    if (!open) setQuery(selected?.label || '');
  }, [open, selected]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  useEffect(() => {
    setHighlight(0);
  }, [query, open]);

  function pick(opt: SearchableOption) {
    onChange(opt.value);
    setQuery(opt.label);
    setOpen(false);
    inputRef.current?.blur();
  }

  function clear() {
    onChange('');
    setQuery('');
    setOpen(true);
    inputRef.current?.focus();
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, Math.max(filtered.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (open && filtered[highlight]) pick(filtered[highlight]);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setQuery(selected?.label || '');
    }
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <div className="flex gap-1">
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-label={ariaLabel}
          autoComplete="off"
          disabled={disabled}
          required={required && !value}
          value={open ? query : selected?.label || query}
          placeholder={placeholder}
          onFocus={() => {
            setOpen(true);
            setQuery('');
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            if (value) onChange('');
          }}
          onKeyDown={onKeyDown}
          className="min-w-0 flex-1 px-4 py-3.5 rounded-lg border border-outline-variant text-body-sm bg-surface focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all disabled:opacity-50"
        />
        {value && !disabled && (
          <button
            type="button"
            aria-label="Clear selection"
            onClick={clear}
            className="shrink-0 px-3 rounded-lg border border-outline-variant text-on-surface-variant hover:bg-surface-container transition-colors"
          >
            ×
          </button>
        )}
      </div>

      {open && !disabled && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-30 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-outline-variant bg-surface-paper shadow-md"
        >
          {filtered.length === 0 ? (
            <li className="px-4 py-3 text-body-sm text-on-surface-variant">{emptyLabel}</li>
          ) : (
            filtered.map((opt, i) => (
              <li key={opt.value} role="option" aria-selected={opt.value === value}>
                <button
                  type="button"
                  className={`w-full text-left px-4 py-2.5 text-body-sm transition-colors ${
                    i === highlight || opt.value === value
                      ? 'bg-secondary-container text-on-secondary-fixed'
                      : 'hover:bg-surface-container-low text-on-surface'
                  }`}
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => pick(opt)}
                >
                  {opt.label}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
