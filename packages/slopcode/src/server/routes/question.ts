import { Hono } from "hono"
import { describeRoute, validator } from "hono-openapi"
import { resolver } from "hono-openapi"
import { Question } from "../../question"
import z from "zod"
import { errors } from "../error"
import { lazy } from "../../util/lazy"
import { NotFoundError } from "../../storage/db"

export const QuestionRoutes = lazy(() =>
  new Hono()
    .get(
      "/",
      describeRoute({
        summary: "List pending questions",
        description: "Get all pending question requests across all sessions.",
        operationId: "question.list",
        responses: {
          200: {
            description: "List of pending questions",
            content: {
              "application/json": {
                schema: resolver(Question.Request.array()),
              },
            },
          },
        },
      }),
      validator(
        "query",
        z.object({
          sessionID: z.string().optional(),
        }),
      ),
      async (c) => {
        const questions = await Question.list(c.req.valid("query"))
        return c.json(questions)
      },
    )
    .post(
      "/:requestID/reply",
      describeRoute({
        summary: "Reply to question request",
        description: "Provide answers to a question request from the AI assistant.",
        operationId: "question.reply",
        responses: {
          200: {
            description: "Question answered successfully",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          requestID: z.string(),
        }),
      ),
      validator(
        "query",
        z.object({
          sessionID: z.string().optional(),
        }),
      ),
      validator("json", Question.Reply),
      async (c) => {
        const params = c.req.valid("param")
        const json = c.req.valid("json")
        const ok = await Question.reply({
          requestID: params.requestID,
          answers: json.answers,
          sessionID: c.req.valid("query").sessionID,
        })
        if (!ok) throw new NotFoundError({ message: "Question request not found" })
        return c.json(true)
      },
    )
    .post(
      "/:requestID/reject",
      describeRoute({
        summary: "Reject question request",
        description: "Reject a question request from the AI assistant.",
        operationId: "question.reject",
        responses: {
          200: {
            description: "Question rejected successfully",
            content: {
              "application/json": {
                schema: resolver(z.boolean()),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "param",
        z.object({
          requestID: z.string(),
        }),
      ),
      validator(
        "query",
        z.object({
          sessionID: z.string().optional(),
        }),
      ),
      async (c) => {
        const params = c.req.valid("param")
        const ok = await Question.reject(params.requestID, c.req.valid("query").sessionID)
        if (!ok) throw new NotFoundError({ message: "Question request not found" })
        return c.json(true)
      },
    ),
)
