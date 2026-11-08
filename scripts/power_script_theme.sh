#!/bin/sh

set -e

# Rosso ADL smorzato (colore principale del tema): il rosso del bordo del logo, #E10600, era troppo acceso.
POWER_THEME_COLOR="#B33A3A"

# Theme preset added to the Fluidd config.json (the file is merged, not replaced,
# so the presets of the installed Fluidd version and the Creality one are kept).
POWER_THEME_PRESETS='[{"name":"ADL","color":"#B33A3A","isDark":true,"logo":{"src":"logo_adl.svg"}}]'

function power_script_theme_message(){
  top_line
  title 'ADL Theme for Fluidd' "${yellow}"
  inner_line
  hr
  echo -e " │ ${cyan}Adds the ADL theme to Fluidd: the ADL logo in silver and red,  ${white}│"
  echo -e " │ ${cyan}the ADL red and the logo as the page background.               ${white}│"
  echo -e " │ ${cyan}It is selected by default. Your other Fluidd themes (including ${white}│"
  echo -e " │ ${cyan}Creality) are kept.                                            ${white}│"
  hr
  bottom_line
}

# Adds the ADL preset to the Fluidd config.json, keeping every other preset. I temi vecchi
# dello script ("Power Script" nella 1.1.6, poi "PowerUI") vengono sostituiti da ADL.
# Running it again does not duplicate anything.
function add_power_script_theme_preset(){
  local cfg="$FLUIDD_FOLDER/config.json"
  [ -f "$cfg" ] || return 1
  jq --argjson presets "$POWER_THEME_PRESETS" \
    '.themePresets = ((.themePresets // []) | map(select(.name != "Power Script" and .name != "PowerUI" and .name != "ADL")) + $presets)' \
    "$cfg" > "$cfg.tmp" && mv "$cfg.tmp" "$cfg"
}

# Makes the ADL theme the one Fluidd uses, through the Moonraker database
# where Fluidd stores its settings. The other theme settings are kept.
function select_power_script_theme(){
  local current new i
  # Moonraker may have just been restarted: wait for it for up to 15 seconds.
  for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15; do
    "$CURL" -s "localhost:7125/server/info" > /dev/null 2>&1 && break
    sleep 1
  done
  current=$("$CURL" -s "localhost:7125/server/database/item?namespace=fluidd&key=uiSettings.theme" 2>/dev/null | jq -c '.result.value // {}' 2>/dev/null) || current=""
  [ -n "$current" ] || current='{}'
  new=$(echo "$current" | jq -c --arg c "$POWER_THEME_COLOR" '. + {isDark: true, color: $c, logo: {src: "logo_adl.svg"}, backgroundLogo: true}')
  "$CURL" -s -X POST -H "Content-Type: application/json" \
    -d "{\"namespace\":\"fluidd\",\"key\":\"uiSettings.theme\",\"value\":$new}" \
    localhost:7125/server/database/item > /dev/null 2>&1
}

# Copies the logo. Fluidd shows the logo of the selected theme in the top bar and, with
# its own "background logo" setting on, as a faint watermark over the page.
function copy_power_script_theme_files(){
  cp "$FLUIDD_THEME_LOGO_URL" "$FLUIDD_THEME_LOGO_FILE"
}

# Installs the files, adds the preset and selects it. Used by the menu, by the reapply
# option and by the Fluidd installation, where it is the default theme
# ($1 is the word used in the final message).
function apply_power_script_theme(){
  local done_word="${1:-installed}"
  echo -e "${white}"
  echo -e "Info: Copying the ADL theme files..."
  copy_power_script_theme_files
  echo -e "Info: Adding the ADL theme to the Fluidd configuration..."
  if ! add_power_script_theme_preset; then
    error_msg "Unable to update the Fluidd config.json file!"
    return
  fi
  echo -e "Info: Selecting the ADL theme..."
  if select_power_script_theme; then
    ok_msg "ADL Theme for Fluidd has been ${done_word} successfully!"
    echo -e "   The ${yellow}ADL ${white}theme is now selected."
  else
    ok_msg "ADL Theme for Fluidd has been ${done_word} successfully!"
    echo -e "   Moonraker did not answer, select ${yellow}ADL ${white}in the Fluidd theme settings."
  fi
  echo -e "   Note: In some cases, it's necessary to clear your web browser's cache to see themes appear."
}

function install_power_script_theme(){
  power_script_theme_message
  local yn
  while true; do
    install_msg "ADL Theme for Fluidd" yn
    case "${yn}" in
      Y|y)
        apply_power_script_theme installed
        return;;
      N|n)
        error_msg "Installation canceled!"
        return;;
      *)
        error_msg "Please select a correct choice!";;
    esac
  done
}

# Offered by the Customize menu when the theme is already installed.
function reapply_power_script_theme(){
  power_script_theme_message
  echo -e " ${yellow}ADL Theme for Fluidd is already installed.${white}"
  echo
  local yn
  while true; do
    reapply_msg "ADL Theme for Fluidd" yn
    case "${yn}" in
      Y|y)
        apply_power_script_theme reapplied
        return;;
      N|n)
        error_msg "Reapply canceled!"
        return;;
      *)
        error_msg "Please select a correct choice!";;
    esac
  done
}
