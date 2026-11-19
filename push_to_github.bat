@echo off
title Push TracX to GitHub
echo ========================================================
echo Pushing ColdChain-trackX to GitHub...
echo Repository: https://github.com/chaithanyavanix-crypto/ColdChain-trackX.git
echo Branch:     main
echo ========================================================
echo.
echo If prompted:
echo   Username: chaithanyavanix-crypto
echo   Password: [Your GitHub Personal Access Token]
echo.
.mingit\cmd\git.exe push -u origin main
echo.
if %ERRORLEVEL% equ 0 (
    echo ========================================================
    echo SUCCESS! Code successfully pushed to GitHub!
    echo ========================================================
) else (
    echo ========================================================
    echo PUSH FAILED: Please check your GitHub Token or permissions.
    echo ========================================================
)
pause
