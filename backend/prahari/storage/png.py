"""Minimal 8-bit greyscale PNG encoder for class-indexed map layers.

Each pixel value is a class index; the browser recolours it from design
tokens, so no colour decision is baked into the backend.
"""

from __future__ import annotations

import struct
import zlib

import numpy as np


def _chunk(tag: bytes, data: bytes) -> bytes:
    body = tag + data
    return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)


def encode_classes(classes: np.ndarray) -> bytes:
    """Encode a 2-D uint8 array (row 0 = north) as a greyscale PNG."""
    if classes.ndim != 2:
        raise ValueError("classes must be 2-D")
    data = np.ascontiguousarray(classes, dtype=np.uint8)
    height, width = data.shape
    raw = b"".join(b"\x00" + data[r].tobytes() for r in range(height))
    header = struct.pack(">IIBBBBB", width, height, 8, 0, 0, 0, 0)
    return (
        b"\x89PNG\r\n\x1a\n"
        + _chunk(b"IHDR", header)
        + _chunk(b"IDAT", zlib.compress(raw, 9))
        + _chunk(b"IEND", b"")
    )
