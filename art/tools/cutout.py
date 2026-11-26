"""Shared helpers: turn a white-background sheet into RGBA with soft edges."""
import numpy as np
from PIL import Image
from scipy import ndimage as ndi


def remove_background(path, white=212):
    """Return an RGBA numpy array: background (white connected to the border)
    becomes transparent, with an anti-aliased edge and glows kept as soft alpha."""
    rgb = np.asarray(Image.open(path).convert('RGB')).astype(np.float32)
    mn = rgb.min(axis=2)
    whiteish = mn > white
    lab, _ = ndi.label(whiteish)
    border = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    bg = np.isin(lab, border[border > 0])

    # alpha: 0 in background, 1 inside; soft ramp in a band at the edge
    alpha = (~bg).astype(np.float32)
    band = ndi.binary_dilation(~bg, iterations=3) & ~ndi.binary_erosion(~bg, iterations=2)
    # how "un-white" a pixel is (outline ~ 60, white 255)
    unwhite = np.clip((255 - mn) / (255 - 120), 0, 1)
    alpha[band] = np.maximum(alpha[band] * 0, unwhite[band])
    alpha[bg & ~band] = 0

    # glows: warm pixels in the background (yellow/orange halo) keep soft alpha
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    warm = bg & ((r - b) > 12)
    glow_a = np.clip((r - b - 8) / 90, 0, 0.85)
    alpha[warm] = np.maximum(alpha[warm], glow_a[warm])

    # un-blend white from semi-transparent pixels: c = (c_obs - (1-a)*255) / a
    a = alpha[..., None]
    with np.errstate(divide='ignore', invalid='ignore'):
        col = np.where(a > 0.02, (rgb - (1 - a) * 255) / np.maximum(a, 1e-3), rgb)
    col = np.clip(col, 0, 255)
    out = np.dstack([col, alpha * 255]).astype(np.uint8)
    return out


def components(rgba, min_area=1500, grow=12):
    """Bounding boxes of separate objects (pieces closer than `grow` px are merged)."""
    solid = rgba[..., 3] > 40
    merged = ndi.binary_dilation(solid, iterations=grow)
    lab, n = ndi.label(merged)
    boxes = []
    for i, sl in enumerate(ndi.find_objects(lab), 1):
        area = (lab[sl] == i).sum()
        if area >= min_area:
            boxes.append((sl[1].start, sl[0].start, sl[1].stop, sl[0].stop, int(area)))
    return sorted(boxes, key=lambda b: (b[1] // 200, b[0]))
