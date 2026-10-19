"""Export the Architecture page as a shareable PDF and a single self-contained HTML file.

Renders the React UI's document view (web/dist, route #doc) in headless Google Chrome:
  * PDF  : Chrome's print-to-PDF (landscape Letter, vector diagrams).
  * HTML : the rendered DOM with the stylesheet inlined and all scripts removed, so the file
           opens anywhere (email attachment, browser) with no app, network or JavaScript.

Usage:  uv run python scripts/export_architecture.py   (after `make ui` if web/src changed)
Output: docs/export/Trusted-Data-Foundation-Architecture.{pdf,html}
"""

from __future__ import annotations

import functools
import http.server
import re
import subprocess
import threading
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "web" / "dist"
OUT = ROOT / "docs" / "export"
NAME = "Trusted-Data-Foundation-Architecture"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
TITLE = "Trusted Data Foundation: Architecture Proposal"


class _QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args) -> None:
        pass


def serve_dist() -> tuple[http.server.ThreadingHTTPServer, str]:
    handler = functools.partial(_QuietHandler, directory=str(DIST))
    httpd = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, f"http://127.0.0.1:{httpd.server_address[1]}/#doc"


def chrome(*args: str) -> subprocess.CompletedProcess:
    # 1100px window -> the 960px document column, matching the printable width of the PDF page.
    base = [CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run",
            "--window-size=1100,1600", "--virtual-time-budget=8000", "--force-color-profile=srgb"]
    return subprocess.run(base + list(args), capture_output=True, text=True, check=True)


def strip_dark_mode(css: str) -> str:
    """Remove `@media (prefers-color-scheme: dark) {...}` blocks so the shared doc is always light."""
    out, i = [], 0
    pattern = re.compile(r"@media\s*\(prefers-color-scheme:\s*dark\)\s*\{")
    while (m := pattern.search(css, i)):
        out.append(css[i:m.start()])
        depth, j = 1, m.end()
        while depth and j < len(css):
            depth += {"{": 1, "}": -1}.get(css[j], 0)
            j += 1
        i = j
    out.append(css[i:])
    return "".join(out)


def standalone_html(dom: str) -> str:
    css_href = re.search(r'<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"', dom).group(1)
    css = strip_dark_mode((DIST / css_href.lstrip("./")).read_text())
    html = re.sub(r"<script\b[^>]*>.*?</script>", "", dom, flags=re.S)
    html = re.sub(r'<link[^>]+rel="(stylesheet|modulepreload|icon)"[^>]*>', "", html)
    html = re.sub(r"<title>.*?</title>", f"<title>{TITLE}</title>", html, flags=re.S)
    # The diagram scale is baked in for the 960px column, so keep the column exactly that wide.
    extra = "body{margin:0} .doc{width:960px;max-width:none;padding:28px 24px 40px;box-sizing:content-box}"
    return html.replace("</head>", f"<style>{css}\n{extra}</style></head>", 1)


def main() -> None:
    if not (DIST / "index.html").exists():
        raise SystemExit("web/dist missing: run `make ui` first")
    OUT.mkdir(parents=True, exist_ok=True)
    httpd, url = serve_dist()
    try:
        pdf = OUT / f"{NAME}.pdf"
        chrome("--no-pdf-header-footer", f"--print-to-pdf={pdf}", url)
        dom = chrome("--dump-dom", url).stdout
    finally:
        httpd.shutdown()
    if "doc-head" not in dom:
        raise SystemExit("Document view did not render (no .doc-head in DOM)")
    html = OUT / f"{NAME}.html"
    html.write_text(standalone_html(dom))
    for f in (pdf, html):
        print(f"{f.relative_to(ROOT)}  {f.stat().st_size / 1024:.0f} KB")


if __name__ == "__main__":
    main()
