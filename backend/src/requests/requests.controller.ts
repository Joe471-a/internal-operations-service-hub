import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { RequestsService } from './requests.service';

@Controller('requests')
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  /**
   * Handles GET /requests - the system-wide list, or a department's work
   * queue when ?department= and/or ?status= are given.
   */
  @Get()
  getAll(@Query('department') department?: string, @Query('status') status?: string) {
    if (department !== undefined || status !== undefined) {
      return this.requestsService.getQueue(department, status);
    }
    return this.requestsService.getAll();
  }

  /**
   * Handles GET /requests/REQ-1001 - one request and its history.
   * Header: x-hub-actor identifies who is asking. Staff and leads may view
   * any request; an employee may only view one they submitted themselves.
   */
  @Get(':id')
  async getOne(@Param('id') id: string, @Headers('x-hub-actor') actorId?: string) {
    const request = await this.requestsService.getById(id, actorId);

    if (!request) {
      throw new NotFoundException(`Request "${id}" not found.`);
    }

    return request;
  }

  /**
   * Handles POST /requests - create a new request (starts in "SUBMITTED").
   * Body: { "title": "...", "description": "...", "department": "IT" }
   * Header: x-hub-actor identifies who is submitting.
   */
  @Post()
  create(
    @Body('title') title: unknown,
    @Body('description') description: unknown,
    @Body('department') department: unknown,
    @Headers('x-hub-actor') actorId?: string,
  ) {
    return this.requestsService.create(title, description, department, actorId);
  }

  /**
   * Handles POST /requests/REQ-1001/transition
   * Body: { "to": "ASSIGNED" }
   * Header: x-hub-actor identifies who is asking.
   * The service applies the authorization and lifecycle rules and throws
   * 400 / 401 / 403 / 404 / 409 on failure.
   */
  @Post(':id/transition')
  @HttpCode(200)
  transition(
    @Param('id') id: string,
    @Body('to') to: unknown,
    @Headers('x-hub-actor') actorId?: string,
  ) {
    return this.requestsService.transition(id, to, actorId);
  }
}
