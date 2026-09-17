import { useEffect, useRef, useState } from "react";
import { CODE_LANGUAGES } from "../lib/markdown-utils";
import Icon from "./Icon";

interface CodeLanguagePickerProps {
  onSelect: (lang: string) => void;
  onBack: () => void;
}

export default function CodeLanguagePicker({ onSelect, onBack }: CodeLanguagePickerProps) {
  const [filter, setFilter] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    listRef.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const filtered = CODE_LANGUAGES.filter((lang) =>
    lang.toLowerCase().includes(filter.toLowerCase()),
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((index) => Math.max(0, Math.min(index + step, filtered.length - 1)));
    } else if (e.key === "Enter" && filtered[active]) {
      e.preventDefault();
      onSelect(filtered[active]);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onBack}
          title="Назад"
          aria-label="Назад"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-dim
            transition duration-200 ease-trail hover:bg-hover-strong hover:text-fg active:scale-[.96]
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Icon name="chevron" className="h-4 w-4 rotate-180" />
        </button>
        <input
          ref={inputRef}
          type="text"
          value={filter}
          onChange={(e) => {
            setFilter(e.target.value);
            setActive(0);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Язык"
          aria-label="Язык блока кода"
          role="combobox"
          aria-expanded="true"
          aria-controls="code-languages"
          aria-activedescendant={filtered[active] ? `code-language-${filtered[active]}` : undefined}
          className="h-9 min-w-0 flex-1 rounded-full bg-raised px-3.5 text-sm text-fg outline-none
            placeholder:text-dim focus-visible:ring-2 focus-visible:ring-accent"
        />
      </div>
      <div ref={listRef} id="code-languages" role="listbox" className="flex max-h-[250px] flex-col gap-0.5 overflow-y-auto">
        {filtered.map((lang, index) => (
          <button
            key={lang}
            id={`code-language-${lang}`}
            type="button"
            role="option"
            aria-selected={index === active}
            tabIndex={-1}
            onMouseMove={() => setActive(index)}
            onClick={() => onSelect(lang)}
            className={`flex h-8 shrink-0 items-center rounded-full px-3 text-left text-sm text-fg ${
              index === active ? "bg-hover-strong" : ""
            }`}
          >
            {lang}
          </button>
        ))}
        {filtered.length === 0 && <p className="px-3 pb-2.5 pt-2 text-[13px] text-dim">Не найдено</p>}
      </div>
    </div>
  );
}
