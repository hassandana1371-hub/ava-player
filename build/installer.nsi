; Direct NSIS build for Linux hosts; no Wine is required.
Unicode true
!include "MUI2.nsh"
Name "AVA Player"
OutFile "${OUT_FILE}"
InstallDir "$LOCALAPPDATA\Programs\AVA Player"
InstallDirRegKey HKCU "Software\AVA Player" "InstallDir"
RequestExecutionLevel user
SetCompressor /SOLID lzma
!define MUI_ABORTWARNING
!define MUI_ICON "${ICON_FILE}"
!define MUI_UNICON "${ICON_FILE}"
!define MUI_FINISHPAGE_RUN "$INSTDIR\AVA Player.exe"
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"
Section "AVA Player" SEC_MAIN
  SetShellVarContext current
  SetOutPath "$INSTDIR"
  File /r "${APP_DIR}/*"
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  CreateDirectory "$SMPROGRAMS\AVA Player"
  CreateShortcut "$SMPROGRAMS\AVA Player\AVA Player.lnk" "$INSTDIR\AVA Player.exe"
  CreateShortcut "$DESKTOP\AVA Player.lnk" "$INSTDIR\AVA Player.exe"
  WriteRegStr HKCU "Software\AVA Player" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\AVA Player" "DisplayName" "AVA Player"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\AVA Player" "DisplayVersion" "0.1.0"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\AVA Player" "Publisher" "AVA"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\AVA Player" "DisplayIcon" "$INSTDIR\AVA Player.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\AVA Player" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\AVA Player" "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\AVA Player" "NoRepair" 1
SectionEnd
Section "Uninstall"
  SetShellVarContext current
  Delete "$DESKTOP\AVA Player.lnk"
  RMDir /r "$SMPROGRAMS\AVA Player"
  !include "${UNINSTALL_INCLUDE}"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir "$INSTDIR"
  DeleteRegKey HKCU "Software\AVA Player"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\AVA Player"
SectionEnd
