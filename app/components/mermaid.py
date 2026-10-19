"""Render Mermaid diagrams fully offline from the vendored mermaid.min.js."""

from functools import lru_cache
from html import escape
from pathlib import Path

import streamlit as st

STATIC = Path(__file__).resolve().parents[1] / "static"


@lru_cache(maxsize=1)
def _mermaid_js() -> str:
    return (STATIC / "mermaid.min.js").read_text()


def mermaid(source: str, height: int = 520) -> None:
    html = f"""
    <div class="mermaid" style="display:flex;justify-content:center">{escape(source)}</div>
    <script>{_mermaid_js()}</script>
    <script>
      const dark = window.parent?.matchMedia?.('(prefers-color-scheme: dark)').matches;
      mermaid.initialize({{startOnLoad: true, securityLevel: 'strict',
                          theme: dark ? 'dark' : 'neutral', themeVariables: {{fontSize: '22px'}},
                          flowchart: {{useMaxWidth: false, nodeSpacing: 30, rankSpacing: 40}}}});
    </script>"""
    st.iframe(html, height=height)  # trusted, repo-authored HTML only
