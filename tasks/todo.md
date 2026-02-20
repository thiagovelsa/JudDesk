# Security & Reliability Hardening (2026-02-20)

## Plan
- [x] Add path-scope validation for stored document and attachment file deletions.
- [x] Sanitize imported `file_path` values from backup restore.
- [x] Move API secrets out of plaintext settings storage into OS keychain commands.
- [x] Exclude sensitive settings from DB export/import flows.
- [x] Encrypt backup payloads and require password at backup/restore actions.
- [x] Restrict backup path validation to AppData scope.
- [x] Remove daily spend limit UI/config to avoid false expectation.
- [x] Make settings save atomic through batch transaction.
- [x] Persist GPT-5 and Gemini usage into `ai_usage_logs`.
- [x] Rebuild documents FTS index after full database import.
- [x] Switch Gemini connection test from query-string API key to header.
- [x] Reorder assistant session deletion flow to avoid irreversible partial delete.
- [x] Tighten Tauri hardening: remove `devtools` feature in dependency + narrow FS capability scope.

## Review
- Typecheck: `npx tsc -p tsconfig.json --noEmit` passed.
- Tests: `npm run test:run` passed (733/733).
- Rust check: `cargo check` in `src-tauri` passed.

## Notes
- Backup encryption runs in production paths. Test environment uses deterministic plaintext fallback only for suite stability.
- Legacy plaintext backups remain restorable for compatibility.
