# V2 Mutation Formatting

Core V2 owns formatting. Each open Location has one `Formatter` service, one effective catalog, and one discovery generation. It imports no V1 or Slopcode runtime formatter code. There is no public formatter route, SDK model, command, or UI in H5E1.

## Effective Configuration

`Config.entries()` is folded from lowest to highest priority. Omitted `formatter` values retain the prior value. A boolean replaces all prior formatter state; `false` disables formatting and `true` enables the built-ins. An object enables a fresh object after a boolean and otherwise deep-merges consecutive objects. Entry fields merge, environment keys merge, and command and extension arrays replace rather than concatenate.

Built-ins keep fixed catalog order. Custom entries follow in first-seen property order, retain that slot across overrides, and disappear when disabled. `disabled: false` re-enables an entry. Empty command arguments, unsafe environment strings, and custom entries without a command or extensions are rejected as safe unavailable configuration. Disabling either `ruff` or `uv` removes both entries; when enabled, discovered ruff takes precedence over uv.

Configuration uses public names, including `clang-format`, `air`, and `uv`, rather than V1 export identifiers `clang`, `rlang`, and `uvformat`.

## Catalog

| Name             | Extensions                                      | Discovery                                    | Arguments after executable |
| ---------------- | ----------------------------------------------- | -------------------------------------------- | -------------------------- |
| `gofmt`          | `.go`                                           | PATH                                         | `-w $FILE`                 |
| `mix`            | `.ex .exs .eex .heex .leex .neex .sface`        | PATH                                         | `format $FILE`             |
| `prettier`       | JS/TS, web, data, markup list                   | package dependency, npm binary               | `--write $FILE`            |
| `oxfmt`          | `.js .jsx .mjs .cjs .ts .tsx .mts .cts`         | runtime flag, package dependency, npm binary | `$FILE`                    |
| `biome`          | prettier list                                   | `biome.json`/`biome.jsonc`, npm binary       | `format --write $FILE`     |
| `zig`            | `.zig .zon`                                     | PATH                                         | `fmt $FILE`                |
| `clang-format`   | C/C++/Arduino list, including uppercase `.C .H` | `.clang-format`, PATH                        | `-i $FILE`                 |
| `ktlint`         | `.kt .kts`                                      | PATH                                         | `-F $FILE`                 |
| `ruff`           | `.py .pyi`                                      | PATH, config/dependency evidence             | `format $FILE`             |
| `air`            | `.R`                                            | PATH and bounded help probe                  | `format $FILE`             |
| `uv`             | `.py .pyi`                                      | no ruff, PATH and bounded help probe         | `format -- $FILE`          |
| `rubocop`        | `.rb .rake .gemspec .ru`                        | PATH                                         | `--autocorrect $FILE`      |
| `standardrb`     | `.rb .rake .gemspec .ru`                        | PATH                                         | `--fix $FILE`              |
| `htmlbeautifier` | `.erb .html.erb`                                | PATH                                         | `$FILE`                    |
| `dart`           | `.dart`                                         | PATH                                         | `format $FILE`             |
| `ocamlformat`    | `.ml .mli`                                      | PATH and `.ocamlformat`                      | `-i $FILE`                 |
| `terraform`      | `.tf .tfvars`                                   | PATH                                         | `fmt $FILE`                |
| `latexindent`    | `.tex`                                          | PATH                                         | `-w -s $FILE`              |
| `gleam`          | `.gleam`                                        | PATH                                         | `format $FILE`             |
| `shfmt`          | `.sh .bash`                                     | PATH                                         | `-w $FILE`                 |
| `nixfmt`         | `.nix`                                          | PATH                                         | `$FILE`                    |
| `rustfmt`        | `.rs`                                           | PATH                                         | `$FILE`                    |
| `pint`           | `.php`                                          | Composer dependency                          | `./vendor/bin/pint $FILE`  |
| `ormolu`         | `.hs`                                           | PATH                                         | `-i $FILE`                 |
| `cljfmt`         | `.clj .cljs .cljc .edn`                         | PATH                                         | `fix --quiet $FILE`        |
| `dfmt`           | `.d`                                            | PATH                                         | `-i $FILE`                 |

The prettier/biome list is `.js .jsx .mjs .cjs .ts .tsx .mts .cts .html .htm .css .scss .sass .less .vue .svelte .json .jsonc .yaml .yml .toml .xml .md .mdx .graphql .gql`. Matching uses exact case-sensitive `path.extname`. Consequently `.html.erb` remains a compatibility entry but matches as `.erb`. Upward searches stop at the active project's boundary. Prettier, oxfmt, and biome set `BUN_BE_BUN=1`. Oxfmt uses the runtime-readable `SLOPCODE_EXPERIMENTAL_OXFMT` flag with `SLOPCODE_EXPERIMENTAL` inheritance. Ruff checks `pyproject.toml`, `ruff.toml`, `.ruff.toml`, then dependency content in `requirements.txt`, `pyproject.toml`, and `Pipfile`.

## Discovery And Execution

Discovery is lazy and only starts for matching extensions. A successful argv is cached for the Location generation. Negative discovery is not cached. Concurrent discovery for one entry shares a deferred result; interruption or defect completes that deferred and cannot strand waiters. Closing/reopening the Location destroys the catalog, positive cache, pending discovery, and status generation.

Matching availability checks may run concurrently, but results and executions retain catalog order. Formatters execute sequentially. `list()` and `status()` expose only public name, extensions, configured/available state, and a bounded availability code. They never expose executable paths, argv, environment, or process output.

Execution uses direct `ChildProcess` argv with no implicit shell. During post-mutation settlement, every literal `$FILE` in every argument becomes a private hidden same-basename-derived, same-extension stage, never the live pathname; a target is not appended when no placeholder exists. Internal targets stage beside the approved target for nearest-config parity. External targets stage under the verified active Location root, so external configuration and plugins cannot load while active Location configuration still applies. Linux exposes the verified parent as `/proc/<owner-pid>/fd/<dirfd>/<stage>`. Darwin does not pass the parent process's non-inherited `/dev/fd`: it passes an unpredictable canonical same-directory path while retaining no-follow parent/stage handles and performs pre/post parent and inode verification. A real child-process test proves stage access and target-directory config visibility, then proves parent substitution fails stale without mutating the replacement directory. Real Prettier coverage proves both internal nearest `.prettierrc` behavior and external malicious-plugin isolation. The stage contains the primitive's immediate bytes without an arbitrary size failure and is removed identity-conditionally after success, expected failure, acquisition failure, defect, interruption, or Location shutdown. Process cwd and Core discovery roots remain the active Location. Child environment extends the inherited environment, then applies built-in and configured values without mutating `process.env`.

PATH-based discovery stores and executes the exact resolved executable path. In particular, ruff and ocamlformat do not discard the resolved path and cannot be redirected by a later `PATH` change. Successful argv remains cached only for the current Location generation.

Discovery probes time out after 10 seconds. Each formatter attempt times out after 120 seconds. Stdout and stderr are drained while retaining at most 64 KiB each. Internal outcomes retain only `formatted`, `unavailable`, `spawn-error`, `timeout`, or `nonzero`, optional exit code, byte counts, and truncation flags. Absence, failed probes, spawn errors, timeout, and nonzero exit are nonfatal. Defects and interruption remain defects/interruption. Scoped process cleanup terminates and awaits the process tree on supported platforms; descendant cleanup is tested on the current platform.

Ruff discovery accepts independent evidence from `[tool.ruff]` in `pyproject.toml`, `ruff.toml`, `.ruff.toml`, or references in `requirements.txt`, `pyproject.toml`, and `Pipfile`. Each route has isolated execution coverage. Malformed package manifests and timed-out startup probes remain unavailable rather than failing Location startup. Closing a Location interrupts in-flight discovery and a reopened Location starts a fresh generation without adopting stale deferred or executable state.

## V1 Deviations

- Core owns the service instead of delegating to V1.
- Public config names remove V1 export-key ambiguity.
- Every placeholder is replaced, rather than only one occurrence.
- Discovery and execution have explicit time/output bounds and process-tree cleanup.
- Direct mutations publish one final deduplicated event after formatting.
- Availability checks may be concurrent as a scheduling detail, while execution remains ordered.
- No documented-only `cargofmt`, aliases, glob/basename/shebang matching, or language detection is added.

Post-mutation ordering, event ownership, BOM policy, and runtime fencing are defined in [mutation.md](./mutation.md).
