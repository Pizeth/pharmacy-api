# Review integrations

## Static analysis

`.codacy.yml` excludes build/dependency artifacts without suppressing source or tests.
`.deepsource.toml` identifies TypeScript tests and enables JavaScript/TypeScript analysis
(React in the client). The API also enables Dockerfile analysis.

These files do not install the GitHub Apps. Install Codacy Production and DeepSource
on only `Pizeth/pharmacy-client` and `Pizeth/pharmacy-api`, activate each repository,
and confirm a completed baseline scan. Keep Codacy status checks enabled: public
repository analysis depends on them. For DeepSource, keep TOML configuration enabled.
Do not make a new check required until its baseline and first PR analysis succeed.
Do not enable paid trials, AI credits or automatic formatter/fix commits during setup.

## Review policy

CodeRabbit remains the primary reviewer. Its latest setup-PR comments state that automatic reviews are skipped for repositories with fewer than ten stars; request reviews manually when available. Batch development in draft PRs
and request review after a coherent update; avoid repeated review requests during
provider cooldowns. Backup findings are suggestions to verify, not permission to
bypass CI or merge unresolved authorization concerns.

Configure diffray, cubic and Sourcery as manual/label-gated backups where their
current dashboards support it. Disable duplicate summaries and automatic fixes.
LlamaPReview reviews non-draft opening/ready events rather than every push; its
hosted limit is currently three attempts per repository per UTC day, with a shared
capacity limit. Check the provider's current settings before assuming a bot is
manual-only. Record the verified trigger and first successful review after setup.

PR-Agent requires a separately configured model-provider key. Use a repository
Actions secret (recommended name `PR_AGENT_GEMINI_API_KEY`) and a supported model;
never commit or paste the key. A manual workflow must restrict callers to trusted
maintainers, pin its action and runtime, and never execute PR code with secrets.
BYOK removes the hosted-review quota, not the model provider's limits or costs.
Do not add a workflow that claims to run until the key and model are available.

## Setup status

The following is an operator-observed dashboard snapshot from 7–8 November 2026, not a result established by adding these configuration files. As of 7 November 2026, Codacy, DeepSource, diffray, cubic, LlamaPReview and Sourcery GitHub Apps are installed on the two named repositories. Codacy has both repositories activated and API baseline results are visible. DeepSource was activated on both repositories on 8 November 2026 using dashboard analyzer settings after the onboarding generator stalled. Both persisted CODE ANALYSIS ACTIVE and started their first baseline analysis. The client enables React, NodeJS, Browser and Jest; the API enables NodeJS, Jest and Docker. Diffray dashboard GitHub sign-in remains stalled. Sourcery baseline scans completed (findings require triage). Cubic account displays a seven-day introductory trial with no payment method. Its current subscription documentation confirms fallback to the free plan and a separate public-repository fair-use allowance; no paid plan was selected. No payment details were supplied.
Runtime review triggers must be verified separately for each
repository. No coverage reporter token is required for source analysis; coverage
upload can be added later with its own restricted secret.

## References

- https://docs.codacy.com/repositories-configure/codacy-configuration-file/
- https://docs.codacy.com/faq/troubleshooting/why-isnt-my-public-repository-being-analyzed/
- https://docs.deepsource.com/docs/platform/reference/core-analyzers
- https://docs.deepsource.com/docs/platform/reference/billing
- https://github.com/apps/llamapreview
- https://docs.sourcery.ai/reviews/configure/
- https://github.com/The-PR-Agent/pr-agent

## Verified backup settings

- Sourcery: automatic reviews require the sourcery-review label; manual @sourcery-ai review remains available. Summaries, review guides, tips and automatic approvals are disabled. Draft reviews remain off.
- cubic: head-branch ignore glob ** skips automatic reviews while manual mentions remain available. Incremental automatic reviews and draft reviews are off, sensitivity is Medium, automatic fixes and approvals are off. Use @cubic-dev-ai review this pull request when a backup is needed.
- LlamaPReview: installed on both repositories; opening/ready non-draft event behavior follows its hosted defaults. First completed review remains unverified.
- PR-Agent: the secret name is verified in both repositories. The manual-review workflow uses a pinned container and Gemini 3.8 Flash. Live acceptance is tracked in the setup PRs.

## PR-Agent Gemini key setup

1. Create a dedicated Gemini API key in Google AI Studio: https://aistudio.google.com/api-keys
2. In each repository, open Settings > Secrets and variables > Actions > New repository secret.
3. Set the name to `PR_AGENT_GEMINI_API_KEY` and paste the key only in GitHub's secret value field.
4. Tell the maintainer the secret has been saved; do not put its value in chat, source, application env files, or workflow logs.
5. The manual workflow maps this secret to `GOOGLE_AI_STUDIO.GEMINI_API_KEY` and selects a supported `gemini/...` model. `GITHUB_TOKEN` is supplied automatically by Actions.

Use a separate key per repository if independent rotation is useful. Provider quotas still apply. See https://ai.google.dev/gemini-api/docs/api-key and https://github.com/The-PR-Agent/pr-agent/blob/main/docs/docs/installation/github.md .

## Run the PR-Agent backup

On a non-draft pull request from a branch in this repository, an explicitly allowlisted maintainer (currently Pizeth)
adds the `pr-agent-review` label. One review is requested; pushes do not trigger it.
To review a later revision, wait for completion, remove the label, and add it again.
Fork PRs and requests by other actors are intentionally skipped. The Actions job
checks that the secret is configured without printing its value. It has read-only
source permission and write access only to issues/PRs for review output.

The workflow does not check out or execute pull-request code, rewrite descriptions,
or run automatic code suggestions. It pins the Docker runtime by digest. Review
findings still require verification and do not replace CI or authorize a merge.
If the model/provider quota fails, the job must be investigated rather than treated
as a successful review. No fallback model is configured, avoiding unexpected usage.

## Verification evidence and remaining gates

Dashboard observations are separate from repository configuration and may change.
Installed-app access is visible to account administrators at https://github.com/settings/installations .
Activated repositories can be checked at https://app.codacy.com/organizations/gh/Pizeth/repositories ,
https://app.deepsource.com/gh/Pizeth/pharmacy-client and https://app.deepsource.com/gh/Pizeth/pharmacy-api .

- Client live acceptance succeeded and posted a review: https://github.com/Pizeth/pharmacy-client/actions/runs/42423574365 . The review's claim that Gemini 3.8 Flash is invalid is contradicted by that same run's successful inference and the upstream Gemini configuration example.
- API acceptance reached inference but first timed out, then received provider HTTP 503 high-demand responses: https://github.com/Pizeth/pharmacy-api/actions/runs/42425082191 . These failures correctly produced a failed job. A successful completed API review is still required; do not call it green based on secret presence alone.
- Both workflows allow 300 seconds per model request while retaining a 15-minute job limit. Model fallbacks remain disabled.
- The trusted caller list is explicit rather than comparing the caller with a repository owner that could be an organization. Review that list when maintainers change or repositories transfer.
- Installing these apps does not resolve baseline findings or establish merge readiness. See client PR 58 and API PR 14 for current checks and acceptance status.
