/** Types for users.js, so the tests and the editor know what it hands back. */

import type { PrismaClient } from '@prisma/client';

export interface UserFixture {
  id: string;
  username: string;
  password: string;
  displayName: string;
  role: string;
  department: string | null;
}

export declare const USERS: UserFixture[];
export declare function resetUsers(prisma: PrismaClient): Promise<void>;
