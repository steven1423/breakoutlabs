import type { KitState } from "../state-machine/transitions.ts";

/** The exits a staff member may trigger by hand from the timeline page (exception states only). */
export const STAFF_FIXES: Partial<Record<KitState, { to: KitState; label: string; note: string }>> = {
  results_locked: { to: "resulted", label: "Mark relinked", note: "Kit relinked to the customer's account by staff" },
  registration_mismatch: { to: "registered", label: "Mark identity fixed", note: "Registration details corrected by staff" },
  backordered: { to: "shipped", label: "Mark shipped", note: "Kit shipped after backorder" },
};
