// Vault directory names shared by modules that must not import the writer
// (and so cannot be broken by a test that mocks it).

// Rejected notes are moved here by `vir review`, never deleted. Shared with
// cli/review.ts so the two sides can't drift apart.
export const REJECTED_DIR = ".rejected";
