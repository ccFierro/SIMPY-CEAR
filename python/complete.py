"""Autocompletado aislado del servidor y del kernel de las celdas."""
import json
import sys

import jedi
from jedi.api.environment import InterpreterEnvironment


def main():
    data = json.load(sys.stdin)
    source = str(data.get("source", ""))[:200000]
    script = jedi.Script(source, environment=InterpreterEnvironment())
    items = script.complete(int(data["line"]), int(data["column"]))
    print(json.dumps({"items": [
        {"name": item.name, "complete": item.complete, "type": item.type}
        for item in items[:100]
    ]}), flush=True)


if __name__ == "__main__":
    main()
