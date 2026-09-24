import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { describe, expect, it } from 'vitest';
import { Actor } from '../requests/actors';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

/**
 * AuthService, on its own.
 *
 * No database, no real network - a fake in-memory user store with a real
 * bcrypt hash (so the compare is exercising real hashing, not a stub that
 * always says yes) and a real JwtService (it works the same way with or
 * without Nest's DI wiring - only the module registration is Nest-specific).
 */

const KNOWN_PASSWORD = 'dana123';

function fakeUsers() {
  const passwordHash = bcrypt.hashSync(KNOWN_PASSWORD, 4); // low cost factor - this is a test, not production
  const record = {
    id: 'emp-001',
    username: 'dana',
    passwordHash,
    displayName: 'Dana Karam (Employee)',
    role: 'employee',
    department: null,
  };

  return {
    findByUsername: async (username: string) => (username === record.username ? { ...record } : null),
    findById: async (id: string) => (id === record.id ? { ...record } : null),
    updatePasswordHash: async (id: string, hash: string) => {
      if (id === record.id) record.passwordHash = hash;
    },
    toActorFromUser: (user: typeof record): Actor => ({
      id: user.id,
      displayName: user.displayName,
      role: user.role as Actor['role'],
      department: user.department,
      permissions: ['request:submit'],
    }),
  };
}

function buildAuth() {
  const users = fakeUsers();
  const jwt = new JwtService({ secret: 'test-secret' });
  const service = new AuthService(users as unknown as UsersService, jwt);
  return { service, users, jwt };
}

const EMPLOYEE: Actor = {
  id: 'emp-001',
  displayName: 'Dana Karam (Employee)',
  role: 'employee',
  department: null,
  permissions: ['request:submit'],
};

describe('login', () => {
  it('returns a token and profile for the right username and password', async () => {
    const { service, jwt } = buildAuth();

    const result = await service.login('dana', KNOWN_PASSWORD);

    expect(result.actorId).toBe('emp-001');
    expect(result.displayName).toBe('Dana Karam (Employee)');
    expect(result.role).toBe('employee');
    const payload = await jwt.verifyAsync(result.token);
    expect(payload.sub).toBe('emp-001');
  });

  it('rejects a wrong password', async () => {
    const { service } = buildAuth();

    await expect(service.login('dana', 'not-the-password')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an unknown username with the same error a wrong password gets', async () => {
    const { service } = buildAuth();

    await expect(service.login('ghost', KNOWN_PASSWORD)).rejects.toThrow(/Invalid username or password/);
    await expect(service.login('dana', 'wrong')).rejects.toThrow(/Invalid username or password/);
  });

  it('rejects a missing or non-string username/password instead of crashing', async () => {
    const { service } = buildAuth();

    await expect(service.login(undefined, KNOWN_PASSWORD)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(service.login('dana', undefined)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('change password', () => {
  it('rejects the wrong current password, and leaves the stored hash untouched', async () => {
    const { service, users } = buildAuth();

    await expect(
      service.changePassword(EMPLOYEE, 'not-the-password', 'brand-new-password'),
    ).rejects.toBeInstanceOf(BadRequestException);

    const stillWorks = await service.login('dana', KNOWN_PASSWORD);
    expect(stillWorks.actorId).toBe('emp-001');
    void users;
  });

  it('rejects a new password that is too short', async () => {
    const { service } = buildAuth();

    await expect(service.changePassword(EMPLOYEE, KNOWN_PASSWORD, 'abc')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('updates the password on success, and the old one stops working', async () => {
    const { service } = buildAuth();

    await service.changePassword(EMPLOYEE, KNOWN_PASSWORD, 'brand-new-password');

    await expect(service.login('dana', KNOWN_PASSWORD)).rejects.toBeInstanceOf(UnauthorizedException);
    const result = await service.login('dana', 'brand-new-password');
    expect(result.actorId).toBe('emp-001');
  });
});
