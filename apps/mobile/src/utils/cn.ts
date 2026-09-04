export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function classNames(...parts: Array<string | false | null | undefined>) {
  return cn(...parts);
}
