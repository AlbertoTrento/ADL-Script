#!/bin/sh

set -e

if [ ! -f /etc/init.d/S58factoryreset ]; then
  cp /usr/data/helper-script/files/services/S58factoryreset /etc/init.d/S58factoryreset
  chmod 755 /etc/init.d/S58factoryreset
fi

# This script only supports the Creality K1 series (K1, K1C, K1 Max).
get_model=$( /usr/bin/get_sn_mac.sh model 2>&1 )
if echo "$get_model" | grep -iq "K1"; then
  model="K1"
else
  echo "This script only supports Creality K1 series printers (detected: ${get_model})."
  exit 1
fi

# Lo script e' fatto per il firmware CFS (versioni 2.x, con box.cfg). Su una stampante senza quel
# firmware (per esempio una scheda di ricambio che non lo accetta) molte voci non funzionano o
# possono fare danni: si avvisa e si chiede conferma prima di andare avanti. Una volta sola per
# installazione (il segno resta nella cartella dello script).
function firmware_version_found(){
  local file
  for file in /usr/data/creality/userdata/config/system_version.json \
              /usr/data/creality/userdata/config/system_config.json \
              /usr/data/creality/userdata/version /etc/version; do
    [ -f "$file" ] || continue
    grep -o '[0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*' "$file" 2>/dev/null | head -n 1 && return 0
  done
  return 0
}
cfs_check_marker="$(dirname "$(readlink -f "$0")")/.cfs_firmware_ok"
if [ ! -f "$cfs_check_marker" ]; then
  fw_version="$(firmware_version_found)"
  if [ -f /usr/data/printer_data/config/box.cfg ] && [ "${fw_version%%.*}" = "2" ]; then
    touch "$cfs_check_marker"
  else
    echo
    echo " WARNING: this script is made for the K1C with the CFS firmware (2.3.5.x)."
    echo " Detected firmware: ${fw_version:-unknown}, box.cfg: $([ -f /usr/data/printer_data/config/box.cfg ] && echo present || echo missing)."
    echo " Without the CFS firmware several options do not work and some can change files they should not."
    while true; do
      read -p " Continue anyway? (y/n): " cfs_yn
      case "$cfs_yn" in
        Y|y) touch "$cfs_check_marker"; break;;
        N|n) exit 0;;
      esac
    done
  fi
fi

function get_script_version() {
  local version
  cd "${HELPER_SCRIPT_FOLDER}"
  # Versione e numero di modifiche dopo l'ultima etichetta (v1.4.0, v1.4.0-1, v1.4.0-2...): ogni aggiornamento
  # cambia il numero. Si toglie solo la parte "-g<hash>" del commit.
  version="$(git describe HEAD --always --tags | sed 's/-g[0-9a-f]*$//')"
  echo "${cyan}${version}${white}"
}

function version_line() {
  local content="$1"
  local content_length="${#content}"
  local width=$((75))
  local padding_length=$((width - content_length - 3))
  printf " │ %*s%s%s\n" $padding_length '' "$content" " │"
}

function script_title() {
  echo "K1C"
}

function main_menu_ui() {
  top_line
  title "• ADL SCRIPT FOR CREALITY $(script_title) •" "${blue}"
  # Avviso di copyright richiesto dalla GPL v3: l'originale e' di Boris Fernandez.
  title "Based on CFS Power Script © Boris Fernandez - GPL v3" "${white}"
  inner_line
  title "/!\\ ONLY USE THIS SCRIPT WITH LATEST FIRMWARE VERSION /!\\" "${darkred}"
  inner_line
  hr
  main_menu_option '1' '[Install]' 'Menu'
  main_menu_option '2' '[Remove]' 'Menu'
  main_menu_option '3' '[Customize & PowerScreen]' 'Menu'
  main_menu_option '4' '[Backup & Restore]' 'Menu'
  main_menu_option '5' '[Tools]' 'Menu'
  main_menu_option '6' '[Information]' 'Menu'
  hr
  inner_line
  hr
  bottom_menu_option 'q' 'Exit' "${darkred}"
  hr
  version_line "$(get_script_version)"
  bottom_line
}

function main_menu() {
  clear
  main_menu_ui
  local main_menu_opt
  while true; do
    read -p "${white} Type your choice and validate with Enter: ${yellow}" main_menu_opt
    case "${main_menu_opt}" in
      1) clear
         install_menu_k1
         break;;
      2) clear
         remove_menu_k1
         break;;
      3) clear
         customize_menu_k1
         break;;
      4) clear
         backup_restore_menu
         break;;
      5) clear
         tools_menu_k1
         break;;
      6) clear
         info_menu_k1
         break;;
      Q|q)
         clear; exit 0;;
      *)
         error_msg "Please select a correct choice!";;
    esac
  done
  main_menu
}
