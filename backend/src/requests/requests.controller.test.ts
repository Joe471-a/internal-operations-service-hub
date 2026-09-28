import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { Actor } from './actors';
import { RequestsController } from './requests.controller';
import { RequestsService } from './requests.service';

/**
 * The controller's one job of its own: turning the id in the URL into a
 * number. Everything else it just forwards to the service, which has its
 * own tests.
 */

const DANA = { id: 'emp-001' } as Actor;

function controllerWithFakeService() {
  const service = {
    getById: vi.fn(async (id: number) => ({ id })),
    transition: vi.fn(async (id: number) => ({ id })),
  };
  return { controller: new RequestsController(service as unknown as RequestsService), service };
}

describe('the request id in the URL', () => {
  it('is handed to the service as a number', async () => {
    const { controller, service } = controllerWithFakeService();

    await controller.getOne('1006', DANA);
    await controller.transition('1006', 'ASSIGNED', DANA);

    expect(service.getById).toHaveBeenCalledWith(1006, 'emp-001');
    expect(service.transition).toHaveBeenCalledWith(1006, 'ASSIGNED', 'emp-001');
  });

  it.each(['abc', 'REQ-1001', '12.5', '-3', '0', '007', '1e3', '99999999999'])(
    'refuses "%s" with 400, before the service is asked',
    async (raw) => {
      const { controller, service } = controllerWithFakeService();

      await expect(controller.getOne(raw, DANA)).rejects.toBeInstanceOf(BadRequestException);
      expect(() => controller.transition(raw, 'ASSIGNED', DANA)).toThrow(BadRequestException);

      expect(service.getById).not.toHaveBeenCalled();
      expect(service.transition).not.toHaveBeenCalled();
    },
  );
});
