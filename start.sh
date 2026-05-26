#!/bin/sh
set -e

echo "Running prisma db push..."
node_modules/.bin/prisma db push --accept-data-loss

echo "Starting server..."
node .next/standalone/server.js
