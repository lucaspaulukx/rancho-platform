"""Configure both packaged servlet descriptors for the single-node backend."""

import re
from pathlib import Path


def configure(path):
    with path.open("r", encoding="latin-1", newline="") as source:
        xml = source.read()
    xml, context_count = re.subn(
        r"(?m)^ *<context-param>\s*<param-name>contextClass</param-name>.*?</context-param>[ \t]*\r?\n",
        "",
        xml,
        count=1,
        flags=re.DOTALL,
    )
    xml, metrics_count = re.subn(
        r"(?m)^ *<listener>\s*<listener-class>com\.ryantenney\.metrics\.spring\.servlets\.MetricsServletsContextListener</listener-class>\s*</listener>[ \t]*\r?\n",
        "",
        xml,
        count=1,
    )
    listener = "org.springframework.web.context.ContextLoaderListener"
    if context_count != 1 or metrics_count != 1 or xml.count(listener) != 1:
        raise RuntimeError("Unexpected servlet descriptor structure: " + str(path))
    xml = xml.replace(listener, "io.cattle.platform.spring.web.ServletApplicationContext")
    with path.open("w", encoding="latin-1", newline="") as target:
        target.write(xml)


for descriptor in ("WEB-INF/web.xml", "WEB-INF/content/WEB-INF/web.xml"):
    configure(Path("/opt/war") / descriptor)
