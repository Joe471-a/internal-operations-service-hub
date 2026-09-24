import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Actor } from '../requests/actors';
import { UsersService } from '../users/users.service';

interface AuthorizedRequest {
  headers: { authorization?: string };
  actor?: Actor;
}

/**
 * Internal Operations Service Hub — the boundary every `/requests` route
 * now sits behind.
 *
 * Nothing downstream of this guard reads an `x-hub-actor` header anymore;
 * a caller cannot claim to be anyone it likes. The only way `request.actor`
 * gets set is a `Bearer` token this guard itself verified with the app's
 * own signing key, then re-resolved against the `User` table - fresh role
 * and department, not whatever was true when the token was issued.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly users: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthorizedRequest>();
    const token = this.extractToken(request);
    if (!token) {
      throw new UnauthorizedException('Sign in to do that.');
    }

    let payload: { sub?: unknown };
    try {
      payload = await this.jwt.verifyAsync(token);
    } catch {
      throw new UnauthorizedException('Your session has expired - please sign in again.');
    }

    const actor = typeof payload.sub === 'string' ? await this.users.resolveActor(payload.sub) : null;
    if (!actor) {
      throw new UnauthorizedException('Your session has expired - please sign in again.');
    }

    request.actor = actor;
    return true;
  }

  private extractToken(request: AuthorizedRequest): string | null {
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) return null;
    const token = header.slice('Bearer '.length).trim();
    return token || null;
  }
}
