# Document attachment uploads and review workflow

All feature work goes through a feature branch and a PR to master. CodeRabbit auto-reviews PRs, including drafts; Backend CI runs typecheck, tests, and the production build. Master merges trigger Northflank deployment. Repository rules are in AGENTS.md. GitHub branch-protection settings must enforce these checks if mechanical prevention of direct pushes is required; a YAML file alone does not change repository permissions.

## Upload contract

POST /api/v1/document-tracking/:id/attachments/upload accepts authenticated multipart form data: file (one file, maximum 32 MB), name, kind (INCOMING/OUTGOING/SUPPORTING), and version. It returns the updated document detail. The existing JSON attachments endpoint continues to accept HTTP(S) links.

The API verifies document access, current-handler/admin permission and version before storage, then rechecks permission and claims the version in the existing attachment transaction. R2 keys use generated UUIDs; original names are display metadata. A transaction failure removes the unlinked R2 object. Cleanup failures are logged without hiding the original error.

## Selective VirusTotal policy

All uploads through R2 share this policy. PNG, JPEG and WebP bypass VirusTotal only when extension, MIME and decoder format agree and the image is fully decoded/re-encoded (metadata/trailing payloads are discarded). Animated images and decoder failures remain scanned. A 16-million-pixel decoder limit bounds processing.

Only .txt files declared text/plain with valid UTF-8, no binary control bytes, no detected active-content markers, and no risky compound extension bypass scanning. Text and non-raster downloads use Content-Disposition: attachment. Office documents, PDF, SVG, archives, executable/script formats, unknown types and mismatches continue through VirusTotal. This is a risk-based optimization, not a claim that any format is inherently malware-free. Scan errors fail closed. Existing uploaded files are not rewritten or reclassified.

No schema migration is required. The frontend uses the new route only after this backend PR is merged and deployed. Tests mock storage and scanning; they never submit user files to external services.