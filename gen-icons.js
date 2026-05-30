// 生成纯色 PNG 图标（夸克浏览器需要 PNG 格式）
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

function createPNG(size) {
  // 工业深蓝色背景 #1a2332
  const r = 0x1a, g = 0x23, b = 0x32;
  
  // PNG 签名
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  
  // IHDR chunk
  const ihdr = createChunk('IHDR', (buf) => {
    buf.writeUInt32BE(size, 0);      // width
    buf.writeUInt32BE(size, 4);      // height
    buf.writeUInt8(8, 8);             // bit depth
    buf.writeUInt8(2, 9);             // color type: RGB
    buf.writeUInt8(0, 10);            // compression
    buf.writeUInt8(0, 11);            // filter
    buf.writeUInt8(0, 12);            // interlace
  }, 13);
  
  // IDAT chunk - raw pixel data with filter byte 0 per row
  const rawData = [];
  for (let y = 0; y < size; y++) {
    rawData.push(0); // filter: None
    for (let x = 0; x < size; x++) {
      // 圆角矩形检测 - 简单的圆形裁剪
      const cx = size / 2, cy = size / 2;
      const radius = size * 0.48;
      const dx = x - cx, dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist <= radius - 2) {
        rawData.push(r, g, b);
      } else if (dist <= radius) {
        // 抗锯齿边缘
        const alpha = Math.max(0, Math.min(1, radius - dist));
        const bgR = 240, bgG = 242, bgB = 245;
        rawData.push(
          Math.round(r * alpha + bgR * (1 - alpha)),
          Math.round(g * alpha + bgG * (1 - alpha)),
          Math.round(b * alpha + bgB * (1 - alpha))
        );
      } else {
        rawData.push(240, 242, 245); // 背景色
      }
    }
  }
  
  const compressed = zlib.deflateSync(Buffer.from(rawData));
  const idat = createChunk('IDAT', compressed);
  
  // IEND chunk
  const iend = createChunk('IEND', Buffer.alloc(0));
  
  return Buffer.concat([signature, ihdr, idat, iend]);
}

function createChunk(type, dataOrFn, dataLen) {
  const data = typeof dataOrFn === 'function' 
    ? (() => { const b = Buffer.alloc(dataLen); dataOrFn(b); return b; })()
    : dataOrFn;
  
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  
  const typeBuf = Buffer.from(type, 'ascii');
  const crcInput = Buffer.concat([typeBuf, data]);
  
  // CRC32
  const crc = crc32(crcInput);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc, 0);
  
  return Buffer.concat([length, typeBuf, data, crcBuf]);
}

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// 生成所有尺寸的图标
const iconsDir = path.join(__dirname, 'icons');
sizes.forEach(size => {
  const png = createPNG(size);
  const filename = `icon-${size}x${size}.png`;
  fs.writeFileSync(path.join(iconsDir, filename), png);
  console.log(`  ✓ ${filename} (${(png.length / 1024).toFixed(1)} KB)`);
});

console.log('\n  所有 PNG 图标生成完成！');
