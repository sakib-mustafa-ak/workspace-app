export default () => ({
  app: {
    port: Number(process.env.PORT ?? 4000),
    env: process.env.NODE_ENV ?? "development",
  },

  database: {
    url: process.env.DATABASE_URL!,
  },

  redis: {
    host: process.env.REDIS_HOST!,
    port: Number(process.env.REDIS_PORT),
  },
});