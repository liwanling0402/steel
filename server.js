// Steel 本地服务器 - 高性能版（缓存 + 压缩 + CORS）
const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const ROOT = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif'
};

// 可压缩的文件类型
const COMPRESSIBLE = ['.html', '.css', '.js', '.json', '.webmanifest', '.svg', '.xml', '.txt'];

// 静态资源缓存时间（秒）
const CACHE_MAX_AGE = {
  '.html': 0,           // HTML 不缓存，确保实时更新
  '.webmanifest': 0,    // manifest 不缓存
  '.css': 3600,         // CSS 1小时
  '.js': 3600,          // JS 1小时
  '.svg': 86400,        // SVG 1天
  '.png': 86400,        // PNG 1天
  '.ico': 86400         // 图标 1天
};

const server = http.createServer((req, res) => {
  // 添加 CORS 头（方便开发）
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  let url = req.url === '/' ? '/index.html' : req.url;
  url = url.split('?')[0];

  // 安全检查：防止目录穿越
  const safePath = path.normalize(url).replace(/^(\.\.(\/|\\|$))+/, '');
  const filePath = path.join(ROOT, safePath);

  // 检查文件是否在 ROOT 目录内
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('403 Forbidden');
    return;
  }

  try {
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      res.writeHead(404);
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME[ext] || 'application/octet-stream';
    const maxAge = CACHE_MAX_AGE[ext] || 0;

    // 设置缓存头
    res.setHeader('Content-Type', contentType);
    if (maxAge > 0) {
      res.setHeader('Cache-Control', `public, max-age=${maxAge}`);
      res.setHeader('ETag', `"${stat.size}-${stat.mtimeMs}"`);
    } else {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    }

    // 判断是否支持 Gzip
    const acceptEncoding = req.headers['accept-encoding'] || '';
    const canGzip = COMPRESSIBLE.includes(ext) && acceptEncoding.includes('gzip');

    if (canGzip && stat.size > 1024) {
      // 大于 1KB 的文件才压缩
      res.setHeader('Content-Encoding', 'gzip');
      res.setHeader('Vary', 'Accept-Encoding');
      res.writeHead(200);
      const readStream = fs.createReadStream(filePath);
      const gzipStream = zlib.createGzip();
      readStream.pipe(gzipStream).pipe(res);
    } else {
      res.writeHead(200);
      const readStream = fs.createReadStream(filePath);
      readStream.pipe(res);
    }
  } catch (e) {
    res.writeHead(404);
    res.end('404 Not Found');
  }
});

const PORT = 5500;
server.listen(PORT, () => {
  const os = require('os');
  const interfaces = os.networkInterfaces();
  console.log('\n  Steel 钢材管理系统 - 高性能模式');
  console.log('  ──────────────────────────────────');
  console.log(`  本机访问: http://localhost:${PORT}`);
  Object.values(interfaces).forEach(iface => {
    iface.forEach(addr => {
      if (addr.family === 'IPv4' && !addr.internal) {
        console.log(`  手机访问: http://${addr.address}:${PORT}`);
      }
    });
  });
  console.log('\n  特性: Gzip压缩 | 静态缓存 | CORS\n');
});
