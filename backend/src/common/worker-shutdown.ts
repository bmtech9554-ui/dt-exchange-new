/** Deadline is not a retry authorization: unsettled provider submissions remain unknown. */
export function registerWorkerShutdown(close: () => Promise<void>) {
  let closing = false;
  const stop = () => {
    if (closing) return;
    closing = true;
    const timer = setTimeout(() => {
      console.error(JSON.stringify({ event: "worker_shutdown_deadline" }));
      process.exit(1);
    }, 30000);
    timer.unref();
    void close()
      .then(() => clearTimeout(timer))
      .catch(() => {
        console.error(JSON.stringify({ event: "worker_shutdown_failed" }));
        process.exitCode = 1;
      });
  };
  process.once("SIGTERM", stop);
  process.once("SIGINT", stop);
}
