import assert from "node:assert/strict";

import {
  completePetActionEvent,
  createFallbackPetActionEvent,
  validatePetActionEvent,
  type PetActionEventInput,
} from "./index.js";

const validInput = {
  pet_id: "pet_demo",
  trigger_type: "manual_check",
  routed_action: "eat",
  confidence: 0.99,
  visual_summary: "Demo pet is near the food bowl and eating.",
  owner_message: "I am eating.",
  alert_level: "normal",
  evidence_frames: [],
} satisfies PetActionEventInput;

const valid = validatePetActionEvent(validInput);
assert.equal(valid.ok, true);
if (valid.ok) {
  assert.equal(valid.event.routed_action, "eat");
  assert.equal(valid.event.schema_version, "1.0");
}

const invalid = validatePetActionEvent({
  ...validInput,
  routed_action: "dance",
});
assert.equal(invalid.ok, false);

const completed = completePetActionEvent(validInput);
assert.ok(completed.event_id);
assert.ok(completed.timestamp);

const fallback = createFallbackPetActionEvent({ pet_id: "pet_demo" });
assert.equal(fallback.routed_action, "idle");
assert.equal(fallback.alert_level, "message");

console.log("protocol tests passed");
