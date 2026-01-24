#!/bin/bash
# Fix backend dependency issue - @fastify/rate-limit version mismatch

echo "Cleaning backend dependencies..."
rm -rf node_modules package-lock.json

echo "Installing dependencies with correct versions..."
npm install

echo "Done! Now run: npm run dev"
