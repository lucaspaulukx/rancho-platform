"""Port the pinned Rancher image's registration helpers to Python 3."""

import re
from pathlib import Path

modules = Path("/usr/local/lib/python3.12/dist-packages")
gdapi = modules / "gdapi.py"
source = gdapi.read_text(encoding="utf-8")
if source.count("vars(value).iteritems()") != 1:
    raise ValueError("Unexpected gdapi serialization code")
gdapi.write_text(source.replace("vars(value).iteritems()", "vars(value).items()"), encoding="utf-8")

for helper in (Path("/register.py"), Path("/resolve_url.py")):
    source = helper.read_text(encoding="utf-8")
    if not source.startswith("#!/usr/bin/env python\n"):
        raise ValueError(f"Unexpected interpreter in {helper}")
    source = source.replace("#!/usr/bin/env python\n", "#!/usr/bin/env python3\n", 1)
    source = re.sub(r"(?m)^([ \t]*)print (.+)$", r"\1print(\2)", source)
    source = re.sub(r"(client\.list_\w+\([^\n)]*\))", r"\1.data", source)
    if helper.name == "register.py":
        source = source.replace("import logging", "import logging\nfrom shlex import quote", 1)
        source = source.replace("format(r.accessKey)", "format(quote(r.accessKey))")
        source = source.replace("format(r.secretKey)", "format(quote(r.secretKey))")
    helper.write_text(source, encoding="utf-8")
