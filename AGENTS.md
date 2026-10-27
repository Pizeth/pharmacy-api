# Backend development rules

## Branches, review, and deployment

- Develop on a `codex/` feature branch and open a pull request targeting `master`.
- Never push feature changes directly to `master`; merging master deploys to Northflank.
- Wait for CodeRabbit and CI, evaluate review findings, and resolve valid issues before merging.
- Do not bypass failing or pending checks. Merge only when the user has authorized it.
- For frontend/backend contracts, document whether the API change has been deployed.

## Uploads and document tracking

- Reuse the existing R2 service; do not introduce a parallel storage integration.
- Document attachment mutations require current database authorization and optimistic version checks.
- An upload that cannot be linked must be removed from storage; preserve the original mutation error.
- Never exempt uploads from scanning based only on filename or browser MIME type.
- Only re-encoded PNG/JPEG/WebP images and checked inert UTF-8 plain text may skip VirusTotal.
- Office files, PDF, SVG, archives, executable/script formats, unknown types, and mismatches remain scanned. Scanner failure must fail the upload.
- Keep external scan/storage calls outside database transactions. Do not add tests that upload real documents or contact VirusTotal.