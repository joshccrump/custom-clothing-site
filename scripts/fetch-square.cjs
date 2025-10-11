#!/usr/bin/env node
const path = require('path');
const { pathToFileURL } = require('url');

(async () => {
  try {
    const moduleUrl = pathToFileURL(path.join(__dirname, 'fetch-square.js'));
    await import(moduleUrl);
  } catch (err) {
    console.error('Failed to load Square sync module:', err?.message || err);
    process.exitCode = 1;
  }
})();
