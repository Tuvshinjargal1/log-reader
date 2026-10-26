# -*- coding: utf-8 -*-
"""
GS25 нөхөн дүүргэлтийн системийн танилцуулга — .pptx үүсгэгч.

Бүх тоо нь `data/demo.db`-ээс /api/board + /api/analytics-аар татагдсан БОДИТ
тооцоолол (scratchpad/board.json, analytics.json, facts.json, stores.json).
Энд ямар ч тоог гараар бичээгүй — өөрчлөх бол seed-ээ дахин ажиллуулаад
энэ скриптийг дахин ажиллуулна.
"""
import json
import os
import sys

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
from pptx.util import Emu, Inches, Pt

SP = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "..", "docs",
    "GS25-Replenishment.pptx")

board = json.load(open(os.path.join(SP, "board.json"), encoding="utf-8"))["board"]
ana = json.load(open(os.path.join(SP, "analytics.json"), encoding="utf-8"))
ana = ana.get("fleet", ana)
facts = json.load(open(os.path.join(SP, "facts.json"), encoding="utf-8"))
stores = json.load(open(os.path.join(SP, "stores.json"), encoding="utf-8"))
bt = json.load(open(os.path.join(SP, "backtest.json"), encoding="utf-8"))

T = board["totals"]
M = T["metrics"]
AV = T["autoVsManual"]
BV = T["byVerdict"]

# ── Палитр — lib/board/verdict.ts-тэй ИЖИЛ (validate_palette.js-ээр шалгасан) ──
INK = RGBColor(0x1C, 0x19, 0x17)
MUTED = RGBColor(0x78, 0x71, 0x6C)
FAINT = RGBColor(0xA8, 0xA2, 0x9E)
LINE = RGBColor(0xE7, 0xE5, 0xE4)
SURF = RGBColor(0xFA, 0xFA, 0xF9)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
TEAL = RGBColor(0x0D, 0x94, 0x88)      # AUTO_OK
TEAL_D = RGBColor(0x0F, 0x76, 0x6E)
AMBER = RGBColor(0xF5, 0x9E, 0x0B)     # TUNE
INDIGO = RGBColor(0x4F, 0x46, 0xE5)    # MANUAL
ROSE = RGBColor(0xE1, 0x1D, 0x48)      # WATCH
STONE = RGBColor(0xA8, 0xA2, 0x9E)     # DATA
NIGHT = RGBColor(0x0C, 0x0A, 0x09)

FONT = "Segoe UI"
W, H = Inches(13.333), Inches(7.5)
ML, MR = Inches(0.75), Inches(0.75)
CW = W - ML - MR  # content width

VERDICT_COLOR = {"AUTO_OK": TEAL, "TUNE": AMBER, "MANUAL": INDIGO, "WATCH": ROSE, "DATA": STONE}
VERDICT_LABEL = {
    "AUTO_OK": "Автомат хэвээр",
    "TUNE": "Тохируулга",
    "MANUAL": "Гараар",
    "WATCH": "Хянах",
    "DATA": "Дата дутуу",
}
VERDICT_GLYPH = {"AUTO_OK": "✓", "TUNE": "~", "MANUAL": "✎", "WATCH": "!", "DATA": "?"}

prs = Presentation()
prs.slide_width, prs.slide_height = W, H
BLANK = prs.slide_layouts[6]

_page = [0]


# ── Туслах функцууд ────────────────────────────────────────────────────────
def txt(slide, x, y, w, h, text, size=14, bold=False, color=INK, align=PP_ALIGN.LEFT,
        anchor=MSO_ANCHOR.TOP, spacing=1.0, italic=False):
    tb = slide.shapes.add_textbox(x, y, w, h)
    tf = tb.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    tf.vertical_anchor = anchor
    lines = text.split("\n")
    for i, ln in enumerate(lines):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.alignment = align
        p.line_spacing = spacing
        r = p.add_run()
        r.text = ln
        r.font.name = FONT
        r.font.size = Pt(size)
        r.font.bold = bold
        r.font.italic = italic
        r.font.color.rgb = color
    return tb


def rich(slide, x, y, w, h, parts, size=14, align=PP_ALIGN.LEFT, spacing=1.25,
         anchor=MSO_ANCHOR.TOP):
    """parts = [(text, {bold, color, size}), ...]  — нэг догол мөрөнд холимог хэв."""
    tb = slide.shapes.add_textbox(x, y, w, h)
    tf = tb.text_frame
    tf.word_wrap = True
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    tf.vertical_anchor = anchor
    p = tf.paragraphs[0]
    p.alignment = align
    p.line_spacing = spacing
    for t, st in parts:
        r = p.add_run()
        r.text = t
        r.font.name = FONT
        r.font.size = Pt(st.get("size", size))
        r.font.bold = st.get("bold", False)
        r.font.color.rgb = st.get("color", INK)
    return tb


def box(slide, x, y, w, h, fill=None, line=None, lw=1.0, shape=MSO_SHAPE.ROUNDED_RECTANGLE,
        radius=0.06):
    sh = slide.shapes.add_shape(shape, x, y, w, h)
    if shape == MSO_SHAPE.ROUNDED_RECTANGLE:
        try:
            sh.adjustments[0] = radius
        except Exception:
            pass
    if fill is None:
        sh.fill.background()
    else:
        sh.fill.solid()
        sh.fill.fore_color.rgb = fill
    if line is None:
        sh.line.fill.background()
    else:
        sh.line.color.rgb = line
        sh.line.width = Pt(lw)
    sh.shadow.inherit = False
    if sh.has_text_frame:
        sh.text_frame.word_wrap = True
    return sh


def slide_base(title, kicker=None, dark=False):
    s = prs.slides.add_slide(BLANK)
    if dark:
        bg = box(s, 0, 0, W, H, fill=NIGHT, shape=MSO_SHAPE.RECTANGLE)
        bg.z = 0
    y = Inches(0.52)
    if kicker:
        txt(s, ML, y, CW, Inches(0.26), kicker.upper(), size=10.5, bold=True,
            color=TEAL if not dark else TEAL)
        y = y + Inches(0.32)
    txt(s, ML, y, CW, Inches(0.62), title, size=29, bold=True,
        color=WHITE if dark else INK)
    _page[0] += 1
    txt(s, W - MR - Inches(0.7), H - Inches(0.5), Inches(0.7), Inches(0.25),
        f"{_page[0]:02d}", size=9.5, color=FAINT, align=PP_ALIGN.RIGHT)
    return s


def rule(slide, y, x=None, w=None, color=LINE, lw=1.0):
    x = ML if x is None else x
    w = CW if w is None else w
    ln = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, x, y, w, Emu(1))
    ln.fill.solid()
    ln.fill.fore_color.rgb = color
    ln.line.fill.background()
    ln.shadow.inherit = False
    return ln


def stat(slide, x, y, w, h, value, label, sub=None, color=INK, accent=None, vsize=34):
    box(slide, x, y, w, h, fill=SURF, line=LINE)
    if accent:
        box(slide, x, y, Inches(0.055), h, fill=accent, shape=MSO_SHAPE.RECTANGLE)
    px = x + Inches(0.28)
    pw = w - Inches(0.45)
    txt(slide, px, y + Inches(0.22), pw, Inches(0.55), value, size=vsize, bold=True, color=color)
    txt(slide, px, y + Inches(0.22) + Inches(0.58), pw, Inches(0.28), label,
        size=11.5, bold=True, color=INK)
    if sub:
        txt(slide, px, y + Inches(0.22) + Inches(0.86), pw, Inches(0.5), sub,
            size=9.5, color=MUTED, spacing=1.15)


def chip(slide, x, y, verdict, size=Inches(0.3)):
    c = VERDICT_COLOR[verdict]
    if verdict == "DATA":  # 5 дахь өнгө биш — хоосон чип
        sh = box(slide, x, y, size, size, fill=WHITE, line=STONE, lw=1.75)
        ink = STONE
    else:
        sh = box(slide, x, y, size, size, fill=c, line=None)
        ink = RGBColor(0x1C, 0x19, 0x17) if verdict == "TUNE" else WHITE
    tf = sh.text_frame
    tf.margin_left = tf.margin_right = tf.margin_top = tf.margin_bottom = 0
    tf.vertical_anchor = MSO_ANCHOR.MIDDLE
    p = tf.paragraphs[0]
    p.alignment = PP_ALIGN.CENTER
    r = p.add_run()
    r.text = VERDICT_GLYPH[verdict]
    r.font.name = FONT
    r.font.size = Pt(12)
    r.font.bold = True
    r.font.color.rgb = ink
    return sh


def mnt(v, digits=1):
    """₮-г уншигдахуйц нэгжид."""
    v = float(v)
    if abs(v) >= 1e9:
        return f"{v/1e9:.{digits}f} тэрбум ₮"
    if abs(v) >= 1e6:
        return f"{v/1e6:.{digits}f} сая ₮"
    return f"{v:,.0f} ₮"


def num(v):
    return f"{v:,.0f}".replace(",", " ")


# ═══════════════════════════════════════════════════════════════════════════
# 01 — Нүүр
# ═══════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK)
box(s, 0, 0, W, H, fill=NIGHT, shape=MSO_SHAPE.RECTANGLE)
box(s, 0, 0, Inches(0.14), H, fill=TEAL, shape=MSO_SHAPE.RECTANGLE)

txt(s, Inches(1.1), Inches(1.55), Inches(10), Inches(0.3),
    "SMARTPOS · НӨХӨН ДҮҮРГЭЛТИЙН ҮЙЛ АЖИЛЛАГАА", size=11.5, bold=True, color=TEAL)
txt(s, Inches(1.1), Inches(2.05), Inches(11), Inches(1.9),
    "20 дэлгүүрийн захиалгыг\nнэг оператор удирдана",
    size=44, bold=True, color=WHITE, spacing=1.08)
txt(s, Inches(1.1), Inches(4.15), Inches(9.4), Inches(1.0),
    "Автомат нөхөн дүүргэлтийн систем нь POS борлуулалтаас эрэлтийг таамаглаж,\n"
    "захиалгыг өөрөө боловсруулж, SMS-ээр илгээнэ. Оператор нь бүх захиалгыг биш,\n"
    "зөвхөн ШИЙДВЭР шаардсан цөөн тохиолдлыг хардаг.",
    size=14.5, color=RGBColor(0xD6, 0xD3, 0xD1), spacing=1.4)

rule(s, Inches(5.45), x=Inches(1.1), w=Inches(9.6), color=RGBColor(0x44, 0x40, 0x3C))

for i, (v, l) in enumerate([
    (f"{T['stores']}", "дэлгүүр"),
    (f"{num(M['items'])}", "бараа"),
    (f"{num(M['orderLines'])}", "захиалгын мөр"),
    (f"{M['historyDays']}", "хоногийн түүх"),
]):
    x = Inches(1.1) + Inches(2.42) * i
    txt(s, x, Inches(5.72), Inches(2.3), Inches(0.45), v, size=25, bold=True, color=WHITE)
    txt(s, x, Inches(6.18), Inches(2.3), Inches(0.28), l, size=11, color=FAINT)

txt(s, Inches(1.1), Inches(6.82), Inches(9), Inches(0.3),
    f"Бүх үзүүлэлт нь ажиллаж буй системийн {board['asOf'][:4]}-{board['asOf'][4:6]}-{board['asOf'][6:]} "
    "өдрийн тооцооллоос шууд авсан.", size=10, color=RGBColor(0x57, 0x53, 0x4E))

# ═══════════════════════════════════════════════════════════════════════════
# 02 — Асуудал
# ═══════════════════════════════════════════════════════════════════════════
lines_per_day = M["orderLines"] / 56.0
s = slide_base("Захиалга нь хүний хийж чадах хэмжээнээс давсан", kicker="Асуудал")

txt(s, ML, Inches(1.62), Inches(7.2), Inches(0.8),
    "Нэг оператор 20 дэлгүүрийг хариуцна. Дэлгүүр бүр өдөр бүр захиалга өгнө. "
    "Бараа бүрийн шийдвэр нь тусдаа тооцоолол шаардана.",
    size=13.5, color=MUTED, spacing=1.4)

steps = [
    (f"{T['stores']}", "дэлгүүр"),
    ("×", None),
    (f"{num(M['items'] // T['stores'])}", "бараа / дэлгүүр"),
    ("×", None),
    ("өдөр бүр", "давтагдана"),
    ("=", None),
    (f"~{num(lines_per_day)}", "шийдвэр / өдөр"),
]
x = ML
for val, lab in steps:
    if lab is None:
        txt(s, x, Inches(2.92), Inches(0.42), Inches(0.5), val, size=22, bold=True,
            color=FAINT, align=PP_ALIGN.CENTER)
        x += Inches(0.52)
        continue
    w = Inches(1.72) if val != "өдөр бүр" else Inches(1.72)
    accent = TEAL if lab == "шийдвэр / өдөр" else None
    box(s, x, Inches(2.62), w, Inches(1.18), fill=SURF, line=LINE)
    if accent:
        box(s, x, Inches(2.62), w, Inches(1.18), fill=None, line=TEAL, lw=1.75)
    txt(s, x, Inches(2.86), w, Inches(0.44), val, size=21, bold=True,
        color=TEAL if accent else INK, align=PP_ALIGN.CENTER)
    txt(s, x, Inches(3.32), w, Inches(0.28), lab, size=10.5, color=MUTED, align=PP_ALIGN.CENTER)
    x += w + Inches(0.16)

rule(s, Inches(4.28))

facts_row = [
    ("Тооцоолол бүр 5 секунд гэж үзвэл",
     f"{lines_per_day*5/60:.0f} минут", "цэвэр өдөр тутмын ажил — зөвхөн тоо гаргахад"),
    ("Бодит байдал дээр",
     "хийгддэггүй", "оператор туршлагаараа бөөнөөр нь таамаглаж захиалдаг"),
    ("Үр дүн",
     f"{M['wasteRatio']*100:.1f}% хаягдал", f"{mnt(M['wasteMnt'])} — {M['historyDays']} хоногт"),
]
for i, (k, v, sub) in enumerate(facts_row):
    x = ML + (CW / 3) * i
    txt(s, x, Inches(4.62), CW / 3 - Inches(0.3), Inches(0.26), k, size=10.5, bold=True, color=MUTED)
    txt(s, x, Inches(4.94), CW / 3 - Inches(0.3), Inches(0.5), v, size=25, bold=True,
        color=ROSE if i == 2 else INK)
    txt(s, x, Inches(5.48), CW / 3 - Inches(0.3), Inches(0.6), sub, size=10.5,
        color=MUTED, spacing=1.3)

box(s, ML, Inches(6.22), CW, Inches(0.78), fill=RGBColor(0xFF, 0xF7, 0xED), line=AMBER)
rich(s, ML + Inches(0.32), Inches(6.46), CW - Inches(0.64), Inches(0.4),
     [("Гол асуудал нь “хүн удаан” БИШ. ", {"bold": True}),
      ("Хүн 750 шийдвэрийг тэнцүү анхаарлаар харж чадахгүй — тиймээс бүгдийг "
       "ойролцоо таамаглаж, аль нь үнэхээр анхаарал шаардаж байгааг олж хардаггүй.",
       {"color": INK})], size=12)

# ═══════════════════════════════════════════════════════════════════════════
# 03 — Шийдэл / pipeline
# ═══════════════════════════════════════════════════════════════════════════
s = slide_base("POS дата → таамаглал → захиалга → SMS", kicker="Систем")
txt(s, ML, Inches(1.62), Inches(8.4), Inches(0.5),
    "Дөрвөн алхам бүрэн автоматаар ажиллана. Оператор зөвхөн 4 дэх алхмын дараа "
    "гарсан ШИЙДВЭРИЙГ хянана.", size=13.5, color=MUTED, spacing=1.35)

pipe = [
    ("01", "POS-оос татах", TEAL,
     "20 дэлгүүрийн MSSQL-ээс өдөр тутмын борлуулалт, нөөц, хаягдал, нийлүүлэлт.",
     f"{num(84468)} өдөр-бараа мөр"),
    ("02", "Эрэлтийг таамаглах", TEAL,
     "Гараг, улирал, цалингийн мөчлөг, түвшний өөрчлөлт. Нөөц дууссан өдрийг "
     "эрэлтээс хасна.", f"итгэлцэл {M['avgConfidence']*100:.0f}%"),
    ("03", "Захиалга тооцох", TEAL,
     "(R,S) загвар — нөхөх түвшин S = эрэлт × хамрах хугацаа + аюулгүйн нөөц. "
     "Захиалга = S − одоогийн нөөц.", f"{num(facts['orders']['n'])} захиалга"),
    ("04", "SMS-ээр илгээх", TEAL,
     "Захиалгын төвд хэсэгчлэн илгээж, хүргэгдсэнийг баталгаажуулна.",
     f"{num(facts['sms']['msgs'])} мессеж · {facts['sms']['delivered']*100//facts['sms']['msgs']}% хүргэгдсэн"),
]
cw = (CW - Inches(0.36) * 3) / 4
for i, (n, title_, col, body, foot) in enumerate(pipe):
    x = ML + (cw + Inches(0.36)) * i
    box(s, x, Inches(2.5), cw, Inches(2.62), fill=WHITE, line=LINE)
    box(s, x, Inches(2.5), cw, Inches(0.055), fill=col, shape=MSO_SHAPE.RECTANGLE)
    txt(s, x + Inches(0.26), Inches(2.76), Inches(0.6), Inches(0.3), n, size=11, bold=True, color=col)
    txt(s, x + Inches(0.26), Inches(3.08), cw - Inches(0.52), Inches(0.34), title_,
        size=14.5, bold=True, color=INK)
    txt(s, x + Inches(0.26), Inches(3.5), cw - Inches(0.52), Inches(1.1), body,
        size=10.5, color=MUTED, spacing=1.35)
    rule(s, Inches(4.68), x=x + Inches(0.26), w=cw - Inches(0.52))
    txt(s, x + Inches(0.26), Inches(4.8), cw - Inches(0.52), Inches(0.28), foot,
        size=10, bold=True, color=INK)
    if i < 3:
        txt(s, x + cw + Inches(0.06), Inches(3.62), Inches(0.24), Inches(0.3), "→",
            size=15, bold=True, color=FAINT, align=PP_ALIGN.CENTER)

box(s, ML, Inches(5.5), CW, Inches(1.0), fill=SURF, line=LINE)
rich(s, ML + Inches(0.32), Inches(5.72), CW - Inches(0.64), Inches(0.6),
     [("Демо дата нь зөвхөн ОРОЛТ. ", {"bold": True, "color": TEAL_D}),
      ("Дэлгүүр бүрийн өдөр тутмын борлуулалтыг симуляцаар үүсгэсэн ч, "
       "захиалгыг тооцоолж буй хөдөлгүүр нь бодит үйлдвэрлэлийн код. "
       "Тиймээс “автомат vs гараар”-ын харьцуулалт нь хоёр зохиомол тооны "
       "харьцуулалт биш, жинхэнэ алгоритмын гүйцэтгэл юм.", {"color": INK})], size=11.5,
     spacing=1.35)

# ═══════════════════════════════════════════════════════════════════════════
# 04 — Шийдвэрийн самбар
# ═══════════════════════════════════════════════════════════════════════════
s = slide_base("Оператор 20 дэлгүүр биш, 8 шийдвэр хардаг", kicker="Шийдвэрийн самбар")
txt(s, ML, Inches(1.62), Inches(8.6), Inches(0.5),
    "Систем дэлгүүр бүрийг өөрөө ангилна. Ногоон дээр оролцох шаардлагагүй — "
    "анхаарал зөвхөн үлдсэн дээр очно.", size=13.5, color=MUTED, spacing=1.35)

order = ["TUNE", "MANUAL", "DATA", "AUTO_OK"]
bar_y, bar_h = Inches(2.42), Inches(0.62)
x = ML
total = sum(BV.values())
for v in order:
    n = BV[v]
    if not n:
        continue
    w = Emu(int(CW * n / total))
    if v == "DATA":
        box(s, x, bar_y, w, bar_h, fill=WHITE, line=STONE, lw=1.5, shape=MSO_SHAPE.RECTANGLE)
        ink = STONE
    else:
        box(s, x, bar_y, w, bar_h, fill=VERDICT_COLOR[v], shape=MSO_SHAPE.RECTANGLE)
        ink = INK if v == "TUNE" else WHITE
    txt(s, x, bar_y + Inches(0.17), w, Inches(0.3), f"{VERDICT_GLYPH[v]}  {n}",
        size=14, bold=True, color=ink, align=PP_ALIGN.CENTER)
    x = Emu(x + w)

cards = [
    ("TUNE", BV["TUNE"], "Параметрээ зас",
     "Оператор ҮРГЭЛЖ нэг чигт (дандаа нэмэх эсвэл дандаа хасах) засаж байгаа "
     "бөгөөд ЗӨВ гарч байна. Энэ нь хүний мэдлэг биш, буруу тохиргоо.",
     "Системд нэг товчоор засварыг санал болгоно"),
    ("MANUAL", BV["MANUAL"], "Операторыг үлдээ",
     "Засвар нь ХОЁР ТАЛЫН — хэзээ нэмэх, хэзээ хасахыг мэдэж байна. "
     "Загварт харагдахгүй мэдээлэл (сургууль, арга хэмжээ) түүнд бий.",
     "Автоматжуулах гэж оролдох нь ХОР болно"),
    ("DATA", BV["DATA"], "Эхлээд дата",
     "2 нь POS холболт тасарсан, 2 нь саяхан нээгдсэн салбар — түүх богино. "
     "Дүгнэлт гаргах үндэслэл хүрэлцэхгүй.",
     "Холболт сэргээх / дата хуримтлуулах"),
    ("AUTO_OK", BV["AUTO_OK"], "Оролцох хэрэггүй",
     "Нөхөлт 100%, илүүдэл бага. Оператор энд мөрийн 4–6%-д хүрсэн ч үр дүн "
     "САЙЖРААГҮЙ — хэрэггүй ажил.", "Цагийг энд бус, дээрх 8 дээр зарцуул"),
]
cw2 = (CW - Inches(0.3) * 3) / 4
for i, (v, n, act, body, foot) in enumerate(cards):
    x = ML + (cw2 + Inches(0.3)) * i
    box(s, x, Inches(3.32), cw2, Inches(3.18), fill=WHITE, line=LINE)
    chip(s, x + Inches(0.24), Inches(3.56), v)
    txt(s, x + Inches(0.64), Inches(3.58), cw2 - Inches(0.9), Inches(0.3),
        f"{n} дэлгүүр", size=13, bold=True, color=INK)
    txt(s, x + Inches(0.24), Inches(4.02), cw2 - Inches(0.48), Inches(0.3), act,
        size=13.5, bold=True, color=VERDICT_COLOR[v] if v != "DATA" else MUTED)
    txt(s, x + Inches(0.24), Inches(4.42), cw2 - Inches(0.48), Inches(1.3), body,
        size=10.5, color=MUTED, spacing=1.35)
    rule(s, Inches(5.9), x=x + Inches(0.24), w=cw2 - Inches(0.48))
    txt(s, x + Inches(0.24), Inches(6.02), cw2 - Inches(0.48), Inches(0.5), foot,
        size=9.5, bold=True, color=INK, spacing=1.25)

txt(s, ML, Inches(6.72), CW, Inches(0.3),
    "WATCH (Хянах) төлөв 0 — энэ нь гараар тавьсан биш, датанаас өөрөө гарсан үр дүн.",
    size=10, color=FAINT)

# ═══════════════════════════════════════════════════════════════════════════
# 05 — Нотолгоо 1: engine vs гарын аргачлал
# ═══════════════════════════════════════════════════════════════════════════
eng = ana["engineFillRate"] * 100
base = ana["baselineFillRate"] * 100
s = slide_base("Хөдөлгүүр гарын аргачлалыг ялсан — өнгөрсөн датан дээр", kicker="Нотолгоо 01")
txt(s, ML, Inches(1.62), Inches(8.6), Inches(0.62),
    "Walk-forward буцаан шалгалт: өдөр бүр зөвхөн ТЭР ӨДРИЙГ ХҮРТЭЛХ датаг ашиглан "
    "захиалга тооцоод, дараагийн өдрийн БОДИТ борлуулалттай харьцуулна.",
    size=13.5, color=MUTED, spacing=1.35)

txt(s, ML, Inches(2.62), Inches(6.6), Inches(0.3), "ЭРЭЛТ ХАНГАЛТЫН ХУВЬ (fill rate)",
    size=10.5, bold=True, color=MUTED)
bx, bw0 = ML, Inches(6.4)
for i, (lab, val, col, sub) in enumerate([
    ("Хөдөлгүүр", eng, TEAL, "(R,S) + таамаглал + аюулгүйн нөөц"),
    ("Гарын аргачлал", base, FAINT, "сүүлийн үеийн дундаж × нөхөх хоног"),
]):
    y = Inches(3.02) + Inches(1.02) * i
    txt(s, bx, y, Inches(1.9), Inches(0.28), lab, size=12.5, bold=True, color=INK)
    txt(s, bx, y + Inches(0.28), Inches(2.4), Inches(0.26), sub, size=9.5, color=MUTED)
    # 90–100% хооронд томруулсан хуваарь — ялгаа харагдахын тулд
    frac = max(0.0, (val - 90.0) / 10.0)
    box(s, bx + Inches(2.6), y, bw0 - Inches(2.6), Inches(0.42), fill=SURF, line=LINE,
        shape=MSO_SHAPE.RECTANGLE)
    box(s, bx + Inches(2.6), y, Emu(int((bw0 - Inches(2.6)) * frac)), Inches(0.42),
        fill=col, shape=MSO_SHAPE.RECTANGLE)
    txt(s, bx + Inches(2.6), y + Inches(0.5), bw0 - Inches(2.6), Inches(0.28),
        f"{val:.1f}%", size=13, bold=True, color=col if col != FAINT else MUTED)
txt(s, ML + Inches(2.6), Inches(5.06), Inches(4.2), Inches(0.26),
    "хуваарь: 90–100% (ялгааг харуулахаар томруулсан)", size=9, color=FAINT)
rich(s, ML, Inches(5.38), Inches(6.6), Inches(0.28),
     [("Хангагдаагүй эрэлт: ", {"color": MUTED, "size": 10.5}),
      (f"{num(bt['baselineUnmet'])} → {num(bt['engineUnmet'])} ширхэг",
       {"bold": True, "size": 11, "color": TEAL_D}),
      (f"  ({(1-bt['engineUnmet']/bt['baselineUnmet'])*100:.0f}% бага)",
       {"color": MUTED, "size": 10.5})], size=10.5)

box(s, ML + Inches(6.95), Inches(2.55), CW - Inches(6.95), Inches(2.72),
    fill=RGBColor(0xF0, 0xFD, 0xFA), line=TEAL)
txt(s, ML + Inches(7.27), Inches(2.82), Inches(4.6), Inches(0.3),
    "ЗӨРҮҮНИЙ МӨНГӨН ДҮН", size=10.5, bold=True, color=TEAL_D)
txt(s, ML + Inches(7.27), Inches(3.18), Inches(4.6), Inches(0.62),
    mnt(ana["lostSalesAvoided"], 0), size=33, bold=True, color=TEAL_D)
txt(s, ML + Inches(7.27), Inches(3.86), Inches(4.6), Inches(0.9),
    f"алдагдахаас сэргийлсэн борлуулалт — {ana['itemsAnalyzed']} барааны "
    f"{M['historyDays']} хоногийн түүхэн дээр. Нийт борлуулалтын "
    f"{ana['lostSalesAvoided']/ana['gmv']*100:.1f}%.",
    size=11, color=INK, spacing=1.35)
rule(s, Inches(4.72), x=ML + Inches(7.27), w=Inches(4.6), color=TEAL)
txt(s, ML + Inches(7.27), Inches(4.84), Inches(4.6), Inches(0.3),
    f"+{eng-base:.1f} нэгж хувь · {ana['storeCount']} дэлгүүр", size=11, bold=True, color=TEAL_D)

box(s, ML, Inches(5.72), CW, Inches(1.16), fill=RGBColor(0xFF, 0xF7, 0xED), line=AMBER)
rich(s, ML + Inches(0.32), Inches(5.94), CW - Inches(0.64), Inches(0.8),
     [("Шударга байх ёстой зүйл: ", {"bold": True}),
      ("өндөр үйлчилгээний түвшин нь илүү нөөцөөр худалдаж авагдана. Хөдөлгүүр "
       "гарын аргачлалаас өдөрт дунджаар ", {"color": INK}),
      (mnt(bt["dailyExtraMnt"], 1), {"bold": True}),
      ("-ийн илүү нөөц барина (20 дэлгүүрийн нийлбэрээр). Жилийн ~50% "
       "хадгалалтын зардлаар 90 хоногт ", {"color": INK}),
      (mnt(bt["holdingCostMnt"], 1), {"bold": True}),
      ("-ийн зардал — сэргээсэн борлуулалтаас 140 дахин бага.", {"color": INK})],
     size=11, spacing=1.35)

# ═══════════════════════════════════════════════════════════════════════════
# 06 — Нотолгоо 2: хүн хаана үнэ цэнэ нэмдэг вэ
# ═══════════════════════════════════════════════════════════════════════════
s = slide_base("Хүний оролцоо хаана үнэ цэнэ нэмж, хаана дэмий вэ", kicker="Нотолгоо 02")
txt(s, ML, Inches(1.62), Inches(9.0), Inches(0.62),
    "Систем гараар өөрчилсөн мөр бүрийг дараа нь гарсан БОДИТ борлуулалттай "
    "тулгаж дүгнэнэ. Ингэснээр “хүн хэрэгтэй юу?” гэдэг асуулт мэдрэмж биш, "
    "хэмжигдэхүүн болно.", size=13.5, color=MUTED, spacing=1.35)

tiles = [
    (f"{M['overrideRate']*100:.1f}%", "мөрийн гараар засагдсан",
     f"{num(M['overrideSamples'])} / {num(M['orderLines'])} мөр — үлдсэн "
     f"{num(AV['autoLines'])} нь хүний оролцоогүй", INK, TEAL),
    (f"{M['overrideAccuracy']*100:.0f}%", "засварын ЗӨВ гарсан хувь",
     "флотын дунджаар — өөрөөр хэлбэл ойролцоогоор зоос шидсэнтэй адил",
     INK, AMBER),
    (f"{AV['autoMae']:.1f} → {AV['manualMae']:.1f}", "дундаж алдаа (ширхэг)",
     "гараар хүрсэн мөрүүд бага зэрэг илүү нарийн — гэхдээ энэ нь ДУНДАЖ, "
     "дэлгүүр бүрт өөр", INK, INDIGO),
]
tw = (CW - Inches(0.3) * 2) / 3
for i, (v, l, sub, c, acc) in enumerate(tiles):
    stat(s, ML + (tw + Inches(0.3)) * i, Inches(2.5), tw, Inches(1.62), v, l, sub,
         color=c, accent=acc, vsize=28)

txt(s, ML, Inches(4.34), CW, Inches(0.3),
    "ДУНДАЖ НЬ ҮНЭНИЙГ НУУНА — ДЭЛГҮҮРЭЭР ЗАДЛАВАЛ:", size=10.5, bold=True, color=MUTED)

groups = [
    ("AUTO_OK", "Автомат хэвээр (8)", "4–6%", "0–2%",
     "Оператор хааяа хүрдэг ч бараг үргэлж БУРУУ. Цэвэр дэмий ажил."),
    ("TUNE", "Тохируулга (4)", "19–21%", "23–83%",
     "Нэг чигт засаж байна → хүний мэдлэг биш, параметр буруу."),
    ("MANUAL", "Гараар (4)", "24–29%", "75–78%",
     "Хоёр тийш засаж, ихэнхдээ зөв → системд байхгүй мэдээлэл түүнд бий."),
]
gh = Inches(0.68)
txt(s, ML + Inches(3.1), Inches(4.66), Inches(1.5), Inches(0.24), "хүрсэн мөр",
    size=9.5, bold=True, color=FAINT)
txt(s, ML + Inches(4.5), Inches(4.66), Inches(1.5), Inches(0.24), "зөв гарсан нь",
    size=9.5, bold=True, color=FAINT)
for i, (v, name, ov, acc, note) in enumerate(groups):
    y = Inches(4.92) + gh * i
    box(s, ML, y, CW, gh - Inches(0.08), fill=SURF if i % 2 == 0 else WHITE, line=LINE)
    chip(s, ML + Inches(0.2), y + Inches(0.17), v, size=Inches(0.28))
    txt(s, ML + Inches(0.58), y + Inches(0.2), Inches(2.4), Inches(0.28), name,
        size=12, bold=True, color=INK)
    txt(s, ML + Inches(3.1), y + Inches(0.2), Inches(1.4), Inches(0.28), ov,
        size=13, bold=True, color=INK)
    txt(s, ML + Inches(4.5), y + Inches(0.2), Inches(1.4), Inches(0.28), acc,
        size=13, bold=True, color=TEAL_D if v == "MANUAL" else (ROSE if v == "AUTO_OK" else AMBER))
    txt(s, ML + Inches(6.0), y + Inches(0.21), CW - Inches(6.2), Inches(0.3), note,
        size=11, color=MUTED)

# ═══════════════════════════════════════════════════════════════════════════
# 07 — 4 бодит жишээ
# ═══════════════════════════════════════════════════════════════════════════
s = slide_base("Дөрвөн дэлгүүр — дөрвөн өөр шийдвэр", kicker="Жишээ")
txt(s, ML, Inches(1.62), Inches(9.0), Inches(0.5),
    "Систем зөвхөн “асуудалтай” гэж хэлдэггүй — ЯМАР үйлдэл хийхийг нэрлэнэ.",
    size=13.5, color=MUTED)

by_code = {r["code"]: r for r in stores}
picks = [
    ("2133", "TUNE", "Эрэлт буурсан — тохиргоо хуучирсан",
     "Зам засварт орж хөл хөдөлгөөн буурсан. Оператор 21% мөрийг ХАСАЖ засаж, "
     "83% нь зөв гарсан — бүгд нэг чигт."),
    ("2142", "MANUAL", "Хүн системээс илүү мэдэж байна",
     "Их сургуулийн хажууд. Арга хэмжээний өдөр нэмж, амралтаар хасдаг. "
     "Засварын 75% зөв, чиглэл нь хоёр талын."),
    ("2151", "DATA", "Шинэ салбар — түүх богино",
     "18 хоногийн түүх. Таамаглалын итгэлцэл босго хүрэхгүй тул систем "
     "дүгнэлт гаргахаас ТАТГАЛЗАНА."),
    ("2157", "DATA", "POS холболт тасарсан",
     "36 цагаас удаан шинэ дата ирээгүй. Систем үүнийг нуухгүй, эхний ээлжид "
     "холболтыг сэргээхийг шаардана."),
]
cw3 = (CW - Inches(0.3) * 3) / 4
for i, (code, v, head, body) in enumerate(picks):
    r = by_code[code]
    x = ML + (cw3 + Inches(0.3)) * i
    box(s, x, Inches(2.4), cw3, Inches(4.0), fill=WHITE, line=LINE)
    box(s, x, Inches(2.4), cw3, Inches(0.055),
        fill=VERDICT_COLOR[v] if v != "DATA" else STONE, shape=MSO_SHAPE.RECTANGLE)
    chip(s, x + Inches(0.24), Inches(2.66), v, size=Inches(0.28))
    txt(s, x + Inches(0.62), Inches(2.68), cw3 - Inches(0.86), Inches(0.28),
        VERDICT_LABEL[v], size=11, bold=True, color=MUTED)
    txt(s, x + Inches(0.24), Inches(3.08), cw3 - Inches(0.48), Inches(0.56),
        r["name"].replace("GS25 ", ""), size=15, bold=True, color=INK, spacing=1.15)
    txt(s, x + Inches(0.24), Inches(3.72), cw3 - Inches(0.48), Inches(0.52), head,
        size=11.5, bold=True, color=VERDICT_COLOR[v] if v != "DATA" else MUTED, spacing=1.25)
    txt(s, x + Inches(0.24), Inches(4.34), cw3 - Inches(0.48), Inches(1.1), body,
        size=10.5, color=MUTED, spacing=1.35)
    rule(s, Inches(5.5), x=x + Inches(0.24), w=cw3 - Inches(0.48))
    txt(s, x + Inches(0.24), Inches(5.62), cw3 - Inches(0.48), Inches(0.24),
        "СИСТЕМИЙН САНАЛ", size=9, bold=True, color=FAINT)
    txt(s, x + Inches(0.24), Inches(5.86), cw3 - Inches(0.48), Inches(0.44),
        r["action"] or "—", size=11.5, bold=True, color=INK, spacing=1.25)

# ═══════════════════════════════════════════════════════════════════════════
# 08 — Гүйцэтгэл (KPI)
# ═══════════════════════════════════════════════════════════════════════════
s = slide_base("Флотын гүйцэтгэл", kicker=f"{M['historyDays']} хоногийн үзүүлэлт")
txt(s, ML, Inches(1.62), Inches(9.0), Inches(0.5),
    "Бүх тоо ажиллаж буй системээс шууд — гараар оруулсан үзүүлэлт байхгүй.",
    size=13.5, color=MUTED)

kpis = [
    (f"{M['serviceRate']*100:.1f}%", "Үйлчилгээний түвшин", "нөөц дуусаагүй өдрийн хувь", TEAL),
    (f"{M['fillRate']*100:.1f}%", "Эрэлт хангалт", "хангагдсан эрэлтийн хувь", TEAL),
    (f"{M['wasteRatio']*100:.1f}%", "Хаягдал", f"{mnt(M['wasteMnt'])}", AMBER),
    (f"{M['overstockRatio']*100:.0f}%", "Илүүдэл нөөц", f"{mnt(M['overstockMnt'])} — гацсан хөрөнгө", AMBER),
    (mnt(M["gmv"]), "Нийт борлуулалт", f"{num(M['demand'])} ширхэг", INK),
    (f"{num(facts['orders']['n'])}", "Захиалга", f"{facts['orders']['submitted']} нь илгээгдсэн", INDIGO),
    (f"{num(facts['sms']['msgs'])}", "SMS мессеж", f"{num(facts['sms']['segs'])} сегмент · 100% хүргэгдсэн", INDIGO),
    (f"{sum(a['c'] for a in facts['alerts'])}", "Нээлттэй дохио",
     f"{[a['c'] for a in facts['alerts'] if a['severity']=='critical'][0]} эгзэгтэй · "
     f"{[a['c'] for a in facts['alerts'] if a['severity']=='warn'][0]} сануулга", ROSE),
]
kw = (CW - Inches(0.26) * 3) / 4
kh = Inches(1.82)
for i, (v, l, sub, acc) in enumerate(kpis):
    x = ML + (kw + Inches(0.26)) * (i % 4)
    y = Inches(2.42) + (kh + Inches(0.26)) * (i // 4)
    stat(s, x, y, kw, kh, v, l, sub, accent=acc, vsize=26)

txt(s, ML, Inches(6.7), CW, Inches(0.3),
    f"Хамрах хугацаа: {board['asOf'][:4]}.{board['asOf'][4:6]}.{board['asOf'][6:]}-аас "
    f"өмнөх {M['historyDays']} хоног · {T['stores']} дэлгүүр · {num(M['items'])} бараа",
    size=10, color=FAINT)

# ═══════════════════════════════════════════════════════════════════════════
# 09 — Бүтэн флот
# ═══════════════════════════════════════════════════════════════════════════
s = slide_base("20 дэлгүүр — нэг дэлгэц дээр", kicker="Флот")
txt(s, ML, Inches(1.55), Inches(9.0), Inches(0.4),
    "Яаралтай эрэмбээр: юуг эхэлж хийхээ хайх шаардлагагүй.", size=12.5, color=MUTED)

hdr = ["", "Дэлгүүр", "Горим", "Үйлчилгээ", "Гараар", "Зөв гарсан", "Нөлөө (₮)", "Санал"]
colx = [ML, ML + Inches(0.42), ML + Inches(3.05), ML + Inches(3.85),
        ML + Inches(4.95), ML + Inches(5.9), ML + Inches(7.1), ML + Inches(8.3)]
for i, hname in enumerate(hdr):
    txt(s, colx[i], Inches(2.06), Inches(1.3), Inches(0.24), hname, size=9, bold=True, color=FAINT)
rule(s, Inches(2.34))

rh = Inches(0.222)
for i, r in enumerate(stores):
    y = Inches(2.42) + rh * i
    if i % 2 == 0:
        box(s, ML - Inches(0.08), y - Inches(0.02), CW + Inches(0.16), rh,
            fill=SURF, shape=MSO_SHAPE.RECTANGLE)
    c = VERDICT_COLOR[r["v"]]
    if r["v"] == "DATA":
        box(s, colx[0] + Inches(0.04), y + Inches(0.035), Inches(0.13), Inches(0.13),
            fill=WHITE, line=STONE, lw=1.0)
    else:
        box(s, colx[0] + Inches(0.04), y + Inches(0.035), Inches(0.13), Inches(0.13), fill=c)
    arrow = {"up": " ↑", "down": " ↓"}.get(r["dir"] or "", "")
    nm = r["name"].replace("GS25 ", "")
    txt(s, colx[1], y, Inches(2.6), rh, f"{nm}", size=9.5,
        bold=r["v"] in ("TUNE", "MANUAL"), color=INK)
    txt(s, colx[2], y, Inches(0.8), rh, "АВТО" if r["mode"] == "auto" else "ГАР",
        size=8.5, color=MUTED)
    txt(s, colx[3], y, Inches(1.0), rh, f"{r['svc']:.1f}%", size=9.5, color=INK)
    txt(s, colx[4], y, Inches(0.9), rh, f"{r['ovr']}%", size=9.5, color=INK)
    txt(s, colx[5], y, Inches(1.1), rh,
        "—" if r["acc"] is None else f"{r['acc']}%", size=9.5,
        bold=r["v"] == "MANUAL", color=TEAL_D if (r["acc"] or 0) >= 70 else MUTED)
    txt(s, colx[6], y, Inches(1.1), rh, f"{r['impact']/1e6:.1f} сая", size=9.5, color=INK)
    txt(s, colx[7], y, Inches(4.3), rh,
        (r["action"] or "Оролцох шаардлагагүй") + arrow, size=9, color=MUTED)

lx = ML
txt(s, ML, Inches(6.95), Inches(1.2), Inches(0.24), "ТАЙЛБАР:", size=8.5, bold=True, color=FAINT)
lx = ML + Inches(0.95)
for v in ["TUNE", "MANUAL", "DATA", "AUTO_OK"]:
    if v == "DATA":
        box(s, lx, Inches(6.98), Inches(0.13), Inches(0.13), fill=WHITE, line=STONE, lw=1.0)
    else:
        box(s, lx, Inches(6.98), Inches(0.13), Inches(0.13), fill=VERDICT_COLOR[v])
    txt(s, lx + Inches(0.2), Inches(6.95), Inches(1.6), Inches(0.24),
        VERDICT_LABEL[v], size=8.5, color=MUTED)
    lx += Inches(1.9)

# ═══════════════════════════════════════════════════════════════════════════
# 10 — Үйл ажиллагаа
# ═══════════════════════════════════════════════════════════════════════════
s = slide_base("Өдөр тутмын горим", kicker="Үйл ажиллагаа")
txt(s, ML, Inches(1.62), Inches(9.0), Inches(0.5),
    f"Хуваарь: өдөр бүр {facts['schedules'][0]['time_of_day']} цагт бүрэн мөчлөг "
    "автоматаар ажиллана.", size=13.5, color=MUTED)

steps2 = [
    ("09:00", "Дата татах", "20 POS-оос өмнөх өдрийн борлуулалт, нөөц"),
    ("09:02", "Захиалга тооцох", "бараа бүрт S түвшин, дараа нь захиалгын хэмжээ"),
    ("09:03", "Хязгаар шалгах",
     f"{mnt(T['approvalThreshold'], 0)}-аас доош бол автоматаар илгээнэ"),
    ("09:04", "SMS илгээх", "захиалгын төв рүү хэсэгчлэн, хүргэлт баталгаажна"),
    ("Өдөржин", "Хяналт", "оператор зөвхөн шийдвэр шаардсан дэлгүүрийг хардаг"),
]
y0 = Inches(2.5)
for i, (t, name, body) in enumerate(steps2):
    y = y0 + Inches(0.72) * i
    box(s, ML, y, Inches(0.95), Inches(0.56), fill=NIGHT)
    txt(s, ML, y + Inches(0.16), Inches(0.95), Inches(0.28), t, size=11, bold=True,
        color=WHITE, align=PP_ALIGN.CENTER)
    txt(s, ML + Inches(1.15), y + Inches(0.04), Inches(2.3), Inches(0.3), name,
        size=13.5, bold=True, color=INK)
    txt(s, ML + Inches(1.15), y + Inches(0.32), Inches(5.6), Inches(0.3), body,
        size=11, color=MUTED)
    if i < len(steps2) - 1:
        box(s, ML + Inches(0.46), y + Inches(0.56), Emu(9525), Inches(0.16),
            fill=LINE, shape=MSO_SHAPE.RECTANGLE)

bx2 = ML + Inches(7.6)
box(s, bx2, Inches(2.5), CW - Inches(7.6), Inches(3.9), fill=SURF, line=LINE)
txt(s, bx2 + Inches(0.3), Inches(2.76), Inches(4.4), Inches(0.3), "ХЯНАЛТЫН БАТАЛГАА",
    size=10.5, bold=True, color=MUTED)
guards = [
    ("Мөнгөн дүнгийн хязгаар",
     f"{mnt(T['approvalThreshold'], 0)}-аас дээш захиалга АВТОМАТААР ИЛГЭЭГДЭХГҮЙ — "
     "оператор баталгаажуулна."),
    ("Дата дутуу бол дүгнэхгүй",
     "Түүх богино эсвэл POS тасарсан бол систем санал өгөхөөс татгалзана."),
    ("Бүх өөрчлөлт бүртгэгдэнэ",
     "Хэн, хэзээ, юуг өөрчилснийг audit бүртгэлд хадгална."),
    ("Тохируулга нь заавал зөвшөөрөгдөнө",
     "Параметрийн засварыг систем өөрөө хийхгүй — санал болгоод хүлээнэ."),
]
for i, (h, b) in enumerate(guards):
    y = Inches(3.1) + Inches(0.8) * i
    txt(s, bx2 + Inches(0.3), y, Inches(0.2), Inches(0.24), "•", size=12, bold=True, color=TEAL)
    txt(s, bx2 + Inches(0.52), y, Inches(3.55), Inches(0.26), h, size=11.5, bold=True, color=INK)
    txt(s, bx2 + Inches(0.52), y + Inches(0.26), Inches(3.55), Inches(0.5), b,
        size=10, color=MUTED, spacing=1.3)

box(s, ML, Inches(6.28), Inches(7.2), Inches(0.72), fill=WHITE, line=LINE)
rich(s, ML + Inches(0.28), Inches(6.48), Inches(6.7), Inches(0.36),
     [(f"{num(facts['sms']['msgs'])} мессеж · {num(facts['sms']['segs'])} сегмент · ",
       {"bold": True}),
      ("бүгд хүргэгдсэн. Одоогоор SMS гарц нь симуляц — жинхэнэ дугаар руу "
       "залгахад нэг файл солигдоно.", {"color": MUTED})], size=10.5)

# ═══════════════════════════════════════════════════════════════════════════
# 11 — Хэрэгжилт
# ═══════════════════════════════════════════════════════════════════════════
s = slide_base("Юу бэлэн болсон, юу үлдсэн", kicker="Хэрэгжилт")
txt(s, ML, Inches(1.62), Inches(9.0), Inches(0.5),
    "Систем аль хэдийн ажиллаж байна. Үлдсэн нь холболт ба байгууллагын "
    "тохиргоо.", size=13.5, color=MUTED)

phases = [
    ("P1", True, "Суурь", "POS татах · (R,S) хөдөлгүүр · тохиргооны шатлал · "
     "захиалгын урсгал · экспорт"),
    ("P2", True, "Аналитик", "Буцаан шалгалт · улирлын загвар · эрүүл мэндийн оноо · "
     "авто-тохируулга (зөвшөөрөлтэй)"),
    ("P3", True, "Илгээлт", "SMS гарц · бүрэн мөчлөгийн автоматжуулалт · хуваарь · "
     "гарцын консол"),
    ("P4", True, "Шийдвэрийн самбар", "Дэлгүүр бүрийн дүгнэлт · үйлдлийн санал · "
     "квадрант · 20 дэлгүүрийн жишиг дата"),
    ("P5", False, "Үйлдвэрлэлд гаргах", "ЖИНХЭНЭ SMS/API холболт · нэвтрэлт ба эрх · "
     "хуваарийн даалгавар · Postgres руу шилжих"),
]
for i, (p, done, name, body) in enumerate(phases):
    y = Inches(2.42) + Inches(0.86) * i
    col = TEAL if done else FAINT
    box(s, ML, y, Inches(0.86), Inches(0.66), fill=col if done else WHITE,
        line=None if done else FAINT, lw=1.5)
    txt(s, ML, y + Inches(0.2), Inches(0.86), Inches(0.3), p, size=13, bold=True,
        color=WHITE if done else MUTED, align=PP_ALIGN.CENTER)
    txt(s, ML + Inches(1.06), y + Inches(0.06), Inches(3.0), Inches(0.3), name,
        size=14, bold=True, color=INK)
    txt(s, ML + Inches(1.06), y + Inches(0.36), Inches(8.0), Inches(0.3), body,
        size=10.5, color=MUTED)
    txt(s, W - MR - Inches(1.5), y + Inches(0.18), Inches(1.5), Inches(0.3),
        "БЭЛЭН" if done else "ҮЛДСЭН", size=10, bold=True,
        color=TEAL if done else FAINT, align=PP_ALIGN.RIGHT)

box(s, ML, Inches(6.86), CW, Emu(1), fill=LINE, shape=MSO_SHAPE.RECTANGLE)

# ═══════════════════════════════════════════════════════════════════════════
# 12 — Дараагийн алхам
# ═══════════════════════════════════════════════════════════════════════════
s = prs.slides.add_slide(BLANK)
box(s, 0, 0, W, H, fill=NIGHT, shape=MSO_SHAPE.RECTANGLE)
box(s, 0, 0, Inches(0.14), H, fill=TEAL, shape=MSO_SHAPE.RECTANGLE)
txt(s, Inches(1.1), Inches(1.05), Inches(10), Inches(0.3), "ДАРААГИЙН АЛХАМ",
    size=11.5, bold=True, color=TEAL)
txt(s, Inches(1.1), Inches(1.5), Inches(10.5), Inches(0.9),
    "Туршилтыг жинхэнэ дэлгүүр дээр", size=36, bold=True, color=WHITE)

asks = [
    ("01", "3–5 дэлгүүрийн жинхэнэ POS холболт",
     "Одоо байгаа ингест нь GS25 DCSPS схемтэй ажиллана — IP ба эрх л хэрэгтэй."),
    ("02", "Захиалгын төвийн жинхэнэ суваг",
     "SMS дугаар эсвэл API. Системд нэг л файл (гарц) солигдоно."),
    ("03", "4 долоо хоногийн зэрэгцээ ажиллагаа",
     "Систем санал болгоно, оператор шийднэ. Дараа нь хоёрын зөрүүг хэмжинэ."),
    ("04", "Хэмжих шалгуурыг хамтдаа тогтоох",
     "Нөөц дуусалт, хаягдал, илүүдэл, операторын цаг — эхлэхээс өмнө тохирно."),
]
for i, (n, h, b) in enumerate(asks):
    y = Inches(2.72) + Inches(0.92) * i
    txt(s, Inches(1.1), y, Inches(0.6), Inches(0.3), n, size=13, bold=True, color=TEAL)
    txt(s, Inches(1.85), y - Inches(0.04), Inches(9.5), Inches(0.32), h,
        size=16, bold=True, color=WHITE)
    txt(s, Inches(1.85), y + Inches(0.32), Inches(9.5), Inches(0.32), b,
        size=11.5, color=RGBColor(0xA8, 0xA2, 0x9E))

rule(s, Inches(6.5), x=Inches(1.1), w=Inches(10.5), color=RGBColor(0x44, 0x40, 0x3C))
txt(s, Inches(1.1), Inches(6.72), Inches(10.5), Inches(0.3),
    f"Одоогийн байдлаар: {T['stores']} дэлгүүр · {num(M['items'])} бараа · "
    f"{num(M['orderLines'])} захиалгын мөр · {M['serviceRate']*100:.1f}% үйлчилгээний түвшин",
    size=11, color=FAINT)

prs.save(OUT)
print("OK ->", OUT)
print("slides:", len(prs.slides.__iter__.__self__._sldIdLst))
