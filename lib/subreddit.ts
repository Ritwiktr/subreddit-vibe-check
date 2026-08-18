export function normalizeSubreddit(input: string): string {
  return input.trim().replace(/^r\//i, "").trim().replace(/\s+/g, "");
}

export function isValidSubreddit(name: string): boolean {
  return /^[A-Za-z0-9_]+$/.test(name);
}
