const isProduction = import.meta.env.PROD;

export const COLLECTOR_API_URL = isProduction 
  ? "https://collectorlemlist-production.up.railway.app/collect"
  : "/api/collect";
export const CLEAN_BODY_API_URL = isProduction
  ? "https://parsercleaner-production.up.railway.app/clean"
  : "/api/clean";
export const CLASSIFY_API_URL = isProduction
  ? "https://classifier-production-a03a.up.railway.app/classify"
  : "/api/classify";
export const RESPONSE_GENERATOR_API_URL = isProduction
  ? "https://responsegenerator-production.up.railway.app/generate"
  : "/api/generate";
export const SEND_EMAIL_API_URL = isProduction
  ? "https://collectorlemlist-production.up.railway.app/send_email"
  : "/api/send_email";
