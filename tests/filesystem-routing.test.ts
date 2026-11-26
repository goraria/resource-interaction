import { readFileSync } from "node:fs"
import { expect, it } from "vitest"
import { router } from "@/app/server"

it("preserves the public method/path contract through the Hono router", () => {
  const expected = JSON.parse(
    readFileSync(new URL("./fixtures/route-contract.json", import.meta.url), "utf8"),
  ) as string[]
  const actual = [...new Set(router.routes.map(({ method, path }) => method + " " + path))]
  expect(actual.sort()).toEqual(expected.filter((entry) => !entry.startsWith("HEAD ")).sort())
  for (const entry of expected.filter((route) => route.startsWith("HEAD "))) {
    expect(actual).toContain(entry.replace(/^HEAD /, "GET "))
  }
})

it("serves GET and HEAD health checks without a response body on HEAD", async () => {
  const head = await router.request("/health", { method: "HEAD" })
  expect(head.status).toBe(200)
  expect(await head.text()).toBe("")
  expect((await router.request("/health")).status).toBe(200)
  expect((await router.request("/health/")).status).toBe(404)
})
