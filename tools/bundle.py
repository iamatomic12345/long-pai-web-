"""Unpack / repack the JS sources embedded in "long pai (standalone).html".

The standalone HTML keeps every script in <script type="__bundler/manifest">
as JSON: { uuid: { mime, compressed, data } }, where data is base64 of the
(optionally gzipped) file. This tool extracts the script entries to a working
folder and writes edited ones back under the same uuid, in the same format.

Usage:
  py -I tools/bundle.py unpack <html> <workdir>
  py -I tools/bundle.py pack   <html> <workdir>

pack only touches entries whose decoded content differs from the workdir file,
replacing just that entry's base64 string so the rest of the HTML is unchanged.
"""
import base64
import gzip
import json
import pathlib
import sys

MANIFEST_OPEN = '<script type="__bundler/manifest">'
SCRIPT_MIMES = {"application/javascript", "text/javascript", "text/jsx"}


def read_manifest(html):
    start = html.index(MANIFEST_OPEN) + len(MANIFEST_OPEN)
    end = html.index("</script>", start)
    return json.loads(html[start:end]), start, end


def decode(entry):
    raw = base64.b64decode(entry["data"])
    return gzip.decompress(raw) if entry.get("compressed") else raw


def encode(content, compressed):
    raw = gzip.compress(content, mtime=0) if compressed else content
    return base64.b64encode(raw).decode("ascii")


def ext_for(mime):
    return ".jsx" if mime == "text/jsx" else ".js"


def unpack(html_path, workdir):
    html = html_path.read_text(encoding="utf-8", newline="")
    manifest, _, _ = read_manifest(html)
    workdir.mkdir(parents=True, exist_ok=True)
    for uuid, entry in manifest.items():
        if entry["mime"] not in SCRIPT_MIMES:
            continue
        out = workdir / (uuid + ext_for(entry["mime"]))
        out.write_bytes(decode(entry))
        first = out.read_text(encoding="utf-8", errors="replace").lstrip()[:70].splitlines()[0]
        print(f"{out.name}  {first}")


def pack(html_path, workdir):
    html = html_path.read_text(encoding="utf-8", newline="")
    manifest, start, end = read_manifest(html)
    section = html[start:end]
    changed = 0
    for uuid, entry in manifest.items():
        if entry["mime"] not in SCRIPT_MIMES:
            continue
        src = workdir / (uuid + ext_for(entry["mime"]))
        if not src.exists():
            continue
        content = src.read_bytes()
        if content == decode(entry):
            continue
        old = entry["data"]
        new = encode(content, entry.get("compressed"))
        if section.count(old) != 1:
            sys.exit(f"cannot uniquely locate data for {uuid}")
        section = section.replace(old, new)
        changed += 1
        print(f"packed {src.name}")
    json.loads(section)  # sanity check: manifest is still valid JSON
    html_path.write_text(html[:start] + section + html[end:], encoding="utf-8", newline="")
    print(f"{changed} file(s) updated")


if __name__ == "__main__":
    if len(sys.argv) != 4 or sys.argv[1] not in ("unpack", "pack"):
        sys.exit(__doc__)
    cmd, html_arg, dir_arg = sys.argv[1:]
    (unpack if cmd == "unpack" else pack)(pathlib.Path(html_arg), pathlib.Path(dir_arg))
