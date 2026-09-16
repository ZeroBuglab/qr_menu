const transitions = {
    NEW: ["COOKING", "CANCELLED"],
    COOKING: ["READY", "CANCELLED"],
    READY: ["DELIVERING", "CANCELLED"],
    DELIVERING: ["COMPLETED", "CANCELLED"],
    COMPLETED: [],
    CANCELLED: [],
};
export function canTransition(from, to) {
    return from === to || transitions[from].includes(to);
}
