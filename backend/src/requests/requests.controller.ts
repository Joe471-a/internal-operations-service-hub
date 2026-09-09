import {
  Body,
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { RequestsService } from './requests.service';

@Controller('requests')
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  /** Handles GET /requests - the system-wide list. */
  @Get()
  getAll() {
    return this.requestsService.getAll();
  }

  /** Handles GET /requests/REQ-1001 - one request and its history. */
  @Get(':id')
  getOne(@Param('id') id: string) {
    const request = this.requestsService.getById(id);

    if (!request) {
      throw new NotFoundException(`Request "${id}" not found.`);
    }

    return request;
  }

  /** Handles POST /requests - create a new request (starts in "Submitted"). */
  @Post()
  create() {
    return this.requestsService.create();
  }

  /**
   * Handles POST /requests/REQ-1001/transition
   * Body: { "to": "Assigned" }
   * The service applies the lifecycle rules and throws 400 / 404 / 409 on failure.
   */
  @Post(':id/transition')
  @HttpCode(200)
  transition(@Param('id') id: string, @Body('to') to: unknown) {
    return this.requestsService.transition(id, to);
  }
}
