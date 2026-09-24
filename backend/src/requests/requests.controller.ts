import { Body, Controller, Get, HttpCode, NotFoundException, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentActor } from '../auth/current-actor.decorator';
import { Actor } from './actors';
import { RequestsService } from './requests.service';

@Controller('requests')
@UseGuards(AuthGuard)
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  /**
   * Handles GET /requests - every request this actor may see (their own,
   * plus their department if they're staff/lead). ?view= narrows further:
   * mine | handle | assign | all (default).
   * Who is asking comes from the session token (see AuthGuard), not a
   * client-supplied header.
   */
  @Get()
  getVisible(@CurrentActor() actor: Actor, @Query('view') view?: string) {
    return this.requestsService.getVisible(actor.id, view);
  }

  /**
   * Handles GET /requests/REQ-1001 - one request and its history.
   * Staff and leads may view any request; an employee may only view one
   * they submitted themselves.
   */
  @Get(':id')
  async getOne(@Param('id') id: string, @CurrentActor() actor: Actor) {
    const request = await this.requestsService.getById(id, actor.id);

    if (!request) {
      throw new NotFoundException(`Request "${id}" not found.`);
    }

    return request;
  }

  /**
   * Handles POST /requests - create a new request (starts in "SUBMITTED").
   * Body: { "title": "...", "description": "...", "department": "IT" }
   */
  @Post()
  create(
    @Body('title') title: unknown,
    @Body('description') description: unknown,
    @Body('department') department: unknown,
    @CurrentActor() actor: Actor,
  ) {
    return this.requestsService.create(title, description, department, actor.id);
  }

  /**
   * Handles POST /requests/REQ-1001/transition
   * Body: { "to": "ASSIGNED" }
   * The service applies the authorization and lifecycle rules and throws
   * 400 / 403 / 404 / 409 on failure.
   */
  @Post(':id/transition')
  @HttpCode(200)
  transition(@Param('id') id: string, @Body('to') to: unknown, @CurrentActor() actor: Actor) {
    return this.requestsService.transition(id, to, actor.id);
  }
}
