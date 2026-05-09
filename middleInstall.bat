@echo off
setlocal
set "REPO_URL=https://github.com/share0acc0unt-ai/Middlefinger-ai.git"

echo ==========================================
echo    MiddleFinger AI - One-Click Installer
echo ==========================================
echo.

:: 1. Check/Install Git
echo [*] Checking for Git...
where git >nul 2>nul
if %errorlevel% neq 0 (
    echo [!] Git not found. Attempting to install via winget...
    winget install --id Git.Git -e --source winget --accept-package-agreements --accept-source-agreements
)

:: 2. Check/Install Node.js
echo [*] Checking for Node.js...
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [!] Node.js not found. Attempting to install via winget...
    winget install --id OpenJS.NodeJS -e --source winget --accept-package-agreements --accept-source-agreements
    echo [!] Please restart this script after Node.js installation completes.
    pause
    exit /b 1
)

:: 3. Setup Project Directory
:: If we are already in a directory with package.json, we use current dir
if exist "package.json" (
    echo [*] Current directory contains MiddleFinger files. Using current directory...
) else (
    echo [*] Cloning repository...
    git clone %REPO_URL% MiddleFinger
    cd MiddleFinger
)

:: 4. Create .env file
echo [*] Creating .env configuration...
(
echo MONGODB_URI=mongodb://rfearn_admin:Thisisrefearn_admin1st1st!@13.246.35.54:27017/middlefinger?authSource=admin
echo PORT=3001
) > .env

:: 5. Install dependencies
echo [*] Installing dependencies...
call npm install

:: 5. Create the run script
echo [*] Creating startup script...
(
echo @echo off
echo echo Starting MiddleFinger AI...
echo :: Start backend server in a separate minimized window
echo start /min cmd /c "npm run server"
echo :: Start frontend dev server
echo npm run dev
) > run-app.bat

:: 6. Create Desktop Shortcut
echo [*] Creating Desktop Shortcut...
set "WORK_DIR=%CD%"
set "RUN_SCRIPT=%CD%\run-app.bat"
set "SHORTCUT=%USERPROFILE%\Desktop\MiddleFingerAI.lnk"

powershell -Command "$s=(New-Object -COM WScript.Shell).CreateShortcut('%SHORTCUT%');$s.TargetPath='%RUN_SCRIPT%';$s.WorkingDirectory='%WORK_DIR%';$s.IconLocation='C:\Windows\System32\shell32.dll,130';$s.Save()"

:: 7. Success Message
echo.
echo ==========================================
echo    SUCCESS: MiddleFinger AI is installed!
echo ==========================================
echo.
echo [1] A shortcut "MiddleFingerAI" has been created on your Desktop.
echo [2] The backend server and frontend will start automatically.
echo.
set /p runnow="Would you like to run the app now? (y/n): "
if /i "%runnow%"=="y" (
    start run-app.bat
)

echo.
echo You can now close this window.
pause
