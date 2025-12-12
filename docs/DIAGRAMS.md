# Diagrams

This folder contains sequence diagrams for core flows. Files are PlantUML (`.puml`).

Files:

- `docs/diagrams/auth.puml` — Authentication flows (register, login, refresh token).

Render instructions (Windows - cmd):

1. Using PlantUML jar (Java required):

```
java -jar plantuml.jar docs/diagrams/auth.puml
```

2. Using Docker (adjust the host path):

```
docker run --rm -v "%CD%":/workspace plantuml/plantuml -tpng /workspace/docs/diagrams/auth.puml
```

3. VSCode: install the "PlantUML" extension — you can preview and export diagrams directly.

Notes:
- Each diagram includes references to the main files (controller/service/repository) used in the flow.
- If you want, I can render PNG/SVG and add them to `docs/diagrams/png/`.
