"""Run one of the art scripts in Blender, headless, on any computer (#8).

  python -I tools/blender.py blender/build_kit.py -- 32 helmet9,face3
  python -I tools/blender.py blender/unpack_blenderkit.py
  python -I tools/blender.py --where                    # only print which Blender would run

Blender is taken from the BLENDER environment variable, else from the usual install places (newest first:
Windows "Program Files/Blender Foundation/Blender X.Y", D:/blender, macOS /Applications), else from PATH.
Scripts always run with --disable-autoexec: no .blend file's own scripts ever run (the BlenderKit downloads are
third-party). Set CYCLES_DEVICE=CPU to render without the GPU.
"""
import glob
import os
import re
import shutil
import subprocess
import sys


def find_blender():
    env = os.environ.get('BLENDER')
    if env:
        if os.path.isfile(env):
            return env
        sys.exit(f'BLENDER={env} does not exist')
    found = glob.glob('C:/Program Files/Blender Foundation/Blender */blender.exe')
    # newest version first ("Blender 5.10" after "Blender 5.9")
    found.sort(key=lambda p: [int(n) for n in re.findall(r'\d+', os.path.basename(os.path.dirname(p)))], reverse=True)
    for path in found + ['D:/blender/blender.exe', '/Applications/Blender.app/Contents/MacOS/Blender']:
        if os.path.isfile(path):
            return path
    on_path = shutil.which('blender')
    if on_path:
        return on_path
    sys.exit('Blender not found: install Blender 5.3 or set BLENDER=<path to the blender executable>')


def main(args):
    blender = find_blender()
    if not args or args[0] in ('-h', '--help'):
        print(__doc__)
        return 0
    if args[0] == '--where':
        print(blender)
        return 0
    script, rest = args[0], args[1:]
    if not os.path.isfile(script):
        sys.exit(f'no such script: {script}')
    cmd = [blender, '-b', '--disable-autoexec', '--python', script, *rest]
    print('>', ' '.join(f'"{c}"' if ' ' in c else c for c in cmd), flush=True)
    return subprocess.call(cmd)


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
