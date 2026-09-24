import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { Department } from '@prisma/client';
import { Actor } from '../requests/actors';
import { UsersService } from '../users/users.service';

const SALT_ROUNDS = 10;
const MIN_PASSWORD_LENGTH = 6;

export interface LoginResult {
  token: string;
  actorId: string;
  displayName: string;
  role: string;
  department: Department | null;
}

/**
 * Internal Operations Service Hub — proving an identity, not just naming one.
 *
 * Everything downstream of login (every `/requests` endpoint) trusts
 * whatever `AuthGuard` hands it. This service is the only place a password
 * is ever checked, so it is also the only place that gets to be wrong about
 * one - the same "invalid username or password" either way, so a failed
 * login never tells an attacker which half was correct.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  async login(username: unknown, password: unknown): Promise<LoginResult> {
    if (typeof username !== 'string' || typeof password !== 'string' || !username.trim() || !password) {
      throw new UnauthorizedException('Invalid username or password.');
    }

    const user = await this.users.findByUsername(username);
    const ok = user ? await bcrypt.compare(password, user.passwordHash) : false;
    if (!user || !ok) {
      throw new UnauthorizedException('Invalid username or password.');
    }

    const actor = this.users.toActorFromUser(user);
    const token = await this.jwt.signAsync({ sub: actor.id });

    return {
      token,
      actorId: actor.id,
      displayName: actor.displayName,
      role: actor.role,
      department: actor.department,
    };
  }

  /**
   * Always re-checks `currentPassword` against the stored hash - a change
   * must prove the password, not just ride on a still-valid session token.
   */
  async changePassword(actor: Actor, currentPassword: unknown, newPassword: unknown): Promise<void> {
    if (typeof currentPassword !== 'string' || !currentPassword) {
      throw new BadRequestException('Your current password is required.');
    }
    if (typeof newPassword !== 'string' || newPassword.trim().length < MIN_PASSWORD_LENGTH) {
      throw new BadRequestException(`A new password needs at least ${MIN_PASSWORD_LENGTH} characters.`);
    }

    const user = await this.users.findById(actor.id);
    const ok = user ? await bcrypt.compare(currentPassword, user.passwordHash) : false;
    if (!user || !ok) {
      throw new BadRequestException('Your current password is incorrect.');
    }

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await this.users.updatePasswordHash(user.id, passwordHash);
  }
}
