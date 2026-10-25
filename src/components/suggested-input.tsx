"use client";
import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";

export function SuggestedInput({
  label,
  value,
  onChange,
  suggestions,
  numeric = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  numeric?: boolean;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  function choose(value: string) {
    onChange(value);
    setOpen(false);
  }
  return (
    <div
      className="suggested-field"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
    >
      <label htmlFor={id}>{label}</label>
      <div className="suggested-control">
        <input
          id={id}
          role="combobox"
          autoComplete="off"
          inputMode={numeric ? "numeric" : "text"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-expanded={open}
          aria-controls={id + "-options"}
          aria-autocomplete="list"
          aria-activedescendant={open ? `${id}-option-${active}` : undefined}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              setOpen(true);
              setActive(
                open
                  ? (active +
                      (e.key === "ArrowDown" ? 1 : suggestions.length - 1)) %
                      suggestions.length
                  : 0,
              );
            } else if (e.key === "Enter" && open) {
              e.preventDefault();
              choose(suggestions[active]);
            } else if (e.key === "Escape") {
              e.preventDefault();
              setOpen(false);
            }
          }}
        />
        <button
          type="button"
          aria-label={label + " — " + (numeric ? "presets" : "examples")}
          aria-expanded={open}
          aria-controls={id + "-options"}
          onClick={() => {
            document.getElementById(id)?.focus();
            setOpen(!open);
            setActive(0);
          }}
        >
          <ChevronDown size={18} />
        </button>
      </div>
      {open && (
        <ul
          id={id + "-options"}
          role="listbox"
          aria-label={label}
          className="time-suggestions"
        >
          {suggestions.map((suggestion, i) => (
            <li
              key={suggestion}
              role="option"
              id={`${id}-option-${i}`}
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(suggestion)}
            >
              {suggestion}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
