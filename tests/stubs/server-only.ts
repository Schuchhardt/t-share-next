// `server-only` throws when it is resolved outside a server bundle. Under
// Vitest there is no bundle at all, so it resolves to nothing.
export {};
