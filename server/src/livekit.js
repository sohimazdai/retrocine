// Access tokens for LiveKit (HS256 JWT), without the server SDK.
import { createHmac } from "node:crypto";

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");

export function livekitToken({
  apiKey,
  apiSecret,
  room,
  identity,
  name,
  ttl = 6 * 3600,
}) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64({ alg: "HS256", typ: "JWT" });
  const payload = b64({
    iss: apiKey,
    sub: identity,
    name,
    nbf: now - 10,
    exp: now + ttl,
    video: {
      room,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      canUpdateOwnMetadata: true,
    },
  });
  const signature = createHmac("sha256", apiSecret)
    .update(`${header}.${payload}`)
    .digest("base64url");
  return `${header}.${payload}.${signature}`;
}

export function livekitConfig(env) {
  if (!env.LIVEKIT_URL || !env.LIVEKIT_API_KEY || !env.LIVEKIT_API_SECRET)
    return null;
  return {
    url: env.LIVEKIT_URL,
    apiKey: env.LIVEKIT_API_KEY,
    apiSecret: env.LIVEKIT_API_SECRET,
  };
}
