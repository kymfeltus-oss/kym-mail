import { AdzunaJobSearchProvider } from "@/integrations/adzuna/adzuna-job-search-provider";
import { getJobSearchEnv } from "@/lib/env";

export function getJobSearchProvider() {
  return new AdzunaJobSearchProvider(getJobSearchEnv());
}
