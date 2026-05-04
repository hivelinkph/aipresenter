import { z, ZodTypeAny } from "zod";

export function zodToJsonSchema(schema: ZodTypeAny): Record<string, unknown> {
  const def = (schema as any)._def;
  const typeName = def?.typeName as string | undefined;

  switch (typeName) {
    case "ZodString": {
      // Gemini's schema dialect doesn't recognize JSON Schema's `format: uri`
      // and rejects the whole setup if it sees unknown keys. Plain string only.
      return { type: "string" };
    }
    case "ZodNumber":
      return { type: "number" };
    case "ZodBoolean":
      return { type: "boolean" };
    case "ZodOptional":
    case "ZodDefault":
      return zodToJsonSchema(def.innerType);
    case "ZodArray":
      return { type: "array", items: zodToJsonSchema(def.type) };
    case "ZodRecord":
      // Gemini's schema dialect rejects `additionalProperties`, so emit a bare
      // object type. The runtime still validates with the full zod schema.
      return { type: "object" };
    case "ZodObject": {
      const shape = def.shape() as Record<string, ZodTypeAny>;
      const properties: Record<string, unknown> = {};
      const required: string[] = [];
      for (const [key, child] of Object.entries(shape)) {
        properties[key] = zodToJsonSchema(child);
        const childDef = (child as any)._def;
        const isOptional =
          childDef.typeName === "ZodOptional" || childDef.typeName === "ZodDefault";
        if (!isOptional) required.push(key);
      }
      const out: Record<string, unknown> = { type: "object", properties };
      if (required.length > 0) out.required = required;
      return out;
    }
    default:
      return {};
  }
}
