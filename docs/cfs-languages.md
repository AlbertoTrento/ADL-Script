# CFS card languages

The Fluidd CFS card supports English and Russian. On first use it follows the
page's language (`<html lang>`) or, if absent, the browser's language. Other
languages fall back to English.

Use **RU** or **EN** in the card header to switch immediately. The choice is saved
in the existing `power-cfs-panel` browser preference, alongside the card's position
and collapsed state. It is specific to that browser and does not change Fluidd's
own language.

Russian covers the card, spool editor, custom-filament form and diagnostics
dialog. Material brands, names and identifiers, firmware commands and responses
retain their original values. The custom-filament database still requires Latin
letters in brand and name fields; a translated interface does not change that
firmware constraint.

Changing language sends no commands to the printer. SSH menus, ADL Screen and
Creality Print are outside this translation. Installing the updated card uses the
existing **Customize & PowerScreen → Fluidd CFS Panel** menu item; the language
feature adds no dependency or installer action.

## OrcaSlicer CFS plugin

The separate OrcaSlicer plugin also has a [Russian translation patch](contributions/orca-cfs-russian/README.md)
for its maintainer. It is not installed by ADL-Script and is kept separate from the
Fluidd card implementation.

## Validation

Run the browser-independent checks with Node.js:

```sh
node --check files/fluidd-cfs-panel/power-cfs-panel.js
node --test tests/cfs-language.test.cjs
```

Tests use a mocked DOM and mocked Moonraker responses. They check language
selection, saved preferences and command parity between English and Russian;
they do not contact or move a physical printer.
