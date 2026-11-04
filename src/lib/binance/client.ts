/**
 * Legacy OC client stub - OpenVenue no longer calls Binance.
 * All market data is Monad-local.
 */

export type OcResult<T = unknown> = {
  code: string | number;
  msg: string;
  data?: T;
};

export function isOcSuccess(result: OcResult | { code?: string | number }) {
  return result.code === 0 || result.code === "0" || result.code === "000000000";
}

export async function ocGet<T = unknown>(
  _path: string,
  _params?: Record<string, unknown>,
): Promise<OcResult<T>> {
  return {
    code: "MONAD_ONLY",
    msg: "OpenVenue runs on Monad only",
    data: undefined,
  };
}

export async function ocPost<T = unknown>(
  _path: string,
  _opts?: Record<string, unknown>,
): Promise<OcResult<T>> {
  return {
    code: "MONAD_ONLY",
    msg: "OpenVenue runs on Monad only",
    data: undefined,
  };
}
