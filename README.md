# talv-pdf

Source for [`@pdf-tlv/resume`](https://www.npmjs.com/package/@pdf-tlv/resume), a TypeScript library that renders PDF resumes from structured data and a declarative layout template. It is built on [pdf-lib](https://pdf-lib.js.org/) and powers resume export in [Talvio](https://talvio.co).

For installation, usage and the template format, see the [package README](packages/resume/README.md).

## Repository layout

| Path                         | Contents                                                            |
| ---------------------------- | ------------------------------------------------------------------- |
| `packages/resume/`           | The published package.                                              |
| `packages/resume/templates/` | Built-in templates: `talvio`, `ember` and `mint`.                   |
| `packages/resume/fixtures/`  | Sample resumes for previews and tests, including edge cases.        |
| `packages/resume/types/`     | Public types for resume data and templates.                         |
| `debt.md`                    | Known technical debt and its workarounds.                           |
| `playground/`                | Live preview for building templates. Not published.                 |
| `playground/templates/`      | Templates built and checked here but not released with the package. |
| `src/`                       | Re-exports the package for local use.                               |

## Development

The repo is a Yarn 4 workspace. You need Node.js 18 or later, because the library downloads custom fonts with the global `fetch`.

```sh
yarn install
cd packages/resume
yarn build
```

Run the unit tests from `packages/resume`:

```sh
yarn jest --rootDir . --preset ts-jest --testPathIgnorePatterns /dist/
```

## Template playground

The playground renders templates in the browser straight from the package source. Save a template, fixture or engine file and the preview updates in place, with no build step. It needs Node.js 20.19 or later, because it runs on Vite.

```sh
yarn playground
```

This opens `http://localhost:5173`. Pick a template, a fixture, fonts, an accent color and a type scale in the sidebar. The accent swatches are the colors offered in the Talvio web app. The fonts are either the built-in Helvetica, Times and Courier, Inter, or Inter with Source Serif 4 and IBM Plex Mono, downloaded from their publishers' releases. Your choices are kept in the URL, so you can bookmark or share a view. There are three views:

| View                     | Shows                                                                            |
| ------------------------ | -------------------------------------------------------------------------------- |
| One resume               | One template with one fixture, every page, at full size.                         |
| Template × every fixture | One template rendered with every fixture. Use it to catch overflow and clipping. |
| Fixture × every template | One fixture rendered with every template. Use it to compare templates.           |

To add a template to the package, create it in `packages/resume/templates/` and export it from `templates/index.ts`. To build one that is not released with the package, create it in `playground/templates/` and export it from `playground/templates/index.ts`. It shows up in the sidebar the same way, and the layout tests (`packages/resume/layout.spec.ts`) check it with every fixture. Import types from `../../packages/resume/types` there, so the tests can load it. `engineDemo` in that folder uses every engine option; check it after changing the engine. To add a fixture, create it in `packages/resume/fixtures/` and add it to the `fixtures` object in `fixtures/index.ts`. Both show up in the sidebar on save.

| Fixture                  | Checks                                                                                                                                                                                                                  |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `entry`, `mid`, `senior` | The sample resumes used for the template picker in the Talvio web app. `mid` and `senior` also have skill groups and a stack per role, and `senior` has headline achievements; `entry` has none, to show the fallbacks. |
| `minimal`                | Only `name` and `role`, so every optional section is empty.                                                                                                                                                             |
| `longText`               | Long names, titles, URLs and an unbroken word, to catch text that runs past its column.                                                                                                                                 |
| `multiPage`              | Enough experience to break across pages.                                                                                                                                                                                |
| `richText`               | Bold and italic runs, empty paragraphs and lists in rich-text descriptions.                                                                                                                                             |
| `international`          | Accented Latin, Greek and Cyrillic, plus Georgian, which the default font does not cover.                                                                                                                               |

## Releasing

Releases are published by GitHub Actions ([`.github/workflows/publish.yml`](.github/workflows/publish.yml)) when a pull request is merged into `main`.

1. In your PR, bump `version` in `packages/resume/package.json`.
2. Merge the PR. The workflow builds the package, runs the tests, publishes to npm with provenance, and pushes a `v<version>` tag.

If the version in `package.json` is already on npm, the workflow builds and tests but publishes nothing. You can also start it by hand from the Actions tab.

`yarn build` deletes `dist` before compiling, so files from deleted sources are never published. Test files (`*.spec.ts`) are excluded from the build.

### One-time npm setup

The workflow uses npm trusted publishing, so no npm token is stored in GitHub. On npmjs.com, open the `@pdf-tlv/resume` package settings and add a trusted publisher:

| Field                | Value          |
| -------------------- | -------------- |
| Publisher            | GitHub Actions |
| Organization or user | `mdivani`      |
| Repository           | `talv-pdf`     |
| Workflow filename    | `publish.yml`  |

## License

MIT
