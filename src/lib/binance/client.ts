import crypto from "crypto";

const BASE_URL = "https://web3.binance.com/build";
const BUILD_PREFIX = "/build";

export type OcResult<T> = {
  code: number | string;
  msg: string;
  data: T;
  timestamp?: number;
  success?: boolean;
};

function credentials() {
  const apiKey = process.env.OC_API_KEY;
  const secretKey = process.env.OC_SECRET_KEY;
  if (!apiKey || !secretKey) {
    throw new Error(
      "Missing OC_API_KEY / OC_SECRET_KEY. Copy .env.example to .env.local.",
    );
  }
  return { apiKey, secretKey };
}

function encodeQuery(params: Record<string, string | number | boolean | undefined>) {
  return Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(
      ([k, v]) =>
        `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`,
    )
    .join("&");
}

export async function ocGet<T>(
  path: string,
  params: Record<string, string | number | boolean | undefined> = {},
): Promise<OcResult<T>> {
  const { apiKey, secretKey } = credentials();
  const query = encodeQuery(params);
  const fullPath = query ? `${path}?${query}` : path;
  const timestamp = new Date().toISOString();
  const requestPath = BUILD_PREFIX + fullPath;
  const preHash = timestamp + "GET" + requestPath + "";
  const signature = crypto
    .createHmac("sha256", secretKey)
    .update(preHash, "utf8")
    .digest("base64");

  const res = await fetch(BASE_URL + fullPath, {
    method: "GET",
    headers: {
      "X-OC-APIKEY": apiKey,
      "X-OC-TIMESTAMP": timestamp,
      "X-OC-SIGN": signature,
      "X-OC-RECV-WINDOW": "60000",
    },
    cache: "no-store",
  });

  const json = (await res.json()) as OcResult<T>;
  return json;
}

export async function ocPost<T>(
  path: string,
  body: unknown,
): Promise<OcResult<T>> {
  const { apiKey, secretKey } = credentials();
  const rawBody = JSON.stringify(body ?? {});
  const timestamp = new Date().toISOString();
  const requestPath = BUILD_PREFIX + path;
  const preHash = timestamp + "POST" + requestPath + rawBody;
  const signature = crypto
    .createHmac("sha256", secretKey)
    .update(preHash, "utf8")
    .digest("base64");

  const res = await fetch(BASE_URL + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-OC-APIKEY": apiKey,
      "X-OC-TIMESTAMP": timestamp,
      "X-OC-SIGN": signature,
      "X-OC-RECV-WINDOW": "60000",
    },
    body: rawBody,
    cache: "no-store",
  });

  const json = (await res.json()) as OcResult<T>;
  return json;
}

export function isOcSuccess(result: OcResult<unknown>) {
  return (
    result.code === 0 ||
    result.code === "0" ||
    result.code === "000000000" ||
    result.success === true
  );
}
