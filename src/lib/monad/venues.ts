/**
 * Compatibility surface - venue registry lives in @/lib/venue/issuers.
 * Fees settle on Monad; stock buys can execute on BSC (bStocks/Ondo/xStocks) or Monad (Anchored).
 */
export {
  CORE_UNDERLYINGS,
  PLATFORM_FEE_BPS,
  listExploreMarkets,
  platformFeeRecipient,
  referencePrice,
  searchVenues as searchMonadVenues,
  type IssuerId,
  type VenueListing as MonadVenueListing,
} from "@/lib/venue/issuers";
