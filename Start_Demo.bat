@echo off
title AI Presenter Demo Setup
echo ==============================================================
echo Starting AI Presenter Local Agent and Cloudflare Tunnel...
echo Please wait while the environment variables are configured
echo and the latest code is deployed to Vercel...
echo ==============================================================
cd /d "%~dp0"
node scripts\setup_env.mjs
pause
