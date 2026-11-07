# Russian translation for the separate OrcaSlicer CFS plugin

`cfs-0.12.1-ru.patch` is a localization contribution for Alberto DevLabs' **CFS
0.12.1** OrcaSlicer plugin (OrcaCloud plugin ID
`37bf23f5-c729-4bd0-83ad-8125f4bd0ec8`). It accompanies the Fluidd CFS translation
because both interfaces are maintained by the same author.

The Orca plugin is distributed separately through
[OrcaCloud](https://cloud.orcaslicer.com/app/plugins/plugin-hub/37bf23f5-c729-4bd0-83ad-8125f4bd0ec8)
and the [author's CFS page](https://albertodevlabs.it/en/software/cfs). Its Python
source is not part of ADL-Script. This patch is provided for the maintainer to
apply to that source; the ADL-Script installer does not install or apply it.

The patch targets the source filename `cfs.py`. The unmodified source used to
prepare it has SHA-256:

```text
d676e2da7ce145428e8a443ee31df05a7481347cf1a642cae0430ecf169da9bb
```

In a separate checkout containing that version of `cfs.py`, the maintainer can
review applicability with:

```sh
git apply --check /path/to/cfs-0.12.1-ru.patch
```

Russian covers the spool panel, guide/settings, custom-materials window and
plugin-owned sync text. It follows OrcaSlicer's Russian language, with an explicit
`lingua: "ru"` override available in the existing plugin settings. Other supported
languages and the English fallback are preserved.

The existing optional function that customizes Orca's sync labels gains Russian
strings. Preparing and validating this patch does not run that function or modify
Orca's translation files. Moonraker requests, G-code, material data and response
parsing are outside the translation changes.

This directory deliberately includes only the translation diff, rather than a
second vendored copy of the entire separately distributed plugin.

## Offline checks

The checks parse the original and translated source without importing the plugin.
They verify Russian language routing, translation keys and placeholders, preservation
of existing languages and non-UI Python logic, and the three embedded JavaScript
interfaces with a mocked Orca API. The optional native translation-file helper is
tested in memory. Nothing connects to a printer or writes an Orca installation.

With Python 3.12+ and Node.js available:

```sh
python test_translation.py --baseline /path/to/original-cfs.py --translated /path/to/translated-cfs.py
```
