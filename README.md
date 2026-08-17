# OpenHarness Plugins

The curated source of plugin metadata for OpenHarness and DeepSeek Harness.
Each plugin has one directory and one descriptor:

```text
plugins/
  <plugin-name>/
    plugin.json
```

`plugin.json` is validated against
[`schemas/plugin-v1.schema.json`](./schemas/plugin-v1.schema.json). The directory
name must exactly match the descriptor's `name`.

## Catalog

The repository builds a deterministic, machine-readable catalog at:

```text
dist/catalog/v1/catalog.json
```

On every pull request, GitHub Actions validates all descriptors and runs the
catalog tests. A push to `main` deploys the generated `dist` directory to GitHub
Pages. The public endpoint is:

```text
https://microspotlight.github.io/openharness-plugins/catalog/v1/catalog.json
```

Run the same checks locally:

```sh
pnpm install
pnpm validate
pnpm test
pnpm build
```

## Trust model

Catalog entries are metadata, not an approval to execute code. Git-based
distributions must use an immutable 40-character commit SHA. Installation is a
separate, explicit host action initiated by the user.

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the descriptor fields and submission
workflow.

## License

Apache License 2.0.

