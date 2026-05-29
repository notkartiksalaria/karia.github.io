/**
 * Karia Immersive Cinematic Portfolio — Local Host Server
 * 
 * An ultra-lightweight Node.js web server using only built-in modules.
 * REQUIRES ZERO NPM INSTALLS or dependencies.
 * Serves HTML, CSS, JS, and high-fidelity image assets (PNG, AVIF).
 * Automatically opens the website in your default browser.
 * 
 * Usage:
 *   node server.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = 3000;

// Mapping file extensions to correct browser MIME types
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.glb': 'model/gltf-binary'
};

const server = http.createServer((req, res) => {
  // Normalize request path, decode URL-encoded characters (like spaces), and strip queries
  let filePath = decodeURIComponent(req.url.split('?')[0]);
  
  // Custom API endpoint to proxy Instagram Reel covers server-side (bypasses browser hotlink/referer blocks)
  if (filePath === '/api/instagram-cover') {
    const queryStr = req.url.split('?')[1] || '';
    const match = queryStr.match(/id=([^&]+)/);
    const reelId = match ? match[1] : null;
    
    if (!reelId) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Missing Instagram Reel ID');
      return;
    }
    
    const targetUrl = `https://www.instagram.com/p/${reelId}/media/?size=l`;
    const https = require('https');
    
    const fetchImage = (url) => {
      https.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      }, (instagramRes) => {
        if (instagramRes.statusCode === 302 || instagramRes.statusCode === 301) {
          fetchImage(instagramRes.headers.location);
        } else if (instagramRes.statusCode === 200) {
          res.writeHead(200, {
            'Content-Type': instagramRes.headers['content-type'] || 'image/jpeg',
            'Cache-Control': 'public, max-age=86400',
            'Access-Control-Allow-Origin': '*'
          });
          instagramRes.pipe(res);
        } else {
          res.writeHead(instagramRes.statusCode, { 'Content-Type': 'text/plain' });
          res.end(`Failed to load cover image: ${instagramRes.statusCode}`);
        }
      }).on('error', (err) => {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(`Error: ${err.message}`);
      });
    };
    
    fetchImage(targetUrl);
    return;
  }

  // Default to index.html for empty/root routes
  if (filePath === '/' || filePath === '') {
    filePath = '/index.html';
  }

  // Resolve absolute file path safely
  const safeFilePath = path.join(__dirname, filePath);

  // Check if file exists inside root workspace
  fs.access(safeFilePath, fs.constants.F_OK, (err) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`404: Not Found - ${filePath}`);
      return;
    }

    // Get file statistics for range/size handling
    fs.stat(safeFilePath, (statErr, stats) => {
      if (statErr || stats.isDirectory()) {
        res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('403: Forbidden - Path is a directory');
        return;
      }

      const ext = path.extname(safeFilePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      const totalSize = stats.size;
      const range = req.headers.range;

      // Handle HTTP Range Requests (HTTP 206 Partial Content)
      if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;

        // Verify range boundary checks
        if (start >= totalSize || end >= totalSize || start > end) {
          res.writeHead(416, { 
            'Content-Range': `bytes */${totalSize}`,
            'Cache-Control': 'no-cache'
          });
          res.end();
          return;
        }

        const chunkSize = (end - start) + 1;
        const fileStream = fs.createReadStream(safeFilePath, { start, end });

        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${totalSize}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunkSize,
          'Content-Type': contentType,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        });

        fileStream.pipe(res);
      } else {
        // Handle full request responses (HTTP 200 OK)
        fs.readFile(safeFilePath, (readErr, data) => {
          if (readErr) {
            res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end(`500: Server Internal Error - ${readErr.message}`);
            return;
          }

          res.writeHead(200, { 
            'Content-Length': totalSize,
            'Content-Type': contentType,
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          });
          res.end(data);
        });
      }
    });
  });
});

server.listen(PORT, () => {
  const localUrl = `http://localhost:${PORT}`;
  console.log('\x1b[35m%s\x1b[0m', '==================================================');
  console.log('\x1b[36m%s\x1b[0m', '   KARIA IMMERSIVE CINEMATIC PORTFOLIO ACTIVE   ');
  console.log('\x1b[35m%s\x1b[0m', '==================================================');
  console.log(`\x1b[32m✔ Local host server running successfully at: ${localUrl}\x1b[0m`);
  console.log('\x1b[33m%s\x1b[0m', 'Press [Ctrl + C] to terminate the server.\n');

  // Automatically spawn default system browser based on OS platform
  let openCommand = '';
  switch (process.platform) {
    case 'darwin': // macOS
      openCommand = `open ${localUrl}`;
      break;
    case 'win32':  // Windows
      openCommand = `start ${localUrl}`;
      break;
    default:       // Linux/Other
      openCommand = `xdg-open ${localUrl}`;
  }

  if (openCommand) {
    exec(openCommand, (execErr) => {
      if (execErr) {
        console.log(`Note: Browser failed to open automatically. Please navigate to ${localUrl} manually.`);
      } else {
        console.log(`🚀 Launched default browser pointing to ${localUrl}`);
      }
    });
  }
});
