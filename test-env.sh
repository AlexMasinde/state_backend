#!/bin/bash

# Test script to verify environment variables are working
echo "🧪 Testing Environment Variables Configuration"
echo "=============================================="

# Load environment variables from .env file if it exists
if [ -f .env ]; then
    echo "📁 Loading .env file..."
    export $(cat .env | grep -v '^#' | xargs)
    echo "✅ .env file loaded"
else
    echo "⚠️  No .env file found, using system environment variables"
fi

echo ""
echo "🔍 Environment Variables Status:"
echo "NODE_ENV: ${NODE_ENV:-'not set'}"
echo "PORT: ${PORT:-'not set'}"
echo "DB_HOST: ${DB_HOST:-'not set'}"
echo "DB_PORT: ${DB_PORT:-'not set'}"
echo "DB_USERNAME: ${DB_USERNAME:-'not set'}"
echo "DB_PASSWORD: ${DB_PASSWORD:-'not set'}"
echo "DB_DATABASE: ${DB_DATABASE:-'not set'}"
echo "JWT_AT_SECRET: ${JWT_AT_SECRET:-'not set'}"
echo "JWT_RT_SECRET: ${JWT_RT_SECRET:-'not set'}"
echo "COOKIE_DOMAIN: ${COOKIE_DOMAIN:-'not set'}"
echo "CORS_ORIGINS: ${CORS_ORIGINS:-'not set'}"

echo ""
echo "🚀 Testing application startup..."
npm run start:dev
