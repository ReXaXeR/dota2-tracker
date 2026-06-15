; build-resources/installer.nsh
!include "LogicLib.nsh"

!macro customInit
  nsExec::Exec 'taskkill /F /IM "Dota 2 Tracker.exe" /T'
  nsExec::Exec 'taskkill /F /IM node.exe /FI "WINDOWTITLE eq dota2-tracker*"'
!macroend

!macro customInstall
  Push $R0
  Push $R1
  Push $R2
  Push $R3

  StrCpy $R0 ""

  ; 1) Реестр Steam
  ReadRegStr $R1 HKLM "SOFTWARE\WOW6432Node\Valve\Steam" "InstallPath"
  ${If} $R1 == ""
    ReadRegStr $R1 HKCU "Software\Valve\Steam" "SteamPath"
  ${EndIf}
  ${If} $R1 != ""
    IfFileExists "$R1\steamapps\common\dota 2 beta\game\dota\*.*" 0 +2
      StrCpy $R0 "$R1\steamapps\common\dota 2 beta"
  ${EndIf}

  ; 2) Перебор дисков C:–Z: с типовыми путями
  ${If} $R0 == ""
    StrCpy $R3 67 ; 'C'
    loopDisks:
      IntFmt $R2 "%c" $R3

      IfFileExists "$R2:\SteamLibrary\steamapps\common\dota 2 beta\game\dota\*.*" 0 +2
        StrCpy $R0 "$R2:\SteamLibrary\steamapps\common\dota 2 beta"
      ${If} $R0 != "" 
        Goto disksDone
      ${EndIf}

      IfFileExists "$R2:\Steam\steamapps\common\dota 2 beta\game\dota\*.*" 0 +2
        StrCpy $R0 "$R2:\Steam\steamapps\common\dota 2 beta"
      ${If} $R0 != ""
        Goto disksDone
      ${EndIf}

      IfFileExists "$R2:\Program Files (x86)\Steam\steamapps\common\dota 2 beta\game\dota\*.*" 0 +2
        StrCpy $R0 "$R2:\Program Files (x86)\Steam\steamapps\common\dota 2 beta"
      ${If} $R0 != ""
        Goto disksDone
      ${EndIf}

      IntOp $R3 $R3 + 1
      IntCmp $R3 91 disksDone disksDone loopDisks
    disksDone:
  ${EndIf}

  ; Копируем GSI-конфиг
  ${If} $R0 != ""
    CreateDirectory "$R0\game\dota\cfg\gamestate_integration"
    CopyFiles /SILENT "$INSTDIR\resources\gamestate_integration_dota2tracker.cfg" "$R0\game\dota\cfg\gamestate_integration\gamestate_integration_dota2tracker.cfg"
    DetailPrint "GSI-конфиг установлен: $R0"
    WriteRegStr HKCU "Software\Dota2Tracker" "Dota2Path" "$R0"
  ${Else}
    DetailPrint "Dota 2 не найдена — скопируй GSI-конфиг вручную (см. README)"
  ${EndIf}

  Pop $R3
  Pop $R2
  Pop $R1
  Pop $R0
!macroend

!macro customUnInit
  nsExec::Exec 'taskkill /F /IM "Dota 2 Tracker.exe" /T'
!macroend

!macro customUnInstall
  MessageBox MB_YESNO|MB_ICONQUESTION \
    "Удалить также сохранённые настройки и API-токен?$\r$\n$\r$\nЕсли планируешь переустановить — выбери «Нет»." \
    IDYES deleteData IDNO skipData

  deleteData:
    RMDir /r "$APPDATA\dota2-tracker"
    RMDir /r "$APPDATA\Dota 2 Tracker"
    Goto doneData

  skipData:
    DetailPrint "Данные сохранены в $APPDATA\dota2-tracker"

  doneData:
    ReadRegStr $0 HKCU "Software\Dota2Tracker" "Dota2Path"
    ${If} $0 != ""
      Delete "$0\game\dota\cfg\gamestate_integration\gamestate_integration_dota2tracker.cfg"
    ${EndIf}
    DeleteRegKey HKCU "Software\Dota2Tracker"
!macroend
