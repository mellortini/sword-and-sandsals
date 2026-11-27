"""Extract the packed textures of the downloaded BlenderKit materials into art_src/blenderkit/<name>/tex/*.png
(the names sprite_lib.TEX expects). Run after tools/fetch_blenderkit.py:

  python -I tools/blender.py blender/unpack_blenderkit.py      (always runs with --disable-autoexec)

--disable-autoexec: the downloaded .blend files are third-party, never run their scripts.
tex_stats.json (mean colours used by sprite_lib) is tracked in git, so it is not rebuilt here.
"""
import bpy
import glob
import os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'art_src', 'blenderkit'))
for d in sorted(glob.glob(os.path.join(ROOT, '*', ''))):
    blends = glob.glob(os.path.join(d, '*.blend'))
    if not blends:
        continue
    with bpy.data.libraries.load(blends[0]) as (src, dst):
        dst.materials = src.materials
    os.makedirs(os.path.join(d, 'tex'), exist_ok=True)
    n = 0
    for m in dst.materials:
        if m is None or not m.use_nodes:
            continue
        for node in m.node_tree.nodes:
            if node.type == 'TEX_IMAGE' and node.image and node.image.packed_file:
                im = node.image
                im.filepath_raw = os.path.join(d, 'tex', bpy.path.clean_name(im.name) + '.png')
                im.file_format = 'PNG'
                im.save()
                n += 1
    print('unpacked', os.path.basename(d[:-1]), n, 'textures')
