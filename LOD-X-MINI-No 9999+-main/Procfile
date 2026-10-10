web: node site/index.js
worker: node --expose-gc --max-semi-space-size=2 --optimize-for-size --max-old-space-size=${HEAP_MB:-400} server/index.js
