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

1. Update `version` in `packages/resume/package.json`.
2. Log in to npm with `yarn npm login` if you haven't already.
3. From `packages/resume`, run `yarn run publish`. It builds the package and publishes it publicly.

`yarn build` deletes `dist` before compiling, so files from deleted sources are never published. Test files (`*.spec.ts`) are excluded from the build.

## License

MIT
