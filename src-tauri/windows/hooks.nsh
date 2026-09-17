!macro TEXT_OPEN_WITH EXT
  WriteRegStr SHCTX "Software\Classes\.${EXT}\OpenWithProgids" "${MAINBINARYNAME}.TextDocument" ""
!macroend

!macro TEXT_OPEN_WITH_REMOVE EXT
  DeleteRegValue SHCTX "Software\Classes\.${EXT}\OpenWithProgids" "${MAINBINARYNAME}.TextDocument"
!macroend

!macro NSIS_HOOK_POSTINSTALL
  WriteRegStr SHCTX "Software\Classes\${MAINBINARYNAME}.TextDocument" "" "${PRODUCTNAME}"
  WriteRegStr SHCTX "Software\Classes\${MAINBINARYNAME}.TextDocument\DefaultIcon" "" "$INSTDIR\${MAINBINARYNAME}.exe,0"
  WriteRegStr SHCTX "Software\Classes\${MAINBINARYNAME}.TextDocument\shell\open\command" "" "$\"$INSTDIR\${MAINBINARYNAME}.exe$\" $\"%1$\""
  !insertmacro TEXT_OPEN_WITH "txt"
  !insertmacro TEXT_OPEN_WITH "text"
  !insertmacro TEXT_OPEN_WITH "log"
  System::Call "shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)"
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  !insertmacro TEXT_OPEN_WITH_REMOVE "txt"
  !insertmacro TEXT_OPEN_WITH_REMOVE "text"
  !insertmacro TEXT_OPEN_WITH_REMOVE "log"
  DeleteRegKey SHCTX "Software\Classes\${MAINBINARYNAME}.TextDocument"
  System::Call "shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)"
!macroend
