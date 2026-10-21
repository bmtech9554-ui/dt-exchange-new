/** Shared Redis settings. No production in-memory fallback. */
export function redisConnection() {
  const raw = process.env.REDIS_URL;
  if (!raw) throw new Error("REDIS_REQUIRED");
  const u = new URL(raw);
  if (!["redis:", "rediss:"].includes(u.protocol))
    throw new Error("INVALID_REDIS_URL");
  return {
    host: u.hostname,
    port: Number(u.port || 6379),
    username: u.username ? decodeURIComponent(u.username) : undefined,
    password: u.password ? decodeURIComponent(u.password) : undefined,
    db: Number(u.pathname.slice(1) || 0),
    connectTimeout: 5000,
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    retryStrategy: (attempt: number) => Math.min(2000, attempt * 100),
    ...(u.protocol === "rediss:" ? { tls: {} } : {}),
  };
}
export const reliableJobs = {
  attempts: 5,
  backoff: { type: "exponential", delay: 5000 },
  removeOnComplete: { age: 3600, count: 5000 },
  removeOnFail: false,
};

export function engagementQueueName() {
  const name = process.env.NOTIFICATION_QUEUE ?? "dt-engagement";
  if (!/^[a-z][a-z0-9-]{2,50}$/.test(name))
    throw new Error("INVALID_NOTIFICATION_QUEUE");
  return name;
}

/** Preserve legacy development queues; isolate staging/production namespaces. */
export function queuePrefix() {
  const value =
    process.env.QUEUE_PREFIX ||
    (process.env.DEPLOYMENT_ENV === "staging"
      ? "dt-staging"
      : process.env.NODE_ENV === "production"
        ? "dt-production"
        : "bull");
  if (!/^[a-z][a-z0-9-]{1,50}$/.test(value))
    throw new Error("INVALID_QUEUE_PREFIX");
  return value;
}
