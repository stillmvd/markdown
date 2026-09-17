import itertools

import wave3
from wave1 import glyph_svg

COLORS = [
    ("Candied Ginger", "#bfa387", None),
    ("Ginger средний", "#957656", None),
    ("Ginger тёмный", "#816345", None),
    ("Ginger с объёмом", None, ("#cdb498", "#7a5c3f")),
]
FIELDS = [("84 %", 0.84), ("92 %", 0.92), ("100 %", 1.0)]
BASE = (0, 1)


def mark_items():
    return wave3.combo_items(1, 1, 1)


def mark_svg(cid, ci, fi, color_override=None):
    name, flat, grad = COLORS[ci]
    size = 64 * FIELDS[fi][1]
    if color_override:
        return glyph_svg(mark_items(), size, color_override, (0, 28), cid)
    if grad:
        defs = (f'<defs><linearGradient id="{cid}-g" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="28">'
                f'<stop offset="0" stop-color="{grad[0]}"/><stop offset="1" stop-color="{grad[1]}"/></linearGradient></defs>')
        return defs + glyph_svg(mark_items(), size, f"url(#{cid}-g)", (0, 28), cid)
    return glyph_svg(mark_items(), size, flat, (0, 28), cid)


def variant_svg(cid, key, in_circle):
    if key.startswith("col-"):
        return mark_svg(cid, int(key[4:]), BASE[1])
    if key.startswith("fld-"):
        return mark_svg(cid, BASE[0], int(key[4:]))
    return wave3.variant_svg(cid, key, in_circle)


NUMBER = 4
TITLE = "Волна 4 · цвет и поле"
PROMPT = ("Финал формы. Знак без подложки должен читаться на светлой и тёмной панели задач Windows — сборка сверху "
          "показывает его в заголовке окна, на панели задач и в размерах до 16 px. Выберите цвет и поле.")
CHOSEN = ["цвет Ginger с объёмом", "поле 100 %"]

CARDS = [
    ("B2′ · финал", [
        {"code": "Цвет", "name": "заливка знака", "radio": True,
         "note": ("Контраст к светлой панели #f3f3f3 и тёмной #202020: Candied Ginger 2,2 и 6,8 — на светлой бледно; "
                  "средний 3,8 и 3,9 — ровно на обеих; тёмный 5,0 и 3,0 — тонет на тёмной; объём — светлый верх, тёмный низ."),
         "tiles": [(f"цвет {name}", name, f"col-{i}", False, i == BASE[0]) for i, (name, *_) in enumerate(COLORS)]},
        {"code": "Поле", "name": "ширина знака в квадрате иконки", "radio": True,
         "note": ("Знак шире, чем выше, поэтому поле считается по ширине. 100 % — крупнее всего на панели задач, "
                  "но упирается в края; 84 % — много воздуха, знак мельчает."),
         "tiles": [(f"поле {name}", name, f"fld-{k}", False, k == BASE[1]) for k, (name, _) in enumerate(FIELDS)]},
    ]),
]

SUMMARY = ("Моё мнение: цвет — Ginger средний #957656, единственный, что держится на обеих панелях; Candied Ginger "
           "остаётся акцентом внутри приложения. Поле — 92 %: крупно, но не в край. Графит в иконке без подложки "
           "пропадает на тёмной панели — он пойдёт фоном в локапах и брендбуке.")

CSS = """
.scenes{display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr))}
.scene{border-radius:22px;overflow:hidden;display:grid;border:1px solid var(--paper-line)}
.scene.light{background:#f4f4f6;color:#17171a}
.scene.dark{background:#141416;color:#ececef;border-color:#2e2e33}
.titlebar{display:flex;align-items:center;gap:10px;padding:10px 14px;font-size:12px}
.titlebar .dots{margin-left:auto;display:flex;gap:18px;opacity:.55;letter-spacing:.1em}
.doc{margin:0 10px;height:84px;border-radius:14px 14px 0 0}
.scene.light .doc{background:#fff}
.scene.dark .doc{background:#1c1c1f}
.taskbar{display:flex;justify-content:center;align-items:center;gap:6px;height:52px}
.scene.light .taskbar{background:#f3f3f3;border-top:1px solid #e2e2e2}
.scene.dark .taskbar{background:#202020;border-top:1px solid #2c2c2c}
.tb{width:40px;height:40px;border-radius:6px;display:grid;place-items:center;position:relative}
.tb i{display:block;width:24px;height:24px;border-radius:6px}
.scene.light .tb i{background:#c9ccd1}
.scene.dark .tb i{background:#4a4a4f}
.tb.on::after{content:"";position:absolute;bottom:2px;width:16px;height:3px;border-radius:2px}
.scene.light .tb.on{background:#fdfdfd}
.scene.dark .tb.on{background:#2d2d2d}
.scene.light .tb.on::after{background:#6b6b73}
.scene.dark .tb.on::after{background:#a2a2a9}
"""


def preview():
    symbols, combos = [], []
    for ci, fi in itertools.product(range(len(COLORS)), range(len(FIELDS))):
        cid = f"w4sym-{ci}-{fi}"
        symbols.append(f'<symbol id="{cid}" viewBox="0 0 64 64">{mark_svg(cid + "-in", ci, fi)}</symbol>')

        def use(size=None, cls=""):
            attrs = (f' width="{size}" height="{size}"' if size else "") + (f' class="{cls}"' if cls else "")
            return f'<svg viewBox="0 0 64 64"{attrs} aria-hidden="true"><use href="#{cid}"/></svg>'

        sizes = "".join(f'<span class="size">{use(px)}{px}</span>' for px in (48, 32, 24, 16))
        scenes = "".join(
            f'<div class="scene {theme}"><div class="titlebar">{use(16)}<span>Заметки к релизу.md — Markdown</span>'
            f'<span class="dots">— ▢ ✕</span></div><div class="doc"></div>'
            f'<div class="taskbar"><span class="tb"><i></i></span><span class="tb"><i></i></span>'
            f'<span class="tb on">{use(24)}</span><span class="tb"><i></i></span></div></div>'
            for theme in ("light", "dark"))
        hidden = "" if (ci, fi) == BASE else " hidden"
        combos.append(f'<div class="build" data-combo="{ci}-{fi}"{hidden}><div class="build-row">'
                      f'<div class="build-tile light">{use(cls="big")}<span class="sizes">{sizes}</span></div>'
                      f'<div class="build-tile dark">{use(cls="big")}<span class="sizes">{sizes}</span></div></div>'
                      f'<div class="scenes">{scenes}</div></div>')
    sprite = f'<svg width="0" height="0" style="position:absolute" aria-hidden="true">{"".join(symbols)}</svg>'
    return f'<div class="build"><h3>Сборка</h3>{sprite}{"".join(combos)}</div>'
