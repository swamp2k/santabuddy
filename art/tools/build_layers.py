"""Cut the character sheet into stacked, pre-aligned transparent .webp layers.

Every layer is a full canvas (CANVAS x CANVAS px) with its part already in
place, so the renderer just stacks them (position:absolute; inset:0).

    python art/tools/build_layers.py

Output: renderer/art/*.webp, renderer/art/thumbs/*.webp, renderer/art/layers.json
Edit PLACE below to move/scale an accessory, then re-run.
"""
import json, os, sys
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from cutout import remove_background, components  # noqa: E402

ROOT = os.path.normpath(os.path.join(HERE, '..', '..'))
SRC = os.path.join(ROOT, 'art', 'source', 'sheet.jpg')
OUT = os.path.join(ROOT, 'renderer', 'art')
CANVAS = 1024          # pixels per layer image (shown in a 512 css-px container = 2x for sharp screens)
UNIT = CANVAS / 512    # image px per container px

# sheet -> container mapping: feet centre (FX,FY) lands at (256, 500)
FX, FY, S = 495, 1292, 0.34


def to_canvas(x, y):
    return ((x - FX) * S + 256, (y - FY) * S + 500)


# ---------------------------------------------------------------------------
# Accessories: source box on the sheet, an anchor point on the item (sheet px),
# where that anchor goes on the character (sheet px), scale, rotation (deg),
# which body part it follows, and whether it's drawn behind that part.
PLACE = {
    # the sheet shows the nisse hat from below (dark inside visible): 'clear' cuts that away (ellipses, sheet px)
    'hat-santa':   dict(box=(911, 112, 1483, 521),  anchor=(1262, 402), at=(470, 330), scale=1.25, rot=-4, part='head',
                        clear=[(1265, 462, 190, 64)]),
    'hat-wool':    dict(box=(1532, 105, 1970, 537), anchor=(1748, 498), at=(468, 362), scale=1.13, rot=-3, part='head'),
    'lucia-crown': dict(box=(1001, 598, 1492, 982), anchor=(1246, 940), at=(470, 336), scale=1.02, rot=-3, part='head'),
    'antlers':     dict(box=(1510, 589, 1991, 953), anchor=(1752, 930), at=(472, 440), scale=1.42, rot=0, part='head', behind=True),
    'scarf':       dict(box=(1017, 1089, 1492, 1516), anchor=(1255, 1132), at=(470, 652), scale=1.12, rot=0, part='body'),
    'lantern':     dict(box=(1602, 1053, 1900, 1520), anchor=(1750, 1112), at=(842, 972), scale=0.62, rot=4, part='body', behind=True),
    'porridge':    dict(box=(1068, 1610, 1445, 1929), anchor=(1256, 1850), at=(150, 1000), scale=0.56, rot=-6, part='body'),
    'present':     dict(box=(1603, 1601, 1916, 1929), anchor=(1760, 1900), at=(135, 1050), scale=0.95, rot=-4, part='body'),
}

# Character joints (sheet px)
JOINTS = {
    'neck': (478, 640),
    'hipL': (400, 1040), 'hipR': (625, 1040),
    'feet': (FX, FY),
    'eyeL': (425, 447), 'eyeR': (618, 442),
    'mouth': (525, 588),
    'headTop': (468, 190),
    'handL': (128, 975), 'handR': (842, 972),
}


def save_layer(arr, name):
    """arr: sheet-sized RGBA. Map it into the canvas and save as webp."""
    im = Image.fromarray(arr)
    # crop to content to keep resampling cheap
    bbox = im.getbbox()
    piece = im.crop(bbox)
    x0, y0 = to_canvas(bbox[0], bbox[1])
    w = round(piece.width * S * UNIT)
    h = round(piece.height * S * UNIT)
    piece = piece.resize((w, h), Image.LANCZOS)
    canvas = Image.new('RGBA', (CANVAS, CANVAS), (0, 0, 0, 0))
    canvas.alpha_composite(piece, (round(x0 * UNIT), round(y0 * UNIT)))
    canvas.save(os.path.join(OUT, name + '.webp'), 'WEBP', quality=90, method=6)
    return canvas


def place_item(sheet, name, p):
    x0, y0, x1, y1 = p['box']
    crop = sheet[y0:y1, x0:x1].copy()
    if p.get('clear'):
        yy, xx = np.mgrid[y0:y1, x0:x1]
        for cx, cy, rx, ry in p['clear']:
            crop[((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2 < 1, 3] = 0
    item = Image.fromarray(crop)
    ax, ay = p['anchor'][0] - x0, p['anchor'][1] - y0
    k = p['scale'] * S * UNIT
    item = item.resize((round(item.width * k), round(item.height * k)), Image.LANCZOS)
    ax, ay = ax * k, ay * k
    # rotate around the anchor: pad so the anchor is the centre
    pad = int(max(item.size) * 1.5)
    big = Image.new('RGBA', (pad * 2, pad * 2), (0, 0, 0, 0))
    big.alpha_composite(item, (round(pad - ax), round(pad - ay)))
    if p.get('rot'):
        big = big.rotate(-p['rot'], resample=Image.BICUBIC)
    tx, ty = to_canvas(*p['at'])
    canvas = Image.new('RGBA', (CANVAS, CANVAS), (0, 0, 0, 0))
    # paste with clipping
    ox, oy = round(tx * UNIT - pad), round(ty * UNIT - pad)
    src_box = (max(0, -ox), max(0, -oy), min(big.width, CANVAS - ox), min(big.height, CANVAS - oy))
    canvas.alpha_composite(big.crop(src_box), (max(0, ox), max(0, oy)))
    canvas.save(os.path.join(OUT, name + '.webp'), 'WEBP', quality=90, method=6)
    # thumbnail for the wardrobe
    thumb = Image.fromarray(sheet[y0:y1, x0:x1].copy())
    thumb.thumbnail((128, 128), Image.LANCZOS)
    tc = Image.new('RGBA', (128, 128), (0, 0, 0, 0))
    tc.alpha_composite(thumb, ((128 - thumb.width) // 2, (128 - thumb.height) // 2))
    tc.save(os.path.join(OUT, 'thumbs', name + '.webp'), 'WEBP', quality=90)


def split_character(sheet):
    """Split the nisse into head (with beard), body (with arms) and two legs."""
    H, W = sheet.shape[:2]
    rgb = sheet[..., :3].astype(int)
    a = sheet[..., 3]
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    yy, xx = np.mgrid[0:H, 0:W]
    char = (a > 0) & (xx >= 60) & (xx < 930) & (yy >= 160) & (yy < 1320)

    dark = rgb.max(axis=2) < 115                       # ink outline
    light = (rgb.min(axis=2) > 150) & ((rgb.max(axis=2) - rgb.min(axis=2)) < 45)  # beard / hair
    coat = (r - g > 70) & (r > 100) & (a > 230)

    # --- head: everything above the shoulders + the whole beard ---
    beard_seed = (520, 720)
    lab, _ = ndi.label(light & char)
    beard = lab == lab[beard_seed[1], beard_seed[0]]
    beard = ndi.binary_fill_holes(beard | (dark & ndi.binary_dilation(beard, iterations=6)))
    near_beard_ink = dark & ndi.binary_dilation(beard, iterations=18) & (yy < 860)
    head = char & ((yy < 612) | beard | near_beard_ink)
    head = ndi.binary_fill_holes(head) & char

    # --- legs: below the coat hem, not coat red, not the hands ---
    below = char & (yy > 1005) & (xx > 140) & (xx < 880)
    near_coat = ndi.binary_dilation(coat & char, iterations=9)
    legs = below & ~coat & ~(dark & near_coat)
    legs |= below & ~near_coat  # anything clearly away from the coat is leg

    def biggest(mask):
        lab, n = ndi.label(mask)
        if n == 0:
            return mask
        sizes = ndi.sum(mask, lab, range(1, n + 1))
        return lab == (int(np.argmax(sizes)) + 1)

    legL = biggest(legs & (xx < 515))
    legR = biggest(legs & (xx >= 515))
    # leftover crumbs below the hem (bits of boot outline) belong to the legs, not the body
    crumbs = legs & ~legL & ~legR
    legL |= crumbs & (xx < 515)
    legR |= crumbs & (xx >= 515)
    legs = legL | legR

    body = biggest(char & ~head & ~legs)
    head = biggest(head)

    def layer(mask):
        out = np.zeros_like(sheet)
        out[mask] = sheet[mask]
        return out

    body_img = layer(body)
    # fill the hole behind the beard with coat colour, so tilting the head never shows a gap
    hole = head & (yy >= 600) & ~((xx < 190) | (xx > 760))
    coat_col = np.median(sheet[(coat & char & (yy > 700) & (yy < 850))][:, :3], axis=0).astype(np.uint8)
    body_img[hole] = [*coat_col, 255]
    # neck stub above the cut line
    neck = (((xx - 478) / 150.0) ** 2 + ((yy - 640) / 70.0) ** 2) < 1
    body_img[neck & ~body] = [*coat_col, 255]

    # extend legs upward behind the coat so swinging them never shows a gap
    leg_imgs = {}
    for name, m, (x0, x1) in (('legL', legL, (300, 495)), ('legR', legR, (535, 725))):
        img = layer(m)
        cols = m[1040:1080, x0:x1]
        pants = np.median(sheet[1040:1080, x0:x1][cols][:, :3], axis=0).astype(np.uint8) if cols.any() else np.array([50, 90, 50], np.uint8)
        top = 960
        ext = (yy >= top) & (yy < 1070) & (xx >= x0 + 8) & (xx < x1 - 8) & ~m
        img[ext] = [*pants, 255]
        leg_imgs[name] = img

    # skin colour next to the eyes, for blinking eyelids
    skin = np.median(sheet[425:470, 470:500][:, :, :3].reshape(-1, 3), axis=0).astype(int).tolist()
    return {'head': layer(head), 'body': body_img, **leg_imgs}, {'skin': skin, 'coat': coat_col.tolist()}


def main():
    os.makedirs(os.path.join(OUT, 'thumbs'), exist_ok=True)
    sheet = remove_background(SRC)
    # the lantern's ring has white inside it: make that see-through too
    rgb = sheet[..., :3].astype(int)
    hole_lab, _ = ndi.label(rgb.min(axis=2) > 225)
    for seed in [(1752, 1095)]:
        l = hole_lab[seed[1], seed[0]]
        if l:
            sheet[hole_lab == l, 3] = 0

    parts, colours = split_character(sheet)
    canv = {name: save_layer(arr, name) for name, arr in parts.items()}

    # hit mask: where he is solid (rest pose), MASK x MASK cells over the 512 container
    MASK = 96
    union = np.zeros((CANVAS, CANVAS), bool)
    for c in canv.values():
        union |= np.asarray(c)[..., 3] > 60
    small = np.asarray(Image.fromarray(union.astype(np.uint8) * 255).resize((MASK, MASK), Image.BOX)) > 20
    small = ndi.binary_dilation(small, iterations=1)
    mask_rows = [''.join('1' if v else '0' for v in row) for row in small]

    # tray icon: his face
    full = Image.new('RGBA', (CANVAS, CANVAS), (0, 0, 0, 0))
    for n in ('body', 'head'):
        full.alpha_composite(canv[n])
    hx, hy = to_canvas(470, 420)
    r = 125 * UNIT
    icon = full.crop((round(hx * UNIT - r), round(hy * UNIT - r), round(hx * UNIT + r), round(hy * UNIT + r)))
    icon.resize((64, 64), Image.LANCZOS).save(os.path.join(OUT, 'tray.png'))

    for name, p in PLACE.items():
        place_item(sheet, name, p)

    meta = {
        'canvas': 512,
        'joints': {k: [round(v, 1) for v in to_canvas(*xy)] for k, xy in JOINTS.items()},
        'colours': colours,
        'items': {k: {'part': p['part'], 'behind': bool(p.get('behind'))} for k, p in PLACE.items()},
        'mask': {'size': MASK, 'rows': mask_rows},
    }
    with open(os.path.join(OUT, 'layers.json'), 'w') as f:
        json.dump(meta, f, indent=2)
    print('ok', sorted(os.listdir(OUT)))


if __name__ == '__main__':
    main()
