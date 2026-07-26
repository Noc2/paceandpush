import type {
  Board,
  LeaderboardRow,
  PublicProfileResponse,
} from "@paceandpush/api-contracts";
import { Redis } from "@upstash/redis";

export interface PublicSearchRow {
  row: LeaderboardRow;
  searchText: string;
}

export interface PublicPeriodProjection {
  version: 1;
  generatedAt: string;
  period: string;
  boards: Record<Board, LeaderboardRow[]>;
  searchRows: PublicSearchRow[];
}

export interface PublicProjectionStore {
  deleteProfiles(login: string, periods: Iterable<string>): Promise<void>;
  getHiddenLogins(logins: Iterable<string>): Promise<Set<string>>;
  getPeriod(period: string): Promise<PublicPeriodProjection | null>;
  getProfile(login: string, period: string): Promise<PublicProfileResponse | null>;
  hideLogin(login: string): Promise<string>;
  replacePeriod(
    projection: PublicPeriodProjection,
    profiles: PublicProfileResponse[],
  ): Promise<void>;
  showLogin(login: string, visibilityToken: string): Promise<boolean>;
}

export class PublicProjectionUnavailableError extends Error {
  constructor(message = "Public activity data is temporarily unavailable.", options?: ErrorOptions) {
    super(message, options);
    this.name = "PublicProjectionUnavailableError";
  }
}

const keyPrefix = "paceandpush:public:v1";
const hiddenLoginsKey = `${keyPrefix}:hidden-logins`;

let storeOverride: PublicProjectionStore | null = null;
let redisStore: PublicProjectionStore | null = null;

export function getPublicProjectionStore(): PublicProjectionStore {
  if (storeOverride) return storeOverride;

  const url =
    process.env.PUBLIC_VISIBILITY_KV_REST_API_URL ??
    process.env.PUBLIC_VISIBILITY_UPSTASH_REDIS_REST_URL;
  const token =
    process.env.PUBLIC_VISIBILITY_KV_REST_API_TOKEN ??
    process.env.PUBLIC_VISIBILITY_UPSTASH_REDIS_REST_TOKEN;

  if (url && token) {
    redisStore ??= new RedisPublicProjectionStore(
      new Redis({
        url,
        token,
        readYourWrites: true,
        enableAutoPipelining: true,
      }),
    );
    return redisStore;
  }

  if (process.env.NODE_ENV === "production") {
    throw new PublicProjectionUnavailableError(
      "The public projection store is not configured.",
    );
  }

  return developmentStore();
}

export function setPublicProjectionStoreForTests(
  store: PublicProjectionStore | null,
): void {
  storeOverride = store;
}

export function createInMemoryPublicProjectionStore(): PublicProjectionStore {
  return new InMemoryPublicProjectionStore();
}

class RedisPublicProjectionStore implements PublicProjectionStore {
  constructor(private readonly redis: Redis) {}

  async deleteProfiles(login: string, periods: Iterable<string>): Promise<void> {
    const keys = [...new Set(periods)].map((period) => profileKey(login, period));
    if (keys.length === 0) return;
    await this.execute(() => this.redis.del(...keys));
  }

  async getHiddenLogins(logins: Iterable<string>): Promise<Set<string>> {
    const normalizedLogins = [...new Set([...logins].map(normalizeLogin))];
    if (normalizedLogins.length === 0) return new Set();
    const membership = await this.execute(() =>
      this.redis.smismember(hiddenLoginsKey, normalizedLogins),
    );
    return new Set(
      normalizedLogins.filter((_, index) => membership[index] === 1),
    );
  }

  async getPeriod(period: string): Promise<PublicPeriodProjection | null> {
    return this.execute(() => this.redis.get<PublicPeriodProjection>(periodKey(period)));
  }

  async getProfile(
    login: string,
    period: string,
  ): Promise<PublicProfileResponse | null> {
    return this.execute(() =>
      this.redis.get<PublicProfileResponse>(profileKey(login, period)),
    );
  }

  async hideLogin(login: string): Promise<string> {
    const normalizedLogin = normalizeLogin(login);
    return this.execute(async () => {
      const revision = await this.redis.eval<string[], number>(
        `
          local revision = redis.call("INCR", KEYS[1])
          redis.call("SADD", KEYS[2], ARGV[1])
          return revision
        `,
        [visibilityRevisionKey(normalizedLogin), hiddenLoginsKey],
        [normalizedLogin],
      );
      return String(revision);
    });
  }

  async replacePeriod(
    projection: PublicPeriodProjection,
    profiles: PublicProfileResponse[],
  ): Promise<void> {
    await this.execute(async () => {
      const transaction = this.redis.multi();
      transaction.set(periodKey(projection.period), projection);
      for (const profile of profiles) {
        transaction.set(
          profileKey(profile.login, profile.score.period),
          profile,
        );
      }
      await transaction.exec();
    });
  }

  async showLogin(login: string, visibilityToken: string): Promise<boolean> {
    const normalizedLogin = normalizeLogin(login);
    const removed = await this.execute(() =>
      this.redis.eval<string[], number>(
        `
          if redis.call("GET", KEYS[1]) ~= ARGV[1] then
            return 0
          end
          return redis.call("SREM", KEYS[2], ARGV[2])
        `,
        [visibilityRevisionKey(normalizedLogin), hiddenLoginsKey],
        [visibilityToken, normalizedLogin],
      ),
    );
    return removed === 1;
  }

  private async execute<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      throw new PublicProjectionUnavailableError(undefined, { cause: error });
    }
  }
}

class InMemoryPublicProjectionStore implements PublicProjectionStore {
  private readonly hiddenLogins = new Set<string>();
  private readonly periods = new Map<string, PublicPeriodProjection>();
  private readonly profiles = new Map<string, PublicProfileResponse>();
  private readonly visibilityRevisions = new Map<string, number>();

  async deleteProfiles(login: string, periods: Iterable<string>): Promise<void> {
    for (const period of periods) {
      this.profiles.delete(profileKey(login, period));
    }
  }

  async getHiddenLogins(logins: Iterable<string>): Promise<Set<string>> {
    return new Set(
      [...logins]
        .map(normalizeLogin)
        .filter((login) => this.hiddenLogins.has(login)),
    );
  }

  async getPeriod(period: string): Promise<PublicPeriodProjection | null> {
    return structuredClone(this.periods.get(period) ?? null);
  }

  async getProfile(
    login: string,
    period: string,
  ): Promise<PublicProfileResponse | null> {
    return structuredClone(this.profiles.get(profileKey(login, period)) ?? null);
  }

  async hideLogin(login: string): Promise<string> {
    const normalizedLogin = normalizeLogin(login);
    const revision = (this.visibilityRevisions.get(normalizedLogin) ?? 0) + 1;
    this.visibilityRevisions.set(normalizedLogin, revision);
    this.hiddenLogins.add(normalizedLogin);
    return String(revision);
  }

  async replacePeriod(
    projection: PublicPeriodProjection,
    profiles: PublicProfileResponse[],
  ): Promise<void> {
    this.periods.set(projection.period, structuredClone(projection));
    for (const profile of profiles) {
      this.profiles.set(
        profileKey(profile.login, profile.score.period),
        structuredClone(profile),
      );
    }
  }

  async showLogin(login: string, visibilityToken: string): Promise<boolean> {
    const normalizedLogin = normalizeLogin(login);
    if (
      String(this.visibilityRevisions.get(normalizedLogin) ?? 0) !==
      visibilityToken
    ) {
      return false;
    }
    return this.hiddenLogins.delete(normalizedLogin);
  }
}

function developmentStore(): PublicProjectionStore {
  const globalStore = globalThis as typeof globalThis & {
    __paceAndPushPublicProjectionStore?: PublicProjectionStore;
  };
  globalStore.__paceAndPushPublicProjectionStore ??=
    createInMemoryPublicProjectionStore();
  return globalStore.__paceAndPushPublicProjectionStore;
}

function periodKey(period: string): string {
  return `${keyPrefix}:period:${period}`;
}

function profileKey(login: string, period: string): string {
  return `${keyPrefix}:profile:${normalizeLogin(login)}:${period}`;
}

function visibilityRevisionKey(login: string): string {
  return `${keyPrefix}:visibility-revision:${normalizeLogin(login)}`;
}

function normalizeLogin(login: string): string {
  return login.trim().toLowerCase();
}
