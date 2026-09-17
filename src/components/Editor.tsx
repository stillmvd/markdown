import { useCallback, useRef, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { editorBasicSetup, editorExtensions, getEditorTheme, plainEditorExtensions } from "../lib/codemirror-setup";
import type { Theme } from "../types";
import ContextMenu from "./ContextMenu";
import type { EditorView } from "@codemirror/view";

interface EditorProps {
  content: string;
  onChange: (value: string) => void;
  theme: Theme;
  plain: boolean;
}

interface MenuPos {
  x: number;
  y: number;
}

export default function Editor({ content, onChange, theme, plain }: EditorProps) {
  const viewRef = useRef<EditorView | null>(null);
  const [menuPos, setMenuPos] = useState<MenuPos | null>(null);

  const closeMenu = useCallback(() => {
    setMenuPos(null);
    viewRef.current?.focus();
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    const view = viewRef.current;
    if (!view || plain) return;

    const sel = view.state.selection.main;
    if (sel.from === sel.to) return;

    e.preventDefault();
    setMenuPos({ x: e.clientX, y: e.clientY });
  }, [plain]);

  const handleFormat = useCallback((before: string, after: string) => {
    const view = viewRef.current;
    if (!view) return;

    const sel = view.state.selection.main;
    const selected = view.state.sliceDoc(sel.from, sel.to);

    view.dispatch({
      changes: {
        from: sel.from,
        to: sel.to,
        insert: before + selected + after,
      },
    });

    closeMenu();
  }, [closeMenu]);

  const handleLinePrefix = useCallback((prefix: string) => {
    const view = viewRef.current;
    if (!view) return;

    const sel = view.state.selection.main;
    const line = view.state.doc.lineAt(sel.from);
    const selected = view.state.sliceDoc(sel.from, sel.to) || line.text;

    const lines = selected.split("\n").map((l) => prefix + l).join("\n");

    view.dispatch({
      changes: {
        from: sel.from === sel.to ? line.from : sel.from,
        to: sel.from === sel.to ? line.to : sel.to,
        insert: lines,
      },
    });

    closeMenu();
  }, [closeMenu]);

  const handleCodeBlock = useCallback((lang: string) => {
    const view = viewRef.current;
    if (!view) return;

    const sel = view.state.selection.main;
    const selected = view.state.sliceDoc(sel.from, sel.to);

    view.dispatch({
      changes: {
        from: sel.from,
        to: sel.to,
        insert: "```" + lang + "\n" + selected + "\n```",
      },
    });

    closeMenu();
  }, [closeMenu]);

  return (
    <div className="min-w-0 flex-1 px-2 pb-2" onContextMenu={handleContextMenu}>
      <div className="editor-sheet relative h-full overflow-hidden rounded-[28px] bg-cosmic">
        <CodeMirror
          value={content}
          onChange={onChange}
          theme={getEditorTheme(theme)}
          extensions={plain ? plainEditorExtensions : editorExtensions}
          basicSetup={editorBasicSetup}
          height="100%"
          style={{ height: "100%" }}
          onCreateEditor={(view) => {
            viewRef.current = view;
          }}
        />

        {menuPos && (
          <ContextMenu
            x={menuPos.x}
            y={menuPos.y}
            onClose={closeMenu}
            onFormat={handleFormat}
            onLinePrefix={handleLinePrefix}
            onCodeBlock={handleCodeBlock}
          />
        )}
      </div>
    </div>
  );
}
