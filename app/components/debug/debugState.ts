export const debugState = {
  isAuthenticated: null as boolean | null,
  currentRoute: null as string | null,
};

export function initDebugState() {
  Object.assign(debugState, {
    isAuthenticated: false,
    currentRoute: "unknown",
  });
}

export function clearDebugState() {
  Object.assign(debugState, {
    isAuthenticated: null,
    currentRoute: null,
  });
}
