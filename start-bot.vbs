' Vox launcher: restarts the bot supervisor fresh.
' 1) Kill any running supervisor (cmd.exe running vox-guard.cmd)
' 2) Kill any stale bot instance (node.exe running this repo's src\index.js)
' 3) Start vox-guard.cmd hidden - it loops node forever, so crashes self-heal.
Option Explicit

Dim svc, procs, p, cl, sh
Set svc = GetObject("winmgmts:\\.\root\cimv2")

Set procs = svc.ExecQuery("SELECT CommandLine FROM Win32_Process WHERE Name='cmd.exe'")
For Each p In procs
  If Not IsNull(p.CommandLine) Then
    If InStr(LCase(p.CommandLine), "vox-guard.cmd") > 0 Then p.Terminate
  End If
Next

Set procs = svc.ExecQuery("SELECT CommandLine FROM Win32_Process WHERE Name='node.exe'")
For Each p In procs
  If Not IsNull(p.CommandLine) Then
    cl = LCase(p.CommandLine)
    If InStr(cl, "discord-tts-bot") > 0 And InStr(cl, "src\index.js") > 0 Then p.Terminate
  End If
Next

Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = "C:\Users\ay660\discord-tts-bot"
sh.Run "cmd /c vox-guard.cmd", 0, False
