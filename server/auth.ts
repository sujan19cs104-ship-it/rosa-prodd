import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { storage } from './storage';

const JWT_SECRET = process.env.JWT_SECRET || 'rosae-secret-key-2024';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface UserSession {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
}

export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(user: UserSession): string {
  return jwt.sign(user, JWT_SECRET, { expiresIn: '24h' });
}

export function verifyToken(token: string): UserSession | null {
  try {
    return jwt.verify(token, JWT_SECRET) as UserSession;
  } catch {
    return null;
  }
}

export async function authenticateUser(credentials: LoginCredentials): Promise<UserSession | null> {
  const user = await storage.getUserByEmail(credentials.email);
  
  if (!user || !user.passwordHash) {
    return null;
  }

  const isValidPassword = await verifyPassword(credentials.password, user.passwordHash);
  
  if (!isValidPassword) {
    return null;
  }

  return {
    id: user.id,
    email: user.email || '',
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    role: user.role || 'employee',
  };
}

export async function createUser(userData: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: string;
}) {
  const passwordHash = await hashPassword(userData.password);
  
  return storage.upsertUser({
    id: crypto.randomUUID(),
    email: userData.email,
    firstName: userData.firstName,
    lastName: userData.lastName,
    passwordHash: passwordHash,
    role: userData.role || 'employee',
  });
} 