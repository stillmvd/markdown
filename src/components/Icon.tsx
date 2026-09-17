const ICONS = {
  plus: <path d="M8 3.25v9.5M3.25 8h9.5" />,
  file: (
    <>
      <path d="M4 2.25h5.25L12 5v8.75H4z" />
      <path d="M9 2.25V5.25h3" />
    </>
  ),
  folder: <path d="M2.25 4.25a1 1 0 0 1 1-1h3l1.5 1.5h5a1 1 0 0 1 1 1v6.5a1 1 0 0 1-1 1H3.25a1 1 0 0 1-1-1z" />,
  eye: (
    <>
      <path d="M1.75 8S4 3.75 8 3.75 14.25 8 14.25 8 12 12.25 8 12.25 1.75 8 1.75 8z" />
      <circle cx="8" cy="8" r="2" />
    </>
  ),
  pencil: (
    <>
      <path d="M10.25 2.75 13.25 5.75 6 13H3v-3z" />
      <path d="M8.75 4.25l3 3" />
    </>
  ),
  toc: <path d="M3 4.25h10M3 8h10M3 11.75h6" />,
  pdf: (
    <>
      <path d="M4.75 6V2.75h6.5V6" />
      <path d="M4.75 11.25h-1.5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h9.5a1 1 0 0 1 1 1v3.25a1 1 0 0 1-1 1h-1.5" />
      <path d="M4.75 9.25h6.5v4h-6.5z" />
    </>
  ),
  more: (
    <g fill="currentColor" stroke="none">
      <circle cx="3.5" cy="8" r="1.25" />
      <circle cx="8" cy="8" r="1.25" />
      <circle cx="12.5" cy="8" r="1.25" />
    </g>
  ),
  close: <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />,
  chevron: <path d="M6 3.5 10.5 8 6 12.5" />,
  search: (
    <>
      <circle cx="7" cy="7" r="4.25" />
      <path d="M10.25 10.25 13.5 13.5" />
    </>
  ),
  home: <path d="M2.75 7.25 8 2.75l5.25 4.5v5.5a1 1 0 0 1-1 1H10v-3.5H6v3.5H3.75a1 1 0 0 1-1-1z" />,
  bold: <path d="M4.75 3h3.75a2.5 2.5 0 0 1 0 5H4.75zM4.75 8h4.5a2.5 2.5 0 0 1 0 5h-4.5z" />,
  italic: <path d="M7 3h5M4 13h5M9.5 3l-3 10" />,
  strike: (
    <path d="M11.25 4.75C10.8 3.7 9.7 3 8.1 3 6.3 3 5 3.9 5 5.3c0 .9.5 1.6 1.6 2M2.75 8h10.5M10.3 9.3c.6.4.95.95.95 1.7 0 1.25-1.3 2-3.15 2-1.65 0-2.85-.65-3.35-1.7" />
  ),
  code: <path d="M5.5 4.5 2 8l3.5 3.5M10.5 4.5 14 8l-3.5 3.5" />,
  codeBlock: (
    <>
      <rect x="2.25" y="2.75" width="11.5" height="10.5" rx="2.25" />
      <path d="M6.5 6.5 5 8l1.5 1.5M9.5 6.5 11 8l-1.5 1.5" />
    </>
  ),
  heading: <path d="M3.75 3v10M11.25 3v10M3.75 8h7.5" />,
  link: (
    <path d="M6.75 9.25a2.5 2.5 0 0 0 3.54 0l2-2a2.5 2.5 0 0 0-3.54-3.54l-.5.5M9.25 6.75a2.5 2.5 0 0 0-3.54 0l-2 2a2.5 2.5 0 0 0 3.54 3.54l.5-.5" />
  ),
  quote: <path d="M3 3.5v9M6.5 5h6.5M6.5 8h6.5M6.5 11h4" />,
  list: (
    <>
      <g fill="currentColor" stroke="none">
        <circle cx="3.25" cy="4.5" r="1" />
        <circle cx="3.25" cy="8" r="1" />
        <circle cx="3.25" cy="11.5" r="1" />
      </g>
      <path d="M6.5 4.5h6.75M6.5 8h6.75M6.5 11.5h6.75" />
    </>
  ),
  numbered: (
    <path
      strokeWidth={1.25}
      d="M2.5 3.25h1v3.25M2.5 9.25c.2-.45.6-.75 1.05-.75.6 0 1.05.4 1.05.95 0 .85-2.1 1.35-2.1 2.8h2.1M7 4.5h6.25M7 8h6.25M7 11.5h6.25"
    />
  ),
};

export type IconName = keyof typeof ICONS;

export default function Icon({ name, className = "h-4 w-4" }: { name: IconName; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {ICONS[name]}
    </svg>
  );
}
