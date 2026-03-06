@echo off
call npm start
if %ERRORLEVEL% neq 0 (
    echo.
    echo The server encountered an error and could not start.
    pause
)
