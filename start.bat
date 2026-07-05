@echo off
chcp 65001 >nul
title GameNest
echo === GameNest ===
echo Starting server...
start "" "http://localhost:3000"
node server.js
pause
