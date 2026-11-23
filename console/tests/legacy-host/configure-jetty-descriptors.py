"""Keep the packaged servlet defaults while moving compression to Jetty 12."""

from pathlib import Path
import re


def configure(path):
    with path.open("r", encoding="latin-1", newline="") as source:
        content = source.read()
    content, removed = re.subn(
        r"(?ms)^ *<(filter|filter-mapping)>\s*<filter-name>GzipFilter</filter-name>.*?</\1>[ \t]*\r?\n",
        "",
        content,
    )
    if removed != 2:
        raise RuntimeError("Unexpected legacy compression configuration: " + str(path))
    content = content.replace("org.eclipse.jetty.servlet.", "org.eclipse.jetty.ee8.servlet.")
    with path.open("w", encoding="latin-1", newline="") as target:
        target.write(content)


for folder in ("WEB-INF", "WEB-INF/content/WEB-INF"):
    configure(Path("/opt/war") / folder / "default-web.xml")
