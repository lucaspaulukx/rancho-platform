"""Migrate the Cattle injection and lifecycle annotation descriptors for Spring 7."""

import os
from pathlib import Path
import struct
import sys
import zipfile


ANNOTATIONS = {
    b"Ljavax/inject/" + name + b";": b"Ljakarta/inject/" + name + b";"
    for name in (b"Inject", b"Named", b"Qualifier")
}
ANNOTATIONS.update({
    b"Ljavax/annotation/" + name + b";": b"Ljakarta/annotation/" + name + b";"
    for name in (b"PostConstruct", b"PreDestroy", b"Resource")
})

# Encoded sizes including the tag. Longs and doubles reserve two pool slots.
CONSTANT_SIZES = {
    3: 5, 4: 5, 5: 9, 6: 9, 7: 3, 8: 3, 9: 5, 10: 5, 11: 5,
    12: 5, 15: 4, 16: 3, 17: 5, 18: 5, 19: 3, 20: 3,
}


def migrate_class(data):
    if data[:4] != b"\xca\xfe\xba\xbe":
        raise ValueError("Invalid Java class header")
    remaining = struct.unpack_from(">H", data, 8)[0] - 1
    position = 10
    changes = []
    while remaining:
        tag = data[position]
        if tag == 1:
            length = struct.unpack_from(">H", data, position + 1)[0]
            end = position + 3 + length
            replacement = ANNOTATIONS.get(data[position + 3:end])
            if replacement:
                changes.append((position + 1, end, struct.pack(">H", len(replacement)) + replacement))
            position = end
        else:
            position += CONSTANT_SIZES[tag]
        remaining -= 2 if tag in (5, 6) else 1
    for start, end, replacement in reversed(changes):
        data = data[:start] + replacement + data[end:]
    return data, len(changes)


def migrate_jar(path):
    temporary = path.with_suffix(".tmp")
    try:
        changes = 0
        with zipfile.ZipFile(str(path)) as source, zipfile.ZipFile(str(temporary), "w") as target:
            names = source.namelist()
            if any(name.upper().startswith("META-INF/") and name.upper().endswith((".SF", ".RSA", ".DSA", ".EC")) for name in names):
                raise ValueError("Cannot rewrite a signed JAR: " + str(path))
            for entry in source.infolist():
                data = source.read(entry)
                if entry.filename.endswith(".class"):
                    data, count = migrate_class(data)
                    changes += count
                target.writestr(entry, data)
        if changes:
            os.replace(str(temporary), str(path))
        return changes
    finally:
        if temporary.exists():
            temporary.unlink()


def main():
    lib = Path(sys.argv[1])
    count = sum(migrate_jar(path) for path in sorted(lib.glob("cattle-*.jar")))
    if not count:
        raise RuntimeError("No Cattle annotations were migrated")
    print("Migrated {} Cattle annotation descriptors".format(count))


if __name__ == "__main__":
    main()
