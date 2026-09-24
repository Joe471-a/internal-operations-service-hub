/** Types for fixtures.js, so the tests and the editor know what it hands back. */

import type { PrismaClient } from '@prisma/client';

export interface RequestFixture {
  id: string;
  title: string;
  description: string;
  department: string;
  aiVerified: boolean;
  currentStatus: string;
  submittedBy: string;
  lastUpdated: string;
  history: [string, string, string][];
}

export declare const REQUESTS: RequestFixture[];
export declare function resetFixtures(prisma: PrismaClient): Promise<void>;
