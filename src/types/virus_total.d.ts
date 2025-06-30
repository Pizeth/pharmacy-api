// User-provided Type Definitions (with the new union type)
enum BaseThreatCategory {
  HARMLESS = 'harmless',
  UNDETECTED = 'undetected',
  SUSPICIOUS = 'suspicious',
  MALICIOUS = 'malicious',
  TIMEOUT = 'timeout',
}

enum ExtendedThreatCategory {
  TYPE_UNSUPPORT = 'type-unsupported',
  FAILURE = 'failure',
  CONFIRMED_TIMEOUT = 'confirmed-timeout',
}

type ThreatCategory = BaseThreatCategory | ExtendedThreatCategory;
export interface VirusTotalApiErrorResponse {
  error: {
    code: string; // e.g., "NotFoundError", "AuthenticationRequiredError", "QuotaExceededError"
    message: string; // Detailed error message
  };
}
export interface VirusTotalResponse {
  data: FileData;
}

interface FileData {
  attributes: FileAttributes;
  type: string; // e.g., "file"
  id: string; // Typically the SHA256 hash of the file
  links: Links;
}

interface FileAttributes {
  last_analysis_stats: LastAnalysisStats;
  last_analysis_results: { [key: string]: EngineResult }; // Dictionary of engine results
  md5: string;
  sha1: string;
  sha256: string;
  size: number;
  meaningful_name?: string; // Optional, may not always be present
  type_description?: string;
  first_submission_date?: number; // Unix timestamp
  last_submission_date?: number; // Unix timestamp
  last_analysis_date?: number; // Unix timestamp
  names?: string[];
  tags?: string[];
  reputation?: number;
  times_submitted?: number;
  total_votes?: TotalVotes;
  popular_threat_classification?: PopularThreatClassification;
  // Add other attributes you expect, e.g., exiftool, pe_info, etc.
}

interface LastAnalysisStats {
  harmless: number;
  'type-unsupported': number;
  suspicious: number;
  'confirmed-timeout': number;
  timeout: number;
  failure: number;
  malicious: number;
  undetected: number;
}

interface EngineResult {
  category: ThreatCategory;
  engine_name: string;
  engine_update: string; // Date string e.g., "20240530"
  engine_version: string;
  // method: 'blacklist' | 'heuristic' | 'manual' | 'machine-learning' | string; // string for other potential values
  method: string; // string for other potential values
  result: string | null; // Detection name or null if undetected/clean
}

interface TotalVotes {
  harmless: number;
  malicious: number;
}

interface PopularThreatClassification {
  suggested_threat_label: string;
  popular_threat_category: ThreatCategoryOrName[];
  popular_threat_name: ThreatCategoryOrName[];
}

interface ThreatCategoryOrName {
  count: number;
  value: string;
}

interface Links {
  self: string;
  // item?: string; // Depending on the endpoint, an 'item' link might exist
}

// This single interface now represents BOTH the initial file upload response
// and the full analysis report by making `attributes` optional.
export interface VirusTotalAnalysisResponse {
  data: AnalysisData;
  meta?: UrlAnalysisMeta;
}
// URL Analysis Report Interfaces
// export interface VirusTotalUrlAnalysisResponse {
//   data: UrlAnalysisData;
//   meta?: UrlAnalysisMeta; // Meta information might be present
// }

// export interface VirusTotalFileUploadResponse {
//   data: FileUploadResponse;
// }

interface FileUploadResponse {
  type: 'analysis'; // For URL scan results, the type is 'analysis'
  id: string; // The analysis ID (specific to this scan instance)
  links: AnalysisLinks;
}

interface AnalysisData extends FileUploadResponse {
  attributes?: UrlAnalysisAttributes;
}

interface UrlAnalysisAttributes {
  date: number; // Unix timestamp of the analysis
  status: 'queued' | 'inprogress' | 'completed' | 'failed'; // Key differentiator
  stats: UrlAnalysisStats;
  results: { [key: string]: UrlEngineResult }; // Dictionary of security vendor results
  url?: string; // The URL that was analyzed (often in meta, but can be here too)
  // Other attributes like threat_names, reputation, etc., might be present
  // depending on the scan and findings.
}

interface UrlAnalysisStats {
  harmless: number;
  malicious: number;
  suspicious: number;
  undetected: number;
  timeout: number;
}

interface UrlEngineResult {
  category: BaseThreatCategory;
  result: string; // e.g., "clean site", "malware site", "phishing site"
  // method: 'blacklist' | 'heuristic' | string; // Other methods might exist
  method: string; // Other methods might exist
  engine_name: string;
}

interface AnalysisLinks {
  self: string;
  item?: string; // Link to the underlying URL object
}

interface UrlAnalysisMeta {
  url_info?: UrlInfo;
}

interface UrlInfo {
  url: string;
  id: string; // The ID of the URL object itself (usually a hash of the URL)
}

export type VirusTotalReport =
  | VirusTotalResponse // The report for an existing file hash
  | VirusTotalAnalysisResponse // An analysis object (either bare or full)
  | VirusTotalApiErrorResponse; // An error
