' Starts Vox (Discord TTS bot) hidden unless it is already running.
Option Explicit

Dim svc, procs, p, running, sh
running = False
Set svc = GetObject("winmgmts:\\.\root\cimv2")
Set procs = svc.ExecQuery("SELECT CommandLine FROM Win32_Process WHERE Name='node.exe'")
For Each p In procs
  If Not IsNull(p.CommandLine) Then
    If InStr(LCase(p.CommandLine), "discord-tts-bot") > 0 And InStr(LCase(p.CommandLine), "src\index.js") > 0 Then
      running = True
    End If
  End If
Next
If running Then WScript.Quit 0

Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = "C:\Users\ay660\discord-tts-bot"
sh.Run "cmd /c start-bot.cmd", 0, False
