import { describe, expect, spyOn, test } from "bun:test"
import { Actor } from "../src/actor"
import { and, eq, sql } from "../src/drizzle"
import { Key } from "../src/key"
import { AuthTable } from "../src/schema/auth.sql"
import { KeyTable } from "../src/schema/key.sql"
import { UserTable } from "../src/schema/user.sql"
import { WorkspaceTable } from "../src/schema/workspace.sql"
import { User } from "../src/user"
import { Workspace } from "../src/workspace"
import { testDatabase, useTestDatabase } from "./database"
import "./billingReservation.cases"

const workspaceID = "workspace_security"
const adminID = "user_admin"
const userID = "user_member"
const accountID = "account_member"
const secrets = ["sk-revoked-one", "sk-revoked-two"]
const admin = {
  userID: adminID,
  workspaceID,
  accountID: "account_admin",
  role: "admin" as const,
}

async function seed() {
  const db = testDatabase()
  await db.insert(WorkspaceTable).values({ id: workspaceID, name: "Security" })
  await db.insert(UserTable).values([
    { id: adminID, workspaceID, accountID: admin.accountID, name: "Admin", role: "admin" },
    { id: userID, workspaceID, accountID, name: "Member", role: "member" },
  ])
  await db.insert(AuthTable).values([
    { id: "auth_admin", accountID: admin.accountID, provider: "email", subject: "admin@example.com" },
    { id: "auth_member", accountID, provider: "email", subject: "member@example.com" },
  ])
  await db.insert(KeyTable).values([
    { id: "key_admin", workspaceID, userID: adminID, name: "Admin", key: "sk-admin" },
    { id: "key_member_one", workspaceID, userID, name: "Member 1", key: secrets[0] },
    { id: "key_member_two", workspaceID, userID, name: "Member 2", key: secrets[1] },
  ])
}

function active(secret: string) {
  return testDatabase()
    .select({ id: KeyTable.id })
    .from(KeyTable)
    .innerJoin(UserTable, and(eq(UserTable.workspaceID, KeyTable.workspaceID), eq(UserTable.id, KeyTable.userID)))
    .innerJoin(WorkspaceTable, eq(WorkspaceTable.id, KeyTable.workspaceID))
    .where(and(eq(KeyTable.key, secret), Key.activePrincipal()))
    .then((rows) => rows[0])
}

function failKeyUpdates() {
  return testDatabase().execute(
    sql.raw(`
    CREATE TRIGGER fail_key_update BEFORE UPDATE ON \`key\`
    FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'forced key update failure'
  `),
  )
}

describe("API key lifecycle", () => {
  test("removing a user soft-deletes the user and all associated keys", async () => {
    await seed()

    await useTestDatabase(() => Actor.provide("user", admin, () => User.remove(userID)))

    const user = await testDatabase()
      .select()
      .from(UserTable)
      .where(and(eq(UserTable.workspaceID, workspaceID), eq(UserTable.id, userID)))
      .then((rows) => rows[0])
    const keys = await testDatabase()
      .select()
      .from(KeyTable)
      .where(and(eq(KeyTable.workspaceID, workspaceID), eq(KeyTable.userID, userID)))

    expect(user.timeDeleted).toBeInstanceOf(Date)
    expect(keys).toHaveLength(2)
    expect(keys.every((key) => key.timeDeleted instanceof Date)).toBe(true)
    expect(await active(secrets[0])).toBeUndefined()
    expect(await active("sk-admin")).toEqual({ id: "key_admin" })
  })

  test("rolls back user removal when key revocation fails", async () => {
    await seed()
    await failKeyUpdates()

    await expect(useTestDatabase(() => Actor.provide("user", admin, () => User.remove(userID)))).rejects.toThrow()

    const user = await testDatabase()
      .select()
      .from(UserTable)
      .where(and(eq(UserTable.workspaceID, workspaceID), eq(UserTable.id, userID)))
      .then((rows) => rows[0])
    const keys = await testDatabase()
      .select()
      .from(KeyTable)
      .where(and(eq(KeyTable.workspaceID, workspaceID), eq(KeyTable.userID, userID)))

    expect(user.timeDeleted).toBeNull()
    expect(keys.every((key) => key.timeDeleted === null)).toBe(true)
  })

  test("re-inviting a removed user creates a new active key without reactivating revoked keys", async () => {
    await seed()
    await useTestDatabase(() => Actor.provide("user", admin, () => User.remove(userID)))
    const error = spyOn(console, "error").mockImplementation(() => {})

    try {
      await useTestDatabase(() =>
        Actor.provide("user", admin, () =>
          User.invite({ email: "member@example.com", role: "member", monthlyLimit: null }),
        ),
      )
    } finally {
      error.mockRestore()
    }

    const user = await testDatabase()
      .select()
      .from(UserTable)
      .where(and(eq(UserTable.workspaceID, workspaceID), eq(UserTable.accountID, accountID)))
      .then((rows) => rows[0])
    const keys = await testDatabase()
      .select()
      .from(KeyTable)
      .where(and(eq(KeyTable.workspaceID, workspaceID), eq(KeyTable.userID, userID)))
    const activeKeys = keys.filter((key) => !key.timeDeleted)

    expect(user.id).toBe(userID)
    expect(user.timeDeleted).toBeNull()
    expect(keys.filter((key) => key.timeDeleted)).toHaveLength(2)
    expect(
      keys
        .filter((key) => key.timeDeleted)
        .map((key) => key.key)
        .sort(),
    ).toEqual([...secrets].sort())
    expect(activeKeys).toHaveLength(1)
    expect(activeKeys[0].id).not.toBe("key_member_one")
    expect(activeKeys[0].id).not.toBe("key_member_two")
    expect(secrets).not.toContain(activeKeys[0].key)
    expect(activeKeys[0].key).toMatch(/^sk-[A-Za-z0-9]{64}$/)
    expect(await active(activeKeys[0].key)).toEqual({ id: activeKeys[0].id })
  })

  test("removing a workspace soft-deletes the workspace and all its active keys", async () => {
    await seed()
    await testDatabase().insert(WorkspaceTable).values({ id: "workspace_other", name: "Other" })
    await testDatabase().insert(UserTable).values({
      id: "user_other",
      workspaceID: "workspace_other",
      accountID: "account_other",
      name: "Other",
      role: "admin",
    })
    await testDatabase().insert(KeyTable).values({
      id: "key_other",
      workspaceID: "workspace_other",
      userID: "user_other",
      name: "Other",
      key: "sk-other",
    })

    await useTestDatabase(() => Actor.provide("user", admin, () => Workspace.remove()))

    const workspace = await testDatabase()
      .select()
      .from(WorkspaceTable)
      .where(eq(WorkspaceTable.id, workspaceID))
      .then((rows) => rows[0])
    const keys = await testDatabase().select().from(KeyTable).where(eq(KeyTable.workspaceID, workspaceID))

    expect(workspace.timeDeleted).toBeInstanceOf(Date)
    expect(keys).toHaveLength(3)
    expect(keys.every((key) => key.timeDeleted instanceof Date)).toBe(true)
    expect(await active("sk-admin")).toBeUndefined()
    expect(await active("sk-other")).toEqual({ id: "key_other" })
  })

  test("rolls back workspace removal when key revocation fails", async () => {
    await seed()
    await failKeyUpdates()

    await expect(useTestDatabase(() => Actor.provide("user", admin, () => Workspace.remove()))).rejects.toThrow()

    const workspace = await testDatabase()
      .select()
      .from(WorkspaceTable)
      .where(eq(WorkspaceTable.id, workspaceID))
      .then((rows) => rows[0])
    const keys = await testDatabase().select().from(KeyTable).where(eq(KeyTable.workspaceID, workspaceID))

    expect(workspace.timeDeleted).toBeNull()
    expect(keys.every((key) => key.timeDeleted === null)).toBe(true)
  })

  test("active-principal lookup rejects a deleted user or workspace", async () => {
    await seed()
    expect(await active(secrets[0])).toEqual({ id: "key_member_one" })

    await testDatabase()
      .update(UserTable)
      .set({ timeDeleted: new Date() })
      .where(and(eq(UserTable.workspaceID, workspaceID), eq(UserTable.id, userID)))
    expect(await active(secrets[0])).toBeUndefined()

    await testDatabase()
      .update(UserTable)
      .set({ timeDeleted: null })
      .where(and(eq(UserTable.workspaceID, workspaceID), eq(UserTable.id, userID)))
    await testDatabase()
      .update(WorkspaceTable)
      .set({ timeDeleted: new Date() })
      .where(eq(WorkspaceTable.id, workspaceID))
    expect(await active(secrets[0])).toBeUndefined()
  })

  test("active-principal lookup rejects a revoked key", async () => {
    await seed()
    await testDatabase()
      .update(KeyTable)
      .set({ timeDeleted: new Date() })
      .where(and(eq(KeyTable.workspaceID, workspaceID), eq(KeyTable.id, "key_member_one")))

    expect(await active(secrets[0])).toBeUndefined()
  })
})
