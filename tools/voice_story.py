"""Narrator lines for story scenes, read by Qwen3-TTS VoiceClone in a local ComfyUI.

  python -I tools/voice_story.py src/data/voice/prologue.json            # every line that has no recording yet
  python -I tools/voice_story.py src/data/voice/prologue.json --only 3 7 # re-record these lines (1-based)

Needs ComfyUI on http://127.0.0.1:8188 with the FB_Qwen3TTSVoiceClone node and a workflow exported in API format
(node "1" = the voice clone, node "3" = SaveAudio, its LoadAudio's reference file in ComfyUI's input folder).
The workflow is not in the repo (it points at a private voice sample): pass it with STORY_VOICE_WORKFLOW
(default: the path used on Mateusz's machine). ffmpeg from PATH or FFMPEG.

Writes assets/story/voice/<id>.mp3 (mono, 44.1 kHz, silence trimmed, loudness evened out). The subtitles
come from the same JSON (src/data/story.ts builds the scene from it).
"""
import json, os, shutil, subprocess, sys, tempfile, time, urllib.parse, urllib.request, uuid
from pathlib import Path

GAME = Path(__file__).resolve().parent.parent
API = os.environ.get('COMFY_API', 'http://127.0.0.1:8188')
WORKFLOW = Path(os.environ.get('STORY_VOICE_WORKFLOW', r'C:\Users\mateu\Music\qwen3tts_1.7B_voiceclone (3).json'))
FFMPEG = os.environ.get('FFMPEG') or shutil.which('ffmpeg') or 'ffmpeg'
OUT = GAME / 'assets' / 'story' / 'voice'


def http(path, data=None):
    req = urllib.request.Request(API + path, data=None if data is None else json.dumps(data).encode(),
                                 headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=900) as r:
        return r.read()


def record(wf_base, text, prefix, seed):
    wf = json.loads(json.dumps(wf_base))
    wf['1']['inputs']['target_text'] = text
    wf['1']['inputs']['seed'] = seed            # a new seed = a new take (ComfyUI caches identical prompts)
    wf['3']['inputs']['filename_prefix'] = prefix
    wf.pop('2', None)                           # no PreviewAudio
    pid = json.loads(http('/prompt', {'prompt': wf, 'client_id': str(uuid.uuid4())}))['prompt_id']
    while True:
        h = json.loads(http('/history/' + pid))
        if pid in h:
            st = h[pid].get('status', {})
            if st.get('status_str') == 'error':
                raise RuntimeError(json.dumps(st.get('messages', ''))[:600])
            audio = h[pid].get('outputs', {}).get('3', {}).get('audio')
            if audio:
                a = audio[0]
                q = urllib.parse.urlencode({'filename': a['filename'], 'subfolder': a.get('subfolder', ''), 'type': a.get('type', 'output')})
                return http('/view?' + q)
        time.sleep(1.0)


def encode(raw, dst):
    with tempfile.TemporaryDirectory() as tmp:
        src = Path(tmp) / 'take.flac'
        src.write_bytes(raw)
        # trim silence at both ends (keep a short breath), even out loudness, quiet mono mp3
        flt = ('silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.05,'
               'areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.12,areverse,'
               'loudnorm=I=-18:TP=-2:LRA=9')
        subprocess.run([FFMPEG, '-y', '-hide_banner', '-loglevel', 'error', '-i', str(src), '-af', flt,
                        '-ac', '1', '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '96k', str(dst)], check=True)


def main():
    args = sys.argv[1:]
    if not args:
        sys.exit(__doc__)
    cfg = json.loads(Path(args[0]).read_text(encoding='utf-8'))
    only = [int(a) for a in args[args.index('--only') + 1:]] if '--only' in args else None
    wf = json.loads(WORKFLOW.read_text(encoding='utf-8'))
    OUT.mkdir(parents=True, exist_ok=True)
    for i, line in enumerate(cfg['lines'], 1):
        dst = OUT / f"{line['id']}.mp3"
        if (only is None and dst.exists()) or (only is not None and i not in only):
            continue
        t0 = time.time()
        seed = (int(time.time() * 1000) + i) % 2**48
        encode(record(wf, line['text'], f"story/{line['id']}", seed), dst)
        print(f"{i:2d} {line['id']} {time.time() - t0:.0f}s", flush=True)


if __name__ == '__main__':
    main()
