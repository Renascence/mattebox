/**
 * EXIF 解析自检：现场拼一张带 APP1 段的 JPEG，验证解析与格式化。
 *   npm run test:exif
 */
const { parseExif, formatExif } = await import('../src/exif.ts');

function buildJpegWithExif() {
  const tiff = Buffer.alloc(512);
  let p = 0;
  tiff.write('II', p); // 小端
  tiff.writeUInt16LE(0x2a, 2);
  tiff.writeUInt32LE(8, 4); // IFD0 偏移

  const ifd0 = 8;
  const ifd0Count = 3;
  const ifd0End = ifd0 + 2 + ifd0Count * 12 + 4;
  const makeOff = ifd0End;
  const modelOff = makeOff + 8;
  const exifOff = modelOff + 13;

  const writeEntry = (base, i, tag, type, count, value) => {
    const e = base + 2 + i * 12;
    tiff.writeUInt16LE(tag, e);
    tiff.writeUInt16LE(type, e + 2);
    tiff.writeUInt32LE(count, e + 4);
    if (type === 3) {
      tiff.writeUInt16LE(value, e + 8);
    } else {
      tiff.writeUInt32LE(value, e + 8);
    }
  };

  tiff.writeUInt16LE(ifd0Count, ifd0);
  writeEntry(ifd0, 0, 0x010f, 2, 8, makeOff); // Make
  writeEntry(ifd0, 1, 0x0110, 2, 13, modelOff); // Model
  writeEntry(ifd0, 2, 0x8769, 4, 1, exifOff); // Exif IFD
  tiff.writeUInt32LE(0, ifd0 + 2 + ifd0Count * 12);

  tiff.write('TESTCAM\0', makeOff, 'ascii');
  tiff.write('X100 Mark II\0', modelOff, 'ascii');

  const exifCount = 5;
  const exifEnd = exifOff + 2 + exifCount * 12 + 4;
  const fnumOff = exifEnd;
  const expOff = fnumOff + 8;
  const focalOff = expOff + 8;
  const lensOff = focalOff + 8;

  tiff.writeUInt16LE(exifCount, exifOff);
  writeEntry(exifOff, 0, 0x829d, 5, 1, fnumOff); // FNumber
  writeEntry(exifOff, 1, 0x829a, 5, 1, expOff); // ExposureTime
  writeEntry(exifOff, 2, 0x8827, 3, 1, 400); // ISO
  writeEntry(exifOff, 3, 0x920a, 5, 1, focalOff); // FocalLength
  writeEntry(exifOff, 4, 0xa434, 2, 15, lensOff); // LensModel
  tiff.writeUInt32LE(0, exifOff + 2 + exifCount * 12);

  tiff.writeUInt32LE(18, fnumOff);
  tiff.writeUInt32LE(10, fnumOff + 4);
  tiff.writeUInt32LE(1, expOff);
  tiff.writeUInt32LE(250, expOff + 4);
  tiff.writeUInt32LE(35, focalOff);
  tiff.writeUInt32LE(1, focalOff + 4);
  tiff.write('XF 23mm F1.4 R\0', lensOff, 'ascii');

  const body = Buffer.concat([Buffer.from('Exif\0\0', 'binary'), tiff.subarray(0, 220)]);
  const app1 = Buffer.alloc(4);
  app1.writeUInt16BE(0xffe1, 0);
  app1.writeUInt16BE(body.length + 2, 2);

  return Buffer.concat([
    Buffer.from([0xff, 0xd8]),
    app1,
    body,
    Buffer.from([0xff, 0xd9]),
  ]);
}

const jpeg = buildJpegWithExif();
const info = parseExif(jpeg.buffer.slice(jpeg.byteOffset, jpeg.byteOffset + jpeg.byteLength));
console.log('解析结果:', info);
console.log('格式化  :', formatExif(info));

const expected = 'TESTCAM X100 MARK II · XF 23mm F1.4 R · 35mm · f/1.8 · 1/250s · ISO 400';
const actual = formatExif(info);
console.log(actual === expected ? '\n✓ 通过' : `\n✗ 期望「${expected}」\n  实际「${actual}」`);

// 非 JPEG 应该安静返回空
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
console.log('PNG 输入:', JSON.stringify(formatExif(parseExif(png.buffer))));
process.exit(actual === expected ? 0 : 1);
