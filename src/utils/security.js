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
let installationSecret;
function signingSecret() {
  if (process.env.JWT_SECRET && process.env.JWT_SECRET !== 'carwash_super_secret_jwt_key_local_2026') {
    if (process.env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET must contain at least 32 characters.');
    return process.env.JWT_SECRET;
  }
  if (installationSecret) return installationSecret;
  const fs = require('fs'),
    path = require('path');
  const directory = process.env.PRIVATE_DATA_DIR || path.join(__dirname, '../../private');
  fs.mkdirSync(directory, {
    recursive: true,
    mode: 0o700
  });
  const file = path.join(directory, 'session-secret');
  try {
    fs.writeFileSync(file, crypto.randomBytes(48).toString('hex'), {
      flag: 'wx',
      mode: 0o600
    });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
  installationSecret = fs.readFileSync(file, 'utf8').trim();
  return installationSecret;
}
function generateToken(payload) {
  const data = {
    ...payload,
    issued_at: Date.now(),
    expires_at: Date.now() + 8 * 60 * 60 * 1000
  };
  const sig = crypto.createHmac('sha256', signingSecret()).update(JSON.stringify(data)).digest('hex');
  return Buffer.from(JSON.stringify({
    data,
    sig
  })).toString('base64url');
}
function verifyToken(token) {
  if (!token) return null;
  try {
    const parsed = JSON.parse(Buffer.from(token, 'base64url').toString());
    if (!Number.isFinite(parsed.data?.expires_at) || parsed.data.expires_at <= Date.now()) return null;
    const expected = crypto.createHmac('sha256', signingSecret()).update(JSON.stringify(parsed.data)).digest();
    const signature = Buffer.from(parsed.sig || '', 'hex');
    return signature.length === expected.length && crypto.timingSafeEqual(signature, expected) ? parsed.data : null;
  } catch {
    return null;
  }
}
module.exports = {
  resetSigningSecret: () => { installationSecret = undefined; },
  hashSecret,
  verifySecret,
  generateToken,
  verifyToken
};
