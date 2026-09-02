const assert = require("node:assert/strict");
const test = require("node:test");

const {
  ADMIN_ROLES,
  canAssignRole,
  ROLE_LABELS,
  STAFF_ROLES,
} = require("../lib/shared/roles.js");

test("every role code has a till label and vice versa", () => {
  assert.equal(STAFF_ROLES.size, Object.keys(ROLE_LABELS).length);
  for (const role of STAFF_ROLES) {
    assert.equal(typeof ROLE_LABELS[role], "string", `${role} has no label`);
  }
});

test("only owners and store managers administer staff", () => {
  assert.deepEqual([...ADMIN_ROLES].sort(), ["owner", "store_manager"]);
});

test("a store manager cannot mint an owner", () => {
  // Otherwise a manager creates an owner account, signs into it, and has
  // escalated straight out of their own role.
  assert.equal(canAssignRole("store_manager", "owner"), false);
  assert.equal(canAssignRole("owner", "owner"), true);
});

test("a store manager can create every non-owner role", () => {
  for (const role of STAFF_ROLES) {
    if (role === "owner") continue;
    assert.equal(canAssignRole("store_manager", role), true, `store_manager should assign ${role}`);
  }
});

test("non-administrators can assign nothing at all", () => {
  for (const actor of ["cashier", "bar_staff", "supervisor", "store_keeper", "", "admin"]) {
    for (const target of ["cashier", "owner"]) {
      assert.equal(canAssignRole(actor, target), false, `${actor} must not assign ${target}`);
    }
  }
});

test("an unknown target role is never assignable", () => {
  for (const target of ["superuser", "OWNER", "", "root"]) {
    assert.equal(canAssignRole("owner", target), false, `${target} must not be assignable`);
  }
});
