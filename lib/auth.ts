const SECRET = process.env.SESSION_SECRET || "mybilling-fallback-secret-change-me-2026";

async function getCryptoKey() {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(SECRET);
  return crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function signSession(payload: any): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(payload));
  const key = await getCryptoKey();
  const signature = await crypto.subtle.sign("HMAC", key, data);
  const signatureArray = Array.from(new Uint8Array(signature));
  const signatureHex = signatureArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString("base64");
  return `${payloadBase64}.${signatureHex}`;
}

export async function verifySession(token: string): Promise<any | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [payloadBase64, signatureHex] = parts;

    const payloadStr = Buffer.from(payloadBase64, "base64").toString("utf-8");
    const encoder = new TextEncoder();
    const data = encoder.encode(payloadStr);

    const matches = signatureHex.match(/.{1,2}/g);
    if (!matches) return null;
    const sigBytes = new Uint8Array(matches.map((byte) => parseInt(byte, 16)));

    const key = await getCryptoKey();
    const isValid = await crypto.subtle.verify("HMAC", key, sigBytes, data);
    if (!isValid) return null;

    const payload = JSON.parse(payloadStr);
    if (payload.exp && Date.now() > payload.exp) {
      return null;
    }
    return payload;
  } catch (e) {
    return null;
  }
}
