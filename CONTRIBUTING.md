# Contributing a plugin

Create `plugins/<plugin-name>/plugin.json` and validate it against
`schemas/plugin-v1.schema.json`. The folder name and descriptor `name` must be
identical, lowercase, and kebab-cased.

The descriptor records:

- identity, version, display copy, publisher, authors, and license;
- repository, homepage, and an immutable npm or Git distribution;
- compatible DSH/OpenHarness versions, profiles, and platforms;
- controlled categories and capabilities;
- declared network, filesystem, environment, and command permissions;
- optional localized display copy.

For Git distributions, `distribution.ref` must be the exact 40-character commit
SHA to install. Branch names and tags are intentionally rejected. For npm
distributions, `version` is combined with `distribution.package` to form the
exact package version.

Before opening a pull request, run:

```sh
pnpm install
pnpm validate
pnpm test
pnpm build
```

Changes to existing plugin versions should update both `version` and the pinned
distribution. Reviewers should verify that declared permissions match the code
at that immutable source revision.

