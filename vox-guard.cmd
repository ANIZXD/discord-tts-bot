@echo off
REM Vox supervisor: runs the bot forever. If it exits (network blip, crash),
REM restart it after 30 s. Started hidden by start-bot.vbs / the desktop button.
cd /d "%~dp0"
:loop
"E:\Local Disk\node.exe" "C:\Users\ay660\discord-tts-bot\src\index.js" >> bot.out.log 2>> bot.err.log
echo [%date% %time%] Vox exited (code %errorlevel%). Restarting in 30 s. >> bot.err.log
timeout /t 30 /nobreak >nul
goto loop
