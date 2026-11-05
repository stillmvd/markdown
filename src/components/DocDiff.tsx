import { useMemo } from "react";
import { parseDocPatch, splitRows, type DocFile, type DocHunk, type DocLine } from "../lib/docDiff";

const MINUS = "−";

function Row({ line }: { line: DocLine | null }) {
  if (!line) return <div className="dd-row is-fill" />;
  const kind = line.kind === "+" ? " is-add" : line.kind === "-" ? " is-del" : "";
  return (
    <div className={`dd-row${kind}`}>
      <span className="dd-sign" aria-hidden="true">{line.kind === " " ? "" : line.kind === "-" ? MINUS : "+"}</span>
      <span className="dd-text" dangerouslySetInnerHTML={{ __html: line.html }} />
    </div>
  );
}

function HunkHead({ hunk }: { hunk: DocHunk }) {
  return (
    <div className="dd-hunk">
      <span aria-hidden="true">⋯</span>
      {hunk.ctx && <span dangerouslySetInnerHTML={{ __html: hunk.ctx }} />}
    </div>
  );
}

function Hunk({ hunk, split, head }: { hunk: DocHunk; split: boolean; head: boolean }) {
  if (!split) {
    return (
      <>
        {head && <HunkHead hunk={hunk} />}
        <div className="dd-scroll">
          <div className="dd-rows">
            {hunk.lines.map((line, i) => <Row key={i} line={line} />)}
          </div>
        </div>
      </>
    );
  }
  const rows = splitRows(hunk.lines);
  return (
    <>
      {head && <HunkHead hunk={hunk} />}
      <div className="dd-split">
        {[0, 1].map((side) => (
          <div key={side} className="dd-scroll">
            <div className="dd-rows">
              {rows.map((row, i) => <Row key={i} line={row[side]} />)}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function FileBar({ file }: { file: DocFile }) {
  const path = file.path ?? "";
  const cut = path.lastIndexOf("/") + 1;
  return (
    <div className="dd-stick">
      <div className="dd-bar">
        <span className="dd-path" title={path}>
          <span className="dd-dir">{path.slice(0, cut)}</span>
          <b>{path.slice(cut)}</b>
        </span>
        <span className="dd-count">+{file.add} {MINUS}{file.del}</span>
      </div>
    </div>
  );
}

export default function DocDiff({ raw, split }: { raw: string; split: boolean }) {
  const files = useMemo(() => parseDocPatch(raw), [raw]);
  return (
    <div className="dd">
      {files.map((file, i) => (
        <section key={i} className="dd-file">
          {file.path && <FileBar file={file} />}
          {file.hunks.map((hunk, j) => (
            <Hunk key={j} hunk={hunk} split={split} head={j > 0 || !!hunk.ctx} />
          ))}
        </section>
      ))}
    </div>
  );
}
