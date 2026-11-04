import "server-only";
import { randomUUID } from "node:crypto";
import {
  createPlatformService,
  DomainError,
  type Actor,
  type PlatformService,
  type PlatformRepository,
} from "@devmentor/core";
import { createPlatformRepository } from "@devmentor/db";
import { getAuthRuntime } from "./auth";
import { withDatabaseServices } from "./services";

export function withPlatform<T>(
  callback: (
    service: PlatformService,
    repository: PlatformRepository,
  ) => Promise<T>,
): Promise<T> {
  return withDatabaseServices(({ entityManager }) => {
    const repository = createPlatformRepository(entityManager);
    return callback(
      createPlatformService({
        repository,
        now: () => new Date(),
        id: randomUUID,
      }),
      repository,
    );
  });
}
export async function authenticate(
  request: Request,
  repository: PlatformRepository,
): Promise<Actor> {
  const runtime = getAuthRuntime();
  const session = await runtime.auth.api.getSession({
    headers: request.headers,
    query: { disableCookieCache: true },
  });
  if (!session || !session.user.emailVerified)
    throw new DomainError("UNAUTHENTICATED", 401);
  await repository.ensureUser({
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
  });
  const proof = await runtime.pool.query<{ present: boolean }>(
    "select exists(select 1 from auth.mfa_session where session_id=$1) as present",
    [session.session.id],
  );
  return repository.getActor(
    session.user.id,
    runtime.env.APP_MODE === "demo" || proof.rows[0]?.present === true,
  );
}
