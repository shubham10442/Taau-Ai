import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var PORT = Number(process.env.PORT || 3000);

var MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

function getSafePath(urlPath) {
  var cleanPath = String(urlPath || '/').split('?')[0];
  if (cleanPath === '/') {
    return path.join(__dirname, 'index.html');
  }
  var normalized = path.normalize(cleanPath).replace(/^(\.\.[/\\])+/, '');
  if (normalized.indexOf('/src/') === 0 || normalized.indexOf('src/') === 0) {
    return path.join(__dirname, normalized);
  }
  return path.join(__dirname, 'public', normalized);
}

function sendFile(res, filePath) {
  fs.readFile(filePath, function (err, data) {
    if (err) {
      fs.readFile(path.join(__dirname, 'index.html'), function (err2, html) {
        if (err2) {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('Not found');
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
      });
      return;
    }
    var ext = path.extname(filePath).toLowerCase();
    var mime = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': mime });
    res.end(data);
  });
}

var server = http.createServer(function (req, res) {
  var targetPath = getSafePath(req.url);
  fs.stat(targetPath, function (err, stats) {
    if (!err && stats.isFile()) {
      sendFile(res, targetPath);
    } else {
      sendFile(res, path.join(__dirname, 'index.html'));
    }
  });
});

server.listen(PORT, '0.0.0.0', function () {
  console.log('Taau Ai static server running on http://localhost:' + PORT);
});
