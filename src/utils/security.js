const crypto = require('crypto');

/**
 * Hash a password or PIN securely using scrypt with a unique salt
 * Returns string formatted as: salt:hash
 */
function hashSecret(secret) {
  if (!secret) return null;
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(String(secret), salt, 64).toString('hex');
  return `${salt}:${derivedKey}`;
}

/**
 * Verify a plaintext secret against a stored hash (or legacy plaintext for seamless backward compatibility)
 */
function verifySecret(secret, storedHash) {
  if (!secret || !storedHash) return false;

  // Seamless legacy backward compatibility: if stored string doesn't contain salt separator ':'
  if (!storedHash.includes(':')) {
    return String(secret).trim() === String(storedHash).trim();
  }

  try {
    const [salt, key] = storedHash.split(':');
    if (!salt || !key) return false;
    const keyBuffer = Buffer.from(key, 'hex');
    const derivedKey = crypto.scryptSync(String(secret), salt, 64);
    return crypto.timingSafeEqual(keyBuffer, derivedKey);
  } catch (err) {
    return false;
  }
}

/**
 * Generates an authentication session token / signature
 */
function generateToken(payload) {
  const data = JSON.stringify(payload);
  const secret = process.env.JWT_SECRET || 'df-pro-carwash-secure-local-secret-2026';
  const signature = crypto.createHmac('sha256', secret).update(data).digest('hex');
  return Buffer.from(JSON.stringify({ data: payload, sig: signature })).toString('base64');
}

/**
 * Verifies an authentication session token
 */
function verifyToken(token) {
  if (!token) return null;
  try {
    const raw = Buffer.from(token, 'base64').toString('utf8');
    const parsed = JSON.parse(raw);
    const secret = process.env.JWT_SECRET || 'df-pro-carwash-secure-local-secret-2026';
    const expectedSig = crypto.createHmac('sha256', secret).update(JSON.stringify(parsed.data)).digest('hex');
    if (crypto.timingSafeEqual(Buffer.from(parsed.sig, 'hex'), Buffer.from(expectedSig, 'hex'))) {
      return parsed.data;
    }
    return null;
  } catch (e) {
    return null;
  }
}

module.exports = {
  hashSecret,
  verifySecret,
  generateToken,
  verifyToken,
};
