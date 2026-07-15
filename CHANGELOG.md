# 0.1.1

- Internal: split integration tests by language and add a unit test suite.
- Internal: remove stale test artifact and clean `out` before compile/publish to avoid duplicate test runs.
- Internal: downgrade AST parse error log to debug level to reduce noise.

# 0.1.0

- Support checking and converting Documentation Comment.
- Support checking and converting HTML tags in HTML files.
- Support checking and converting CSS tags in CSS files.
- Support checking and converting JSON values in JSON files.

# 0.0.4

- Improve parser initialization stability for Dart / PHP / Python (tree-sitter runtime prewarm + error recovery).

# 0.0.3

- Support checking and converting tag attribute values in JSX/TSX files.

# 0.0.2

- Fixed bugs.

# 0.0.1

- Added basic features of plugins: diagnoses, quick fix, and setting.
