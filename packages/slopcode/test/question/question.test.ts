import { test, expect } from "bun:test"
import { Question } from "../../src/question"
import { Instance } from "../../src/project/instance"
import { tmpdir } from "../fixture/fixture"

test("ask - returns pending promise", async () => {
  await using tmp = await tmpdir({ git: true })
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      const promise = Question.ask({
        sessionID: "ses_test",
        questions: [
          {
            question: "What would you like to do?",
            header: "Action",
            options: [
              { label: "Option 1", description: "First option" },
              { label: "Option 2", description: "Second option" },
            ],
          },
        ],
      })
      expect(promise).toBeInstanceOf(Promise)
    },
  })
})

test("ask - adds to pending list", async () => {
  await using tmp = await tmpdir({ git: true })
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      const questions = [
        {
          question: "What would you like to do?",
          header: "Action",
          options: [
            { label: "Option 1", description: "First option" },
            { label: "Option 2", description: "Second option" },
          ],
        },
      ]

      Question.ask({
        sessionID: "ses_test",
        questions,
      })

      const pending = await Question.list()
      expect(pending.length).toBe(1)
      expect(pending[0].questions).toEqual(questions)
    },
  })
})

// reply tests

test("reply - resolves the pending ask with answers", async () => {
  await using tmp = await tmpdir({ git: true })
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      const questions = [
        {
          question: "What would you like to do?",
          header: "Action",
          options: [
            { label: "Option 1", description: "First option" },
            { label: "Option 2", description: "Second option" },
          ],
        },
      ]

      const askPromise = Question.ask({
        sessionID: "ses_test",
        questions,
      })

      const pending = await Question.list()
      const requestID = pending[0].id

      await Question.reply({
        requestID,
        answers: [["Option 1"]],
      })

      const answers = await askPromise
      expect(answers).toEqual([["Option 1"]])
    },
  })
})

test("reply - removes from pending list", async () => {
  await using tmp = await tmpdir({ git: true })
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      Question.ask({
        sessionID: "ses_test",
        questions: [
          {
            question: "What would you like to do?",
            header: "Action",
            options: [
              { label: "Option 1", description: "First option" },
              { label: "Option 2", description: "Second option" },
            ],
          },
        ],
      })

      const pending = await Question.list()
      expect(pending.length).toBe(1)

      await Question.reply({
        requestID: pending[0].id,
        answers: [["Option 1"]],
      })

      const pendingAfter = await Question.list()
      expect(pendingAfter.length).toBe(0)
    },
  })
})

test("reply - does nothing for unknown requestID", async () => {
  await using tmp = await tmpdir({ git: true })
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      await Question.reply({
        requestID: "que_unknown",
        answers: [["Option 1"]],
      })
      // Should not throw
    },
  })
})

// reject tests

test("reject - throws RejectedError", async () => {
  await using tmp = await tmpdir({ git: true })
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      const askPromise = Question.ask({
        sessionID: "ses_test",
        questions: [
          {
            question: "What would you like to do?",
            header: "Action",
            options: [
              { label: "Option 1", description: "First option" },
              { label: "Option 2", description: "Second option" },
            ],
          },
        ],
      })

      const pending = await Question.list()
      await Question.reject(pending[0].id)

      await expect(askPromise).rejects.toBeInstanceOf(Question.RejectedError)
    },
  })
})

test("reject - removes from pending list", async () => {
  await using tmp = await tmpdir({ git: true })
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      const askPromise = Question.ask({
        sessionID: "ses_test",
        questions: [
          {
            question: "What would you like to do?",
            header: "Action",
            options: [
              { label: "Option 1", description: "First option" },
              { label: "Option 2", description: "Second option" },
            ],
          },
        ],
      })

      const pending = await Question.list()
      expect(pending.length).toBe(1)

      await Question.reject(pending[0].id)
      askPromise.catch(() => {}) // Ignore rejection

      const pendingAfter = await Question.list()
      expect(pendingAfter.length).toBe(0)
    },
  })
})

test("reject - does nothing for unknown requestID", async () => {
  await using tmp = await tmpdir({ git: true })
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      await Question.reject("que_unknown")
      // Should not throw
    },
  })
})

// multiple questions tests

test("ask - handles multiple questions", async () => {
  await using tmp = await tmpdir({ git: true })
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      const questions = [
        {
          question: "What would you like to do?",
          header: "Action",
          options: [
            { label: "Build", description: "Build the project" },
            { label: "Test", description: "Run tests" },
          ],
        },
        {
          question: "Which environment?",
          header: "Env",
          options: [
            { label: "Dev", description: "Development" },
            { label: "Prod", description: "Production" },
          ],
        },
      ]

      const askPromise = Question.ask({
        sessionID: "ses_test",
        questions,
      })

      const pending = await Question.list()

      await Question.reply({
        requestID: pending[0].id,
        answers: [["Build"], ["Dev"]],
      })

      const answers = await askPromise
      expect(answers).toEqual([["Build"], ["Dev"]])
    },
  })
})

// list tests

test("list - returns all pending requests", async () => {
  await using tmp = await tmpdir({ git: true })
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      Question.ask({
        sessionID: "ses_test1",
        questions: [
          {
            question: "Question 1?",
            header: "Q1",
            options: [{ label: "A", description: "A" }],
          },
        ],
      })

      Question.ask({
        sessionID: "ses_test2",
        questions: [
          {
            question: "Question 2?",
            header: "Q2",
            options: [{ label: "B", description: "B" }],
          },
        ],
      })

      const pending = await Question.list()
      expect(pending.length).toBe(2)
    },
  })
})

test("list - returns empty when no pending", async () => {
  await using tmp = await tmpdir({ git: true })
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      const pending = await Question.list()
      expect(pending.length).toBe(0)
    },
  })
})

test("list - shares pending questions across view ids", async () => {
  await using tmp = await tmpdir({ git: true })
  let a!: Promise<string[][]>
  let b!: Promise<string[][]>

  await Instance.provide({
    directory: tmp.path,
    viewID: "view-a",
    fn: async () => {
      a = Question.ask({
        sessionID: "ses_a",
        questions: [
          {
            question: "Question A?",
            header: "A",
            options: [{ label: "A", description: "A" }],
          },
        ],
      })
      expect((await Question.list()).map((item) => item.sessionID)).toEqual(["ses_a"])
    },
  })

  await Instance.provide({
    directory: tmp.path,
    viewID: "view-b",
    fn: async () => {
      b = Question.ask({
        sessionID: "ses_b",
        questions: [
          {
            question: "Question B?",
            header: "B",
            options: [{ label: "B", description: "B" }],
          },
        ],
      })
      expect((await Question.list()).map((item) => item.sessionID)).toEqual(["ses_a", "ses_b"])
    },
  })

  await Instance.provide({
    directory: tmp.path,
    viewID: "view-a",
    fn: async () => {
      expect((await Question.list()).map((item) => item.sessionID)).toEqual(["ses_a", "ses_b"])
      const pending = await Question.list({ sessionID: "ses_a" })
      await Question.reply({ requestID: pending[0].id, sessionID: "ses_a", answers: [["A"]] })
    },
  })

  await Instance.provide({
    directory: tmp.path,
    viewID: "view-b",
    fn: async () => {
      const pending = await Question.list({ sessionID: "ses_b" })
      await Question.reply({ requestID: pending[0].id, sessionID: "ses_b", answers: [["B"]] })
    },
  })

  await expect(a).resolves.toEqual([["A"]])
  await expect(b).resolves.toEqual([["B"]])
})

test("reply and reject ignore mismatched session ids", async () => {
  await using tmp = await tmpdir({ git: true })
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      const askPromise = Question.ask({
        sessionID: "ses_a",
        questions: [
          {
            question: "Question A?",
            header: "A",
            options: [{ label: "A", description: "A" }],
          },
        ],
      })

      const [pending] = await Question.list()
      expect(await Question.reply({ requestID: pending.id, sessionID: "ses_b", answers: [["B"]] })).toBe(false)
      expect(await Question.reject(pending.id, "ses_b")).toBe(false)
      expect((await Question.list({ sessionID: "ses_a" })).length).toBe(1)

      await Question.reply({ requestID: pending.id, sessionID: "ses_a", answers: [["A"]] })
      await expect(askPromise).resolves.toEqual([["A"]])
    },
  })
})
