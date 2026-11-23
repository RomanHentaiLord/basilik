import { altarRouter } from "./routers/altar";
import { basiliskRouter } from "./routers/basilisk";
import { createCallerFactory, createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  basilisk: basiliskRouter,
  altar: altarRouter,
});

export type AppRouter = typeof appRouter;

/** Call procedures directly from Server Components. */
export const createCaller = createCallerFactory(appRouter);
