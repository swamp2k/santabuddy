"""Contact sheet of the built layers: exploded parts, posed, and every accessory.
    python art/tools/preview.py out.jpg
"""
import json, os, sys
from PIL import Image

ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
ART = os.path.join(ROOT, 'renderer', 'art')
meta = json.load(open(os.path.join(ART, 'layers.json')))
J = meta['joints']
L = lambda n: Image.open(os.path.join(ART, n + '.webp')).convert('RGBA')
U = 2  # image px per container px


def rot(im, deg, pivot):
    return im.rotate(-deg, center=(pivot[0] * U, pivot[1] * U), resample=Image.BICUBIC)


def figure(items=(), head=0, legL=0, legR=0):
    c = Image.new('RGBA', (1024, 1024), (60, 92, 135, 255))
    hd = rot(L('head'), head, J['neck'])
    front_head = [i for i in items if meta['items'][i]['part'] == 'head' and not meta['items'][i]['behind']]
    back_head = [i for i in items if meta['items'][i]['part'] == 'head' and meta['items'][i]['behind']]
    front_body = [i for i in items if meta['items'][i]['part'] == 'body' and not meta['items'][i]['behind']]
    back_body = [i for i in items if meta['items'][i]['part'] == 'body' and meta['items'][i]['behind']]
    for i in back_body: c.alpha_composite(L(i))
    c.alpha_composite(rot(L('legL'), legL, J['hipL']))
    c.alpha_composite(rot(L('legR'), legR, J['hipR']))
    c.alpha_composite(L('body'))
    for i in front_body:
        if i == 'scarf': c.alpha_composite(L(i))
    for i in back_head: c.alpha_composite(rot(L(i), head, J['neck']))
    c.alpha_composite(hd)
    for i in front_head: c.alpha_composite(rot(L(i), head, J['neck']))
    for i in front_body:
        if i != 'scarf': c.alpha_composite(L(i))
    return c


def explode():
    c = Image.new('RGBA', (1024, 1024), (60, 92, 135, 255))
    for n, (dx, dy) in {'legL': (-60, 90), 'legR': (60, 90), 'body': (0, 30), 'head': (0, -60)}.items():
        c.alpha_composite(L(n), (dx, dy))
    return c


tiles = [
    explode(),
    figure(),
    figure(head=12, legL=25, legR=-25),
    figure(['hat-santa', 'scarf', 'lantern']),
    figure(['hat-wool', 'porridge']),
    figure(['lucia-crown', 'present']),
    figure(['antlers', 'scarf']),
    figure(['hat-santa'], head=-10, legL=-30, legR=20),
]
cols, size = 4, 400
sheet = Image.new('RGB', (cols * size, ((len(tiles) + cols - 1) // cols) * size), 'white')
for i, t in enumerate(tiles):
    sheet.paste(t.convert('RGB').resize((size, size), Image.LANCZOS), ((i % cols) * size, (i // cols) * size))
sheet.save(sys.argv[1] if len(sys.argv) > 1 else 'preview.jpg', quality=88)
