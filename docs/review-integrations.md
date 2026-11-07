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

CodeRabbit remains the primary automatic reviewer. Batch development in draft PRs
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

Configuration prepared; dashboard activation and first scans are pending.
App installation and provider authorization must be verified separately for each
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
