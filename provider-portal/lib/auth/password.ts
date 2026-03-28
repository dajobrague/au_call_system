import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  stored: string
): Promise<boolean> {
  if (stored.startsWith('$2a$') || stored.startsWith('$2b$')) {
    return bcrypt.compare(password, stored);
  }
  return password === stored;
}
