# Separate Moonraker endpoint for the OrcaSlicer CFS plugin

This is a patch-only contribution for Alberto DevLabs' **CFS 0.12.1** plugin.
It lets the CFS dock use Moonraker while OrcaSlicer keeps its native
**CrealityPrint** connection for print submission and colour mapping.

The plugin is distributed separately through OrcaCloud and the
[author's CFS page](https://albertodevlabs.it/en/software/cfs). Its Python source
is not part of ADL-Script. This directory provides the patch and tests for the
maintainer to apply to the plugin's actual source. It adds no ADL-Script install
step and does not install a second copy of the plugin.

## Problem and configuration

The plugin currently reuses the selected printer's `print_host` for Moonraker
requests. A native CrealityPrint profile can use a printer address on port 80,
while the same printer exposes Moonraker on port 7125. Changing the physical
printer to Octo/Klipper makes those requests work but changes Orca's native
submission and colour-mapping path.

An optional `moonraker_hosts` dictionary resolves this independently:

```json
{
  "moonraker_hosts": {
    "http://192.0.2.123": "http://192.0.2.123:7125"
  }
}
```

Merge that key into the existing CFS capability configuration. The address above
is a documentation-only example. Leave the physical printer's native
CrealityPrint connection configured as before. Save configuration through Orca's
**Plugins → Config → Save** so its live configuration store is updated.

Both alias keys and targets use the plugin's existing host normalization. A
valid selected host with no matching alias keeps its original URL. An invalid
matched target resolves to no connection. With a configured nonempty mapping,
a selected profile without an address clears the active endpoint instead of
reusing the preceding printer. Malformed nonempty mappings also fail closed.

The default mapping is empty. Existing direct Moonraker profiles keep their
selected address, and the legacy manually configured `host` fallback remains
available when no mapping or selected address exists.

## Material cache and switching

The existing `caricati` list is migrated under its saved host, resolved through
the alias map, into `caricati_per_host`. The active host's current in-memory list
takes precedence over an older saved list. Connection changes save `host`,
`caricati` and the per-host cache together through the existing configuration API.
An unchanged endpoint avoids repeated configuration writes.

Switching endpoints invalidates the active host before clearing the previous
spool status, project-material list, ADL result and retry/error state. It publishes
the new endpoint only after the replacement state is ready. The dock, script
execution, device-selection event, sync action and independent guide/materials
windows use the same resolver.

Workers check the captured endpoint after requests and before publishing results
or starting another material-registration request. Material workers retain their
captured state objects so late responses cannot modify the new printer's state.
An HTTP request already sent cannot be recalled; its late result is ignored and
further requests from that old batch stop. Moonraker API paths, G-code formatting,
material parameters and interface translations are unchanged.

## Applying and checking

The patch targets a source file named `cfs.py`. The unmodified 0.12.1 source used
to prepare it has SHA-256:

```text
d676e2da7ce145428e8a443ee31df05a7481347cf1a642cae0430ecf169da9bb
```

In a separate checkout containing that source:

```sh
git apply --check /path/to/connection-fix.patch
git apply /path/to/connection-fix.patch
python /path/to/test_connection.py --source ./cfs.py -v
```

The **13 offline tests** require Python 3.12+ and the patched source only. No
baseline copy, Orca module, third-party dependencies, running Orca instance or
printer connection is required. The tests extract the real class and pure
helpers through AST and supply isolated host/UI/network substitutes. A normalized
AST fingerprint verifies that code outside the connection changes remains the
same as the target release without distributing its baseline source.

Coverage includes URL normalization, defaults, invalid mappings, every GUI entry
point, separate material caches, repeated-refresh stability, A → B → empty
selection, preservation of already registered materials, late responses and a
forced interleaving between every connection-refresh line. The suite passed on
Orca's Python 3.12 and independently on Python 3.14.

Live validation separately confirmed a four-slot CFS dock whose colours and
remaining amounts matched Moonraker, and the native CrealityPrint mapping dialog
with four channels. That dialog was cancelled before submission; no file was
uploaded and no print was started for the check.

## Review scope

This contribution is separate from the existing Russian-interface proposal.
It contains no user configuration, account identifiers, printer backups, project
files or live verification receipts. The maintainer can move the patch into the
plugin's actual source repository or fold it into the next OrcaCloud release.
