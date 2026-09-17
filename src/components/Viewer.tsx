import { useState, useMemo, useCallback, useRef, isValidElement } from "react";
import ReactMarkdown, { type Components, type ExtraProps } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import rehypeSlug from "rehype-slug";
import rehypeRaw from "rehype-raw";
import { splitByHeadings } from "../lib/markdown-utils";
import type { HeadingSection } from "../types";
import SearchBar from "./SearchBar";

interface ViewerProps {
  content: string;
  sheetRef: React.RefObject<HTMLDivElement | null>;
  plain: boolean;
  showSearch: boolean;
  onCloseSearch: () => void;
}

const REMARK_PLUGINS = [remarkGfm];
const REHYPE_PLUGINS = [rehypeHighlight, rehypeSlug, rehypeRaw];

const LANGUAGE_NAMES: Record<string, string> = {
  js: "JavaScript",
  javascript: "JavaScript",
  jsx: "JSX",
  ts: "TypeScript",
  typescript: "TypeScript",
  tsx: "TSX",
  json: "JSON",
  html: "HTML",
  xml: "XML",
  css: "CSS",
  scss: "SCSS",
  md: "Markdown",
  markdown: "Markdown",
  rs: "Rust",
  rust: "Rust",
  py: "Python",
  python: "Python",
  go: "Go",
  java: "Java",
  kotlin: "Kotlin",
  swift: "Swift",
  c: "C",
  cpp: "C++",
  cs: "C#",
  csharp: "C#",
  php: "PHP",
  ruby: "Ruby",
  sql: "SQL",
  sh: "Shell",
  bash: "Bash",
  shell: "Shell",
  powershell: "PowerShell",
  ps1: "PowerShell",
  yaml: "YAML",
  yml: "YAML",
  toml: "TOML",
  dockerfile: "Dockerfile",
  graphql: "GraphQL",
  lua: "Lua",
  dart: "Dart",
};

const CHEVRON = (
  <svg viewBox="0 0 16 16" aria-hidden="true">
    <path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CHECK = (
  <svg viewBox="0 0 16 16" aria-hidden="true">
    <path d="M3.5 8.5l3 3 6-6.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const COPY = (
  <svg className="h-4 w-4" viewBox="0 0 16 16" aria-hidden="true">
    <g fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round">
      <rect x="5.25" y="5.25" width="8" height="8" rx="2" />
      <path d="M10.75 5.25V4a1.25 1.25 0 0 0-1.25-1.25H4A1.25 1.25 0 0 0 2.75 4v5.5A1.25 1.25 0 0 0 4 10.75h1.25" />
    </g>
  </svg>
);

function CodeBlock({ node, children, ...props }: React.ComponentProps<"pre"> & ExtraProps) {
  const preRef = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);
  const codeClass = isValidElement<{ className?: string }>(children) ? children.props.className ?? "" : "";
  const languageId = codeClass.match(/language-([\w+#-]+)/)?.[1]?.toLowerCase();
  const language = languageId ? LANGUAGE_NAMES[languageId] ?? languageId : "";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(preRef.current?.innerText ?? "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      console.error("Failed to copy code:", e);
    }
  };

  return (
    <div className="codeblock">
      <div className="codeblock-head">
        <span className="codeblock-lang">{language}</span>
        <button
          type="button"
          className="codeblock-copy"
          onClick={handleCopy}
          title={copied ? "Скопировано" : "Копировать"}
          aria-label={copied ? "Скопировано" : "Копировать код"}
        >
          {copied ? <span className="h-4 w-4">{CHECK}</span> : COPY}
        </button>
      </div>
      <pre ref={preRef} {...props}>{children}</pre>
    </div>
  );
}

const COMPONENTS: Components = {
  pre: CodeBlock,
  table: ({ node, ...props }) => (
    <div className="table-wrap">
      <table {...props} />
    </div>
  ),
  input: ({ node, type, checked, ...props }) =>
    type === "checkbox" ? (
      <span className={`task-box${checked ? " is-done" : ""}`} role="img" aria-label={checked ? "Выполнено" : "Не выполнено"}>
        {CHECK}
      </span>
    ) : (
      <input type={type} checked={checked} {...props} />
    ),
};

function Markdown({ content }: { content: string }) {
  return (
    <ReactMarkdown remarkPlugins={REMARK_PLUGINS} rehypePlugins={REHYPE_PLUGINS} components={COMPONENTS}>
      {content}
    </ReactMarkdown>
  );
}

function HeadingTag({ level, id, children }: {
  level: number;
  id: string;
  children: React.ReactNode;
}) {
  const props = { id };
  switch (level) {
    case 1: return <h1 {...props}>{children}</h1>;
    case 2: return <h2 {...props}>{children}</h2>;
    case 3: return <h3 {...props}>{children}</h3>;
    case 4: return <h4 {...props}>{children}</h4>;
    case 5: return <h5 {...props}>{children}</h5>;
    case 6: return <h6 {...props}>{children}</h6>;
    default: return <h3 {...props}>{children}</h3>;
  }
}

function HeadingTitle({ level, title }: { level: number; title: string }) {
  const space = title.indexOf(" ");
  if (level !== 1 || space < 0) return <>{title}</>;
  return (
    <>
      <span className="title-light">{title.slice(0, space)}</span>
      {title.slice(space)}
    </>
  );
}

function CollapsibleSection({ section }: { section: HeadingSection }) {
  const [collapsed, setCollapsed] = useState(false);

  if (section.level === 0) {
    return <Markdown content={section.content} />;
  }

  return (
    <section className={`doc-section level-${section.level}${collapsed ? " is-collapsed" : ""}`}>
      <div className="doc-section-head" onClick={() => setCollapsed(!collapsed)}>
        <button
          type="button"
          className="doc-fold"
          aria-expanded={!collapsed}
          aria-label={`${collapsed ? "Развернуть" : "Свернуть"} раздел «${section.title}»`}
        >
          {CHEVRON}
        </button>
        <HeadingTag level={section.level} id={section.id}>
          <HeadingTitle level={section.level} title={section.title} />
        </HeadingTag>
      </div>
      <div className="doc-section-body" hidden={collapsed}>
        <Markdown content={section.content} />
      </div>
    </section>
  );
}

export default function Viewer({ content, sheetRef, plain, showSearch, onCloseSearch }: ViewerProps) {
  const sections = useMemo(() => (plain ? [] : splitByHeadings(content)), [plain, content]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const link = target.closest("a");
    if (link) {
      const href = link.getAttribute("href");
      if (href && (href.startsWith("http://") || href.startsWith("https://"))) {
        e.preventDefault();
        import("@tauri-apps/plugin-opener").then(({ openUrl }) => {
          openUrl(href);
        });
      }
    }
  }, []);

  return (
    <div className="min-w-0 flex-1 px-2 pb-2" onClick={handleClick}>
      <div className="flex h-full flex-col overflow-hidden rounded-[28px] bg-cosmic">
        <div ref={sheetRef} className="doc-sheet min-h-0 flex-1 overflow-y-auto">
          {plain ? (
            <article className="markdown-body whitespace-pre-wrap break-words">{content}</article>
          ) : (
            <article className="markdown-body">
              {sections.map((section, i) => (
                <CollapsibleSection key={`${section.id}-${i}`} section={section} />
              ))}
            </article>
          )}
        </div>
        {showSearch && <SearchBar sheetRef={sheetRef} content={content} onClose={onCloseSearch} />}
      </div>
    </div>
  );
}
