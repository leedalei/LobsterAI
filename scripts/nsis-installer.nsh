!include "FileFunc.nsh"

!define ROOT_DRIVE_INSTALL_DIR_SUFFIX "LobsterAI"

Function TrimTrailingPathSeparator
  Exch $0
  Push $1

  StrCmp $0 "" TrimTrailingPathSeparatorDone

  StrCpy $1 $0 1 -1
  StrCmp $1 "\" 0 +2
  StrCpy $0 $0 -1
  StrCmp $1 "/" 0 TrimTrailingPathSeparatorDone
  StrCpy $0 $0 -1

TrimTrailingPathSeparatorDone:
  Pop $1
  Exch $0
FunctionEnd

Function NormalizeRootDriveInstallDirectory
  Exch $0
  Push $1
  Push $2
  Push $3
  Push $4
  Push $5

  ${GetRoot} "$0" $1
  StrCmp $1 "" NormalizeRootDriveInstallDirectoryDone

  Push $0
  Call TrimTrailingPathSeparator
  Pop $2

  Push $1
  Call TrimTrailingPathSeparator
  Pop $3

  StrCmp "$2" "$3" 0 NormalizeRootDriveInstallDirectoryDone

  StrLen $4 $3
  IntCmp $4 2 NormalizeRootDriveInstallDirectoryDone NormalizeRootDriveInstallDirectoryIsDriveRoot NormalizeRootDriveInstallDirectoryDone

NormalizeRootDriveInstallDirectoryIsDriveRoot:
  StrCpy $5 $3 1 1
  StrCmp $5 ":" 0 NormalizeRootDriveInstallDirectoryDone

  StrCpy $4 $1 1 -1
  StrCmp $4 "\" NormalizeRootDriveInstallDirectoryHasSeparator
  StrCmp $4 "/" NormalizeRootDriveInstallDirectoryHasSeparator
  StrCpy $1 "$1\"

NormalizeRootDriveInstallDirectoryHasSeparator:
  StrCpy $0 "$1${ROOT_DRIVE_INSTALL_DIR_SUFFIX}"

NormalizeRootDriveInstallDirectoryDone:
  Pop $5
  Pop $4
  Pop $3
  Pop $2
  Pop $1
  Exch $0
FunctionEnd

Function .onVerifyInstDir
  Push $0
  StrCpy $0 $INSTDIR
  Push $0
  Call NormalizeRootDriveInstallDirectory
  Pop $INSTDIR
  Pop $0
FunctionEnd

!macro customHeader
  ; Request admin privileges for script execution (tar extract, etc.)
  ; This does NOT change the default install path — just ensures UAC elevation.
  RequestExecutionLevel admin

  ; Hide the (empty) details list — electron-builder uses 7z solid extraction
  ; which produces no per-file output, so the box would just be blank.
  ShowInstDetails nevershow
!macroend

!macro customInit
  ; Best-effort: terminate a running app instance before install/uninstall
  ; to avoid NSIS "app cannot be closed" errors during upgrades.
  nsExec::ExecToLog 'taskkill /IM "${APP_EXECUTABLE_FILENAME}" /F /T'
  Pop $0
  Sleep 800
!macroend

!macro customInstall
  ; ─── Install Timing Log ───
  ; Write timestamps to help diagnose slow installation phases.
  ; Log file: %APPDATA%\LobsterAI\install-timing.log

  CreateDirectory "$APPDATA\LobsterAI"
  FileOpen $2 "$APPDATA\LobsterAI\install-timing.log" w

  ${GetTime} "" "L" $3 $4 $5 $6 $7 $8 $9
  FileWrite $2 "extract-done: $5-$4-$3 $6:$7:$8$\r$\n"

  ; ─── Extract combined resource archive (win-resources.tar) ───
  ; All large resource directories (cfmind/, SKILLs/, python-win/) are packed
  ; into a single tar file. NSIS 7z extracts one large file almost instantly;
  ; we then unpack the tar here using Electron's Node runtime.

  SetDetailsPrint none

  System::Call 'Kernel32::SetEnvironmentVariable(t "ELECTRON_RUN_AS_NODE", t "1")i'

  ${GetTime} "" "L" $3 $4 $5 $6 $7 $8 $9
  FileWrite $2 "tar-extract-start: $5-$4-$3 $6:$7:$8$\r$\n"

  nsExec::ExecToStack '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "$INSTDIR\resources\unpack-cfmind.cjs" "$INSTDIR\resources\win-resources.tar" "$INSTDIR\resources"'
  Pop $0
  Pop $1

  StrCmp $0 "0" TarExtractOK
    FileWrite $2 "tar-extract-error: exit=$0 output=$1$\r$\n"
    MessageBox MB_OK|MB_ICONEXCLAMATION "Resource extraction failed (exit code $0):$\r$\n$\r$\n$1"
  TarExtractOK:

  ${GetTime} "" "L" $3 $4 $5 $6 $7 $8 $9
  FileWrite $2 "tar-extract-done: $5-$4-$3 $6:$7:$8 exit=$0$\r$\n"
  Delete "$INSTDIR\resources\win-resources.tar"

  System::Call 'Kernel32::SetEnvironmentVariable(t "ELECTRON_RUN_AS_NODE", t "")i'

  ; ─── Windows Defender Exclusion (optional, best-effort) ───
  ; Add the OpenClaw runtime directory to Windows Defender exclusions to avoid
  ; real-time scanning of ~3000 JS/native files during gateway startup.
  ; This can reduce first-launch time from ~120s to ~10s on Windows.
  ;
  ; This is a best-effort optimization:
  ; - Requires admin privileges (already elevated for installation)
  ; - Silently skipped if Defender is not running or policy disallows it
  ; - Only excludes the bundled runtime, not the entire application
  ; - Common practice for developer tools (VS Code, Docker Desktop, etc.)

  nsExec::ExecToStack 'powershell -NoProfile -NonInteractive -Command "try { Add-MpPreference -ExclusionPath $\"$INSTDIR\resources\cfmind$\" -ErrorAction Stop; Write-Output ok } catch { Write-Output skip }"'
  Pop $0
  Pop $1
  FileWrite $2 "defender-exclusion: exit=$0 result=$1$\r$\n"

  ; Clean up the unpack script — no longer needed after installation
  Delete "$INSTDIR\resources\unpack-cfmind.cjs"

  ${GetTime} "" "L" $3 $4 $5 $6 $7 $8 $9
  FileWrite $2 "install-done: $5-$4-$3 $6:$7:$8$\r$\n"
  FileClose $2

  SetDetailsPrint both
!macroend

!macro customUnInstall
  ; ─── Remove Windows Defender Exclusion on uninstall ───
  ; Clean up the exclusion we added during installation.
  nsExec::ExecToStack 'powershell -NoProfile -NonInteractive -Command "try { Remove-MpPreference -ExclusionPath $\"$INSTDIR\resources\cfmind$\" -ErrorAction SilentlyContinue } catch {}"'
  Pop $0
  Pop $1
!macroend
