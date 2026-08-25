export const workArrangements = ["REMOTE", "HYBRID", "ONSITE", "UNKNOWN"] as const;
export type WorkArrangement = (typeof workArrangements)[number];

export const employmentTypes = ["FULL_TIME", "PART_TIME", "CONTRACT", "PERMANENT"] as const;
export type EmploymentType = (typeof employmentTypes)[number];

export type JobSearchFilters = {
  location: string;
  workArrangement: "ANY" | "REMOTE" | "HYBRID";
  datePostedDays: 1 | 3 | 7 | 14 | 30 | null;
  employmentType: "ANY" | EmploymentType;
  minimumSalary: number | null;
};

export type JobSearchRequest = {
  originalQuery: string;
  normalizedQuery: string;
  normalizedTerms: string[];
  filters: JobSearchFilters;
  page: number;
  pageSize: number;
};

export type JobProviderMetadata = {
  categoryTag: string | null;
  categoryLabel: string | null;
  providerSource: string | null;
  salaryIsPredicted: boolean;
};

export type NormalizedJob = {
  provider: "ADZUNA";
  providerJobId: string;
  title: string;
  companyName: string;
  companyIdentifier: string | null;
  locationText: string | null;
  workArrangement: WorkArrangement;
  employmentTypes: EmploymentType[];
  salaryMinimum: number | null;
  salaryMaximum: number | null;
  salaryCurrency: "USD" | null;
  salaryPeriod: "YEAR" | null;
  descriptionText: string;
  postedAt: string | null;
  sourceName: "Adzuna";
  sourceUrl: string;
  applicationUrl: string;
  discoveredAt: string;
  providerMetadata: JobProviderMetadata;
  matchedTitleTerms: string[];
  matchedDescriptionTerms: string[];
  strongKeywordMatch: boolean;
};

export type JobSearchResponse = {
  jobs: NormalizedJob[];
  total: number;
  page: number;
  pageSize: number;
  hasNextPage: boolean;
  sourceName: "Adzuna";
};

export interface JobSearchProvider {
  readonly providerName: "ADZUNA";
  search(request: JobSearchRequest): Promise<JobSearchResponse>;
}
