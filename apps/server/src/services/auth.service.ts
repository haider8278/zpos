import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import { db } from '../db';
import { users, refreshTokens } from '../db/schema';
import { eq, and } from 'drizzle-orm';

export class AuthService {
  async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });
  }

  async verifyPassword(hash: string, password: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }

  async createUser(data: {
    username: string;
    email: string;
    password: string;
    fullName: string;
    roleId: string;
    storeId?: string;
  }) {
    const passwordHash = await this.hashPassword(data.password);
    
    const [user] = await db.insert(users).values({
      username: data.username,
      email: data.email,
      passwordHash,
      fullName: data.fullName,
      roleId: data.roleId,
      storeId: data.storeId,
    }).returning();

    return user;
  }

  async findUserByUsername(username: string) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    return user;
  }

  async findUserById(userId: string) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    return user;
  }

  generateRefreshToken(): string {
    return randomBytes(32).toString('hex');
  }

  async saveRefreshToken(userId: string, token: string, expiresAt: Date) {
    await db.insert(refreshTokens).values({
      userId,
      token,
      expiresAt,
    });
  }

  async findRefreshToken(token: string) {
    const [refreshToken] = await db
      .select()
      .from(refreshTokens)
      .where(
        and(
          eq(refreshTokens.token, token),
          eq(refreshTokens.revokedAt, null as any)
        )
      )
      .limit(1);

    return refreshToken;
  }

  async revokeRefreshToken(token: string) {
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.token, token));
  }

  async revokeUserRefreshTokens(userId: string) {
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(refreshTokens.userId, userId),
          eq(refreshTokens.revokedAt, null as any)
        )
      );
  }
}

export const authService = new AuthService();
