import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { Actor } from '../requests/actors';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { CurrentActor } from './current-actor.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /**
   * Handles POST /auth/login
   * Body: { "username": "...", "password": "..." }
   * No guard - this is the one endpoint that proves an identity rather than
   * assuming one has already been proven.
   */
  @Post('login')
  @HttpCode(200)
  login(@Body('username') username: unknown, @Body('password') password: unknown) {
    return this.auth.login(username, password);
  }

  /**
   * Handles POST /auth/change-password
   * Body: { "currentPassword": "...", "newPassword": "..." }
   * Requires a valid session - and still re-checks the current password,
   * so a change always proves the password, not just a still-valid token.
   */
  @Post('change-password')
  @HttpCode(200)
  @UseGuards(AuthGuard)
  async changePassword(
    @CurrentActor() actor: Actor,
    @Body('currentPassword') currentPassword: unknown,
    @Body('newPassword') newPassword: unknown,
  ) {
    await this.auth.changePassword(actor, currentPassword, newPassword);
    return { ok: true };
  }
}
