# talv-pdf

Source for [`@pdf-tlv/resume`](https://www.npmjs.com/package/@pdf-tlv/resume), a TypeScript library that renders PDF resumes from structured data and a declarative layout template. It is built on [pdf-lib](https://pdf-lib.js.org/) and powers resume export in [Talvio](https://talvio.co).

For installation, usage and the template format, see the [package README](packages/resume/README.md).

## Repository layout

| Path | Contents |
| --- | --- |
| `packages/resume/` | The published package. |
| `packages/resume/templates/` | Built-in templates: `talvio`, `ember` and `mint`. |
| `packages/resume/types/` | Public types for resume data and templates. |
| `debt.md` | Known technical debt and its workarounds. |
| `src/` | Re-exports the package for local use. |

## Development

The repo is a Yarn 4 workspace. You need Node.js 18 or later, because the library loads fonts with the global `fetch`.

```sh
yarn install
cd packages/resume
yarn build
```

Run the unit tests from `packages/resume`:

```sh
yarn jest --rootDir . --preset ts-jest --testPathIgnorePatterns /dist/
```

## Releasing

Releases are published by GitHub Actions ([`.github/workflows/publish.yml`](.github/workflows/publish.yml)) when a pull request is merged into `main`.

1. In your PR, bump `version` in `packages/resume/package.json`.
2. Merge the PR. The workflow builds the package, runs the tests, publishes to npm with provenance, and pushes a `v<version>` tag.

If the version in `package.json` is already on npm, the workflow builds and tests but publishes nothing. You can also start it by hand from the Actions tab.

`yarn build` deletes `dist` before compiling, so files from deleted sources are never published. Test files (`*.spec.ts`) are excluded from the build.

### One-time npm setup

The workflow uses npm trusted publishing, so no npm token is stored in GitHub. On npmjs.com, open the `@pdf-tlv/resume` package settings and add a trusted publisher:

| Field | Value |
| --- | --- |
| Publisher | GitHub Actions |
| Organization or user | `mdivani` |
| Repository | `talv-pdf` |
| Workflow filename | `publish.yml` |

## License

MIT
