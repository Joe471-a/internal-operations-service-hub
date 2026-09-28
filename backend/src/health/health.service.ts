import { Injectable } from '@nestjs/common';
import { GroqClassifierClient } from '../ai-classification/groq-classifier.client';
import { PrismaService } from '../prisma.service';

/** How long the database gets to answer before it counts as down. */
export const DATABASE_TIMEOUT_MS = 3000;

/**
 * How long one AI check is reused. The monitor asks every second and Render
 * asks too - without this, the health check alone would spend Groq's
 * free-tier rate limit that real request classification needs.
 */
export const AI_CHECK_TTL_MS = 30_000;

export interface HealthReport {
  /**
   * ok       - everything works.
   * degraded - the hub works, but the AI check is off: new requests are saved
   *            "Not checked" (fail-open, docs/week4-production-ai.md).
   * error    - the database is unreachable, so the hub cannot work at all.
   */
  status: 'ok' | 'degraded' | 'error';
  database: 'up' | 'down';
  ai: 'up' | 'down' | 'not configured';
  /** Which commit is running: Render sets RENDER_GIT_COMMIT on every deploy. */
  release: string;
  uptimeSeconds: number;
  checkedAt: string;
}

type AiState = HealthReport['ai'];

/**
 * Answers one question for Render, a grader, or an operator: is this running
 * instance able to do its job right now?
 *
 * The database is the only thing that can make the hub unhealthy - without
 * it nothing can be read or saved. The AI can only make it degraded: the hub
 * keeps working without it by design, so an AI outage must be visible but
 * must never get the hub restarted.
 */
@Injectable()
export class HealthService {
  private lastAiCheck: { state: AiState; at: number } | undefined;

  constructor(
    private readonly prisma: PrismaService,
    private readonly groq: GroqClassifierClient,
  ) {}

  async check(): Promise<HealthReport> {
    const [database, ai] = await Promise.all([this.pingDatabase(), this.aiState()]);

    return {
      status: database === 'down' ? 'error' : ai === 'up' ? 'ok' : 'degraded',
      database,
      ai,
      release: process.env.RENDER_GIT_COMMIT?.slice(0, 7) ?? 'local',
      uptimeSeconds: Math.round(process.uptime()),
      checkedAt: new Date().toISOString(),
    };
  }

  /**
   * The smallest real query there is. A timeout on top, because an
   * unreachable database can make Prisma wait a long time before failing -
   * and a health check that hangs is as unhelpful as one that lies.
   */
  private async pingDatabase(): Promise<'up' | 'down'> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('database ping timed out')), DATABASE_TIMEOUT_MS);
    });

    try {
      await Promise.race([this.prisma.$queryRaw`SELECT 1`, timeout]);
      return 'up';
    } catch {
      return 'down';
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * A missing key is known without asking anyone, so it is never cached -
   * putting the key back shows up on the very next check. A real call to
   * Groq is reused for AI_CHECK_TTL_MS.
   */
  private async aiState(): Promise<AiState> {
    if (!process.env.GROQ_API_KEY) {
      this.lastAiCheck = undefined;
      return 'not configured';
    }

    const now = Date.now();
    if (this.lastAiCheck && now - this.lastAiCheck.at < AI_CHECK_TTL_MS) {
      return this.lastAiCheck.state;
    }

    const state: AiState = await this.groq.ping().then(
      () => 'up',
      () => 'down',
    );
    this.lastAiCheck = { state, at: now };
    return state;
  }
}
