import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Actor } from '../requests/actors';

/** The actor `AuthGuard` already resolved from a verified token, for a controller to read back. */
export const CurrentActor = createParamDecorator((_data: unknown, ctx: ExecutionContext): Actor => {
  const request = ctx.switchToHttp().getRequest<{ actor: Actor }>();
  return request.actor;
});
