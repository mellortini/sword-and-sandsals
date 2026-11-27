"""Download the free BlenderKit paper / cardboard materials the art pipeline uses (they are NOT in git:
BlenderKit's royalty-free licence allows using them in the game, not redistributing the raw files).

  python -I tools/fetch_blenderkit.py                 # downloads into art_src/blenderkit/<name>/
  python -I tools/blender.py blender/unpack_blenderkit.py   # extracts textures to <name>/tex/

The list of assets (ids, licences, authors) is art_src/blenderkit/assets.json (tracked in git).
Free assets download without an account; nothing personal is sent.
"""
import json
import os
import sys
import urllib.request

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'art_src', 'blenderkit'))
API = 'https://www.blenderkit.com/api/v1'
UA = {'User-Agent': 'blender-asset-fetch'}


def get(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120).read()


def main():
    meta = json.load(open(os.path.join(ROOT, 'assets.json'), encoding='utf-8'))
    for key, m in meta.items():
        d = os.path.join(ROOT, key)
        target = os.path.join(d, m['file'] + '.blend')
        if os.path.exists(target) and '--force' not in sys.argv:
            print('ok  ', key)
            continue
        r = json.loads(get(f"{API}/search/?query=asset_base_id:{m['id']}"))['results'][0]
        files = {f['fileType']: f['downloadUrl'] for f in r['files']}
        j = json.loads(get(files[m['file']] + '?scene_uuid=00000000-0000-0000-0000-000000000000'))
        os.makedirs(d, exist_ok=True)
        data = get(j['filePath'])
        open(target, 'wb').write(data)
        print('got ', key, len(data) // 1024, 'KB', '-', m['name'], '/', m['license'], '/', m['author'])


if __name__ == '__main__':
    main()
