export function isValidImageBase64(base64Str: string): boolean {
  // Check if string is excessively large before regex to avoid ReDoS
  if (base64Str.length > 5 * 1024 * 1024) { // 5MB string limit
    return false;
  }

  const match = base64Str.match(/^data:image\/(jpeg|jpg|png|gif|webp);base64,(.+)$/);
  if (!match) {
    return false;
  }

  const base64Data = match[2];

  let buffer: Buffer;
  try {
    buffer = Buffer.from(base64Data, 'base64');
  } catch (err) {
    return false;
  }

  if (buffer.length < 12) {
    return false;
  }

  const header = buffer.toString('hex', 0, 8).toUpperCase();
  const webpHeader = buffer.toString('hex', 8, 12).toUpperCase();

  // JPEG: FF D8 FF
  if (header.startsWith('FFD8FF')) {
    return true;
  }
  
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (header === '89504E470D0A1A0A') {
    return true;
  }
  
  // GIF: 47 49 46 38 37 61 (GIF87a) or 47 49 46 38 39 61 (GIF89a)
  if (header.startsWith('474946383761') || header.startsWith('474946383961')) {
    return true;
  }
  
  // WebP: RIFF...WEBP
  if (header.startsWith('52494646') && webpHeader === '57454250') {
    return true;
  }

  return false;
}
