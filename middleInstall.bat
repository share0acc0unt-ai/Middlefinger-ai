@echo off
setlocal

:: Configuration
set "REPO_URL=https://github.com/YOUR_USERNAME/MiddleFinger.git"
set "PROJECT_NAME=middlefinger"

echo ==========================================
echo    MiddleFinger App One-Click Installer
echo ==========================================

:: 1. Install Git
echo [*] Checking/Installing Git...
winget install --id Git.Git -e --source winget --accept-package-agreements --accept-source-agreements
if %errorlevel% neq 0 (
    echo [!] Winget install failed. If Git is already installed, ignoring error...
)

:: 2. Install Node.js
echo [*] Checking/Installing Node.js (Latest)...
winget install --id OpenJS.NodeJS -e --source winget --accept-package-agreements --accept-source-agreements
if %errorlevel% neq 0 (
    echo [!] Winget install failed. If Node.js is already installed, ignoring error...
)

:: Refresh Path
set "PATH=%PATH%;C:\Program Files\Git\cmd;C:\Program Files\nodejs\"

:: 3. Clone the project
echo [*] Cloning repository...
git clone %REPO_URL% %PROJECT_NAME%
if %errorlevel% neq 0 (
    echo [!] Failed to clone. Checking if directory already exists...
)

:: 4. Enter project
cd %PROJECT_NAME%

:: 5. Install dependencies
echo [*] Installing dependencies...
call npm install

:: 6. Create the run script
echo [*] Creating run script...
echo @echo off > run-project.bat
echo echo Starting MiddleFinger... >> run-project.bat
echo npm run dev >> run-project.bat

:: 7. Create Desktop Icon
echo [*] Creating Desktop Shortcut...
set "WORK_DIR=%CD%"
set "RUN_SCRIPT=%CD%\run-project.bat"
set "SHORTCUT=%USERPROFILE%\Desktop\MiddleFinger.lnk"

powershell -Command "$s=(New-Object -COM WScript.Shell).CreateShortcut('%SHORTCUT%');$s.TargetPath='%RUN_SCRIPT%';$s.WorkingDirectory='%WORK_DIR%';$s.IconLocation='C:\Windows\System32\shell32.dll,130';$s.Save()"

:: 8. Success Message
echo.
echo ==========================================
echo    SUCCESS: MiddleFinger is installed!
echo ==========================================
echo.
echo [HOW TO LAUNCH]
echo Simply double-click the "MiddleFinger" icon on your Desktop.
echo The app will open in your browser at http://localhost:5173 (or 5174).
echo.
echo ==========================================
:: 9. Tell user to close CMD
echo PLEASE CLOSE THIS COMMAND PROMPT WINDOW.
echo ==========================================
pause
