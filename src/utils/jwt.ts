import jwt from 'jsonwebtoken';
import type { JWTPayload } from '../types/index.js';

/**
 * Sign JWT token
 */
export async function signJWT(payload: JWTPayload, secret: string): Promise<string> {
  return jwt.sign(payload, secret, {
    expiresIn: '30d',
  });
}

/**
 * Verify JWT token
 */
export async function verifyJWT(token: string, secret: string): Promise<JWTPayload | null> {
  try {
    const decoded = jwt.verify(token, secret) as JWTPayload;
    return decoded;
  } catch (error) {
    return null;
  }
}
