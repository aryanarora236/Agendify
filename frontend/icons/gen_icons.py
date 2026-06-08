#!/usr/bin/env python3
"""Generate Agendify PNG icons at 16, 48, and 128px."""
import struct
import zlib
import math
import os

# CRC32 helper
def _crc32(data):
    return struct.pack('>I', zlib.crc32(data) & 0xFFFFFFFF)

def _chunk(tag, data):
    tag = tag.encode('ascii') if isinstance(tag, str) else tag
    return struct.pack('>I', len(data)) + tag + data + _crc32(tag + data)

def make_png(size, pixel_fn):
    """
    pixel_fn(x, y, size) -> (r, g, b, a)
    Returns raw PNG bytes.
    """
    signature = b'\x89PNG\r\n\x1a\n'
    ihdr_data = struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)  # RGBA
    ihdr = _chunk('IHDR', ihdr_data)

    raw = bytearray()
    for y in range(size):
        raw.append(0)  # filter type = None
        for x in range(size):
            r, g, b, a = pixel_fn(x, y, size)
            raw += bytes([r, g, b, a])

    idat = _chunk('IDAT', zlib.compress(bytes(raw), 9))
    iend = _chunk('IEND', b'')
    return signature + ihdr + idat + iend


def agendify_pixel(x, y, size):
    """
    Blue rounded-rectangle background with a white calendar grid icon.
    """
    # Coordinate system centred at (0,0), range [-1, 1]
    fx = (x + 0.5) / size * 2 - 1
    fy = (y + 0.5) / size * 2 - 1

    # Rounded rectangle SDF (corner radius = 0.25)
    r = 0.25
    qx = abs(fx) - (1 - r)
    qy = abs(fy) - (1 - r)
    sdf = math.sqrt(max(qx, 0)**2 + max(qy, 0)**2) + min(max(qx, qy), 0) - r
    # sdf < 0 means inside the rounded rect
    if sdf > 0.06:
        return (255, 255, 255, 0)  # transparent outside

    # Smooth anti-aliased edge
    alpha = max(0.0, min(1.0, (-sdf) / 0.06))

    # Background colour: Tailwind blue-500 #3B82F6
    bg = (59, 130, 246)

    # Draw a tiny calendar icon in white
    # Normalised icon area: leave ~15% padding
    pad = 0.20
    ix = (fx + 1) / 2  # 0..1 range
    iy = (fy + 1) / 2

    white = False

    if pad < ix < 1 - pad and pad < iy < 1 - pad:
        # Icon box coords: 0..1 inside the icon area
        rx = (ix - pad) / (1 - 2 * pad)
        ry = (iy - pad) / (1 - 2 * pad)

        stroke = 0.07  # stroke width in icon-local units

        # Outer border
        if (rx < stroke or rx > 1 - stroke or
                ry < stroke or ry > 1 - stroke):
            white = True

        # Horizontal line dividing header (~25% down)
        header_y = 0.28
        if abs(ry - header_y) < stroke * 0.7:
            white = True

        # Two notches at top for calendar rings
        notch_w = 0.10
        notch_h = 0.18
        if ry < header_y:
            for nx in (0.30, 0.70):
                if abs(rx - nx) < notch_w / 2 and ry > -notch_h:
                    white = True

        # 3-column × 2-row dot grid in the body area
        if ry > header_y + stroke:
            dot_r = 0.07
            cols = [0.25, 0.50, 0.75]
            rows = [0.55, 0.78]
            for cx in cols:
                for cy in rows:
                    if math.sqrt((rx - cx)**2 + (ry - cy)**2) < dot_r:
                        white = True

    if white:
        r_out, g_out, b_out = 255, 255, 255
    else:
        r_out, g_out, b_out = bg

    a_out = int(alpha * 255)
    return (r_out, g_out, b_out, a_out)


def main():
    out_dir = os.path.dirname(os.path.abspath(__file__))
    for size in (16, 48, 128):
        data = make_png(size, agendify_pixel)
        path = os.path.join(out_dir, f'icon{size}.png')
        with open(path, 'wb') as f:
            f.write(data)
        print(f'Created {path} ({len(data)} bytes)')


if __name__ == '__main__':
    main()
