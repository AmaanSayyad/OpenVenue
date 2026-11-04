export async function fetchRwaMeta(contract: string) {
  return {
    ok: true as const,
    contract,
    chain: "monad",
    issuer: "OpenVenue registry",
    description: "Tokenized equity wrapper registered for Monad routing.",
  };
}
