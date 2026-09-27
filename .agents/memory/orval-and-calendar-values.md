---
name: OpenAPI generation and calendar values
description: Non-obvious workspace constraints for generated Zod/React Query clients and PostgreSQL calendar dates.
---

Generated Orval schemas can collide when one operation combines a path parameter with query parameter components; avoid the collision by removing unnecessary query parameters or choosing an operation shape that does not emit duplicate params types. The generated client also expects DOM iterable typings for `Headers.entries()`.

**Why:** The workspace runs a chained TypeScript build after code generation, so successful codegen alone is not enough; generated type collisions or missing DOM libs block every package.

**How to apply:** After changing `lib/api-spec/openapi.yaml`, run codegen and the library typecheck before adding route imports. For Drizzle `date(..., { mode: "string" })` columns, convert generated Zod `Date` values back to `YYYY-MM-DD` before insert/update.