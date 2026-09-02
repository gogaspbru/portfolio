#!/usr/bin/env python3
"""
Build a single self-contained HTML file (scripts/standalone.html) with all
CSS, JS, works data, images, videos and logos inlined as data-URIs — so the
whole site can be opened from `file://` or shared as one file.

The page markup here is kept in sync with index.html. app.js reads
`window.__WORKS__` / `window.__LOGOS__` when present (this build injects them)
and otherwise falls back to fetching data/works.json.
"""
import os, json, base64, mimetypes, urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def read(p):
    with open(os.path.join(ROOT, p), encoding="utf-8") as f:
        return f.read()

def data_uri(relpath):
    """Return a data: URI for an asset. SVG is kept as utf8, everything else base64."""
    path = os.path.join(ROOT, relpath)
    ext = os.path.splitext(path)[1].lower()
    if ext == ".svg":
        with open(path, encoding="utf-8") as f:
            svg = f.read()
        return "data:image/svg+xml;utf8," + urllib.parse.quote(svg, safe="")
    mime = mimetypes.guess_type(path)[0] or "application/octet-stream"
    with open(path, "rb") as f:
        raw = f.read()
    return "data:%s;base64,%s" % (mime, base64.b64encode(raw).decode("ascii"))

def build():
    css = read("css/styles.css")
    app = read("js/app.js")
    works = json.loads(read("data/works.json"))

    # Inline every asset referenced by a work.
    for w in works:
        if w.get("preview") and not w["preview"].startswith("data:"):
            w["preview"] = data_uri(w["preview"])
        if w.get("video") and not w["video"].startswith("data:"):
            w["video"] = data_uri(w["video"])

    logos = []
    logo_dir = os.path.join(ROOT, "assets", "logos")
    for name in sorted(os.listdir(logo_dir)):
        if name.lower().endswith(".svg"):
            logos.append(data_uri(os.path.join("assets", "logos", name)))

    body = read("index.html")
    # Pull just the <body> inner markup out of index.html.
    start = body.find("<body>") + len("<body>")
    end = body.find("<script src=\"js/app.js\">")
    markup = body[start:end].strip()

    injected = (
        "window.__WORKS__ = " + json.dumps(works, ensure_ascii=False) + ";\n"
        "window.__LOGOS__ = " + json.dumps(logos, ensure_ascii=False) + ";\n"
    )

    out = (
        "<!doctype html>\n<html lang=\"ru\">\n<head>\n"
        "<meta charset=\"utf-8\">\n"
        "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n"
        "<title>Егор Сорокин &amp; Co — Портфолио</title>\n"
        "<style>\n" + css + "\n</style>\n</head>\n<body>\n"
        + markup + "\n"
        "<script>\n" + injected + app + "\n</script>\n"
        "</body>\n</html>\n"
    )

    out_path = os.path.join(ROOT, "scripts", "standalone.html")
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(out)
    print("Wrote %s (%.0f KB)" % (out_path, len(out.encode("utf-8")) / 1024))

if __name__ == "__main__":
    build()
