import { describe, expect, test } from "bun:test"
import { MySqlDialect } from "drizzle-orm/mysql-core"
import { Key } from "../src/key"

describe("Key.active", () => {
  const query = new MySqlDialect().sqlToQuery(Key.active()!)

  test("rejects soft-deleted keys", () => {
    expect(query.sql).toContain("`key`.`time_deleted` is null")
  })

  test("rejects keys owned by soft-deleted users", () => {
    expect(query.sql).toContain("`user`.`time_deleted` is null")
  })

  test("rejects keys for soft-deleted workspaces", () => {
    expect(query.sql).toContain("`workspace`.`time_deleted` is null")
  })
})
