import { Injectable } from '@nestjs/common';
import { User } from '@prisma/client';
import { Actor, PERMISSIONS_BY_ROLE, Role } from '../requests/actors';
import { PrismaService } from '../prisma.service';

/**
 * Internal Operations Service Hub — where an identity actually lives now.
 *
 * A `User` row is the source of truth for who someone is (id, username,
 * password hash, display name, role, department); `actors.ts` stays the
 * source of truth for what a role is allowed to do. This service is the one
 * place that turns the former into the `Actor` shape the rest of the app
 * already knows how to authorize.
 */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Turns a `User` row into the `Actor` the rest of the app authorizes against. */
  toActorFromUser(user: User): Actor {
    const role = user.role as Role;
    return {
      id: user.id,
      displayName: user.displayName,
      role,
      department: user.department,
      permissions: PERMISSIONS_BY_ROLE[role],
    };
  }

  /** The actor the hub knows under this id, or null when it knows nobody. */
  async resolveActor(id: string | undefined): Promise<Actor | null> {
    const wanted = id?.trim();
    if (!wanted) return null;
    const user = await this.prisma.user.findUnique({ where: { id: wanted } });
    return user ? this.toActorFromUser(user) : null;
  }

  /** The raw user row for this username - login needs the password hash too, which `Actor` never carries. */
  async findByUsername(username: string): Promise<User | null> {
    const wanted = username.trim();
    if (!wanted) return null;
    return this.prisma.user.findUnique({ where: { username: wanted } });
  }

  /** The raw user row for this id - changing a password needs the current hash to re-check against. */
  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async updatePasswordHash(id: string, passwordHash: string): Promise<void> {
    await this.prisma.user.update({ where: { id }, data: { passwordHash } });
  }
}
