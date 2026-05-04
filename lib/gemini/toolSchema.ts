import { zodToJsonSchema } from "./zodToJsonSchema";
import { toolRegistry, toolSchemas, type ToolName } from "@/lib/tools";

export interface GeminiFunctionDeclaration {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export function buildGeminiFunctionDeclarations(
  mode: "website" | "pdf" = "website",
): GeminiFunctionDeclaration[] {
  return (Object.keys(toolSchemas) as ToolName[])
    .filter((name) => toolRegistry[name].modes.includes(mode))
    .map((name) => {
      const zodSchema = toolSchemas[name];
      const jsonSchema = zodToJsonSchema(zodSchema);
      return {
        name,
        description: toolRegistry[name].description,
        parameters: jsonSchema,
      };
    });
}
