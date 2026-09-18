import pathlib
import sys

import wave4

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / "logo"))
import generate as g

COLORS = [
    ("Ginger · сейчас", "#cdb498", "#7a5c3f"),
    ("Лимон", "#ffff1e", "#ffb224"),
    ("Мандарин", "#ffc233", "#ff5a1f"),
    ("Закат", "#ffd23f", "#ff3d6e"),
    ("Грейпфрут", "#ff8a65", "#f0284a"),
    ("Малина", "#ff6fb5", "#e0147a"),
    ("Виноград", "#b98cff", "#6a2cf0"),
    ("Электрик", "#5cc8ff", "#2f55ff"),
    ("Мята", "#6bffd0", "#00b37e"),
    ("Лайм", "#e6ff3f", "#3dcb3a"),
]
BASE = 2
PANELS = (("светлой", "#f3f3f3"), ("тёмной", "#202020"))

SHAPES = {}


def shape(small):
    if small not in SHAPES:
        SHAPES[small] = g.outline(**g.SMALL) if small else g.outline()
    return SHAPES[small]


def mark_svg(cid, ci, small=False):
    _, top, bottom = COLORS[ci]
    return g.mark_body(shape(small), 64 * g.FIELD, "gradient", gid=f"{cid}-g", top=top, bottom=bottom)


def variant_svg(cid, key, in_circle):
    return mark_svg(cid, int(key[4:]), cid.endswith(("-32", "-24", "-16")))


def luminance(color):
    channels = [int(color[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    r, gr, b = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in channels]
    return 0.2126 * r + 0.7152 * gr + 0.0722 * b


def contrast(a, b):
    la, lb = sorted((luminance(a), luminance(b)), reverse=True)
    return (la + 0.05) / (lb + 0.05)


def contrast_note():
    rows = []
    for name, top, bottom in COLORS:
        light = min(contrast(c, PANELS[0][1]) for c in (top, bottom))
        dark = min(contrast(c, PANELS[1][1]) for c in (top, bottom))
        rows.append(f"{name} {light:.1f} / {dark:.1f}".replace(".", ","))
    return "Худший контраст к светлой / тёмной панели задач: " + "; ".join(rows) + "."


NUMBER = 5
TITLE = "Волна 5 · сочный цвет"
PROMPT = ("Форма остаётся, меняется только цвет. Объём тот же: светлый верх, насыщенный низ. Сверху сборка "
          "выбранного варианта — размеры, заголовок окна, панели задач и заставка при запуске. "
          "Акцент внутри приложения пойдёт от того же цвета.")
CHOSEN = ["цвет Мандарин"]

CARDS = [
    ("B2′ · цвет", [
        {"code": "Цвет", "name": "заливка знака", "radio": True, "note": contrast_note(),
         "tiles": [(f"цвет {name}", f"{name} {top} → {bottom}", f"col-{i}", False, i == BASE)
                   for i, (name, top, bottom) in enumerate(COLORS)]},
    ]),
]

SUMMARY = ("Моё мнение: Мандарин или Закат — сочно, тепло, родня Trail, но не его копия, и держатся на обеих "
           "панелях. Лимон и Лайм — самые яркие, но на светлой панели задач почти исчезают: Trail спасает "
           "жёлтый круг-подложка, а у Markdown знак без подложки.")

CSS = wave4.CSS + """
.splash{border-radius:22px;background:#141416;border:1px solid #2e2e33;height:220px;display:grid;place-items:center}
.splash svg{width:96px;height:96px;animation:splash-in .45s cubic-bezier(.2,.8,.2,1) both,
  splash-pulse 1.6s ease-in-out .45s infinite}
@keyframes splash-in{from{opacity:0;transform:scale(.92)}}
@keyframes splash-pulse{50%{opacity:.72;transform:scale(.96)}}
@media (prefers-reduced-motion:reduce){.splash svg{animation:none}}
"""


def preview():
    symbols, combos = [], []
    for ci in range(len(COLORS)):
        for small in (False, True):
            cid = f"w5sym-{ci}{'-s' if small else ''}"
            symbols.append(f'<symbol id="{cid}" viewBox="0 0 64 64">{mark_svg(cid + "-in", ci, small)}</symbol>')

        def use(size=None, cls=""):
            ref = f"w5sym-{ci}-s" if size and size <= 32 else f"w5sym-{ci}"
            attrs = (f' width="{size}" height="{size}"' if size else "") + (f' class="{cls}"' if cls else "")
            return f'<svg viewBox="0 0 64 64"{attrs} aria-hidden="true"><use href="#{ref}"/></svg>'

        sizes = "".join(f'<span class="size">{use(px)}{px}</span>' for px in (48, 32, 24, 16))
        scenes = "".join(
            f'<div class="scene {theme}"><div class="titlebar">{use(16)}<span>Заметки к релизу.md — Markdown</span>'
            f'<span class="dots">— ▢ ✕</span></div><div class="doc"></div>'
            f'<div class="taskbar"><span class="tb"><i></i></span><span class="tb"><i></i></span>'
            f'<span class="tb on">{use(24)}</span><span class="tb"><i></i></span></div></div>'
            for theme in ("light", "dark"))
        hidden = "" if ci == BASE else " hidden"
        combos.append(f'<div class="build" data-combo="{ci}"{hidden}><div class="build-row">'
                      f'<div class="build-tile light">{use(cls="big")}<span class="sizes">{sizes}</span></div>'
                      f'<div class="build-tile dark">{use(cls="big")}<span class="sizes">{sizes}</span></div></div>'
                      f'<div class="scenes">{scenes}<div class="splash">{use()}</div></div></div>')
    sprite = f'<svg width="0" height="0" style="position:absolute" aria-hidden="true">{"".join(symbols)}</svg>'
    return f'<div class="build"><h3>Сборка</h3>{sprite}{"".join(combos)}</div>'
