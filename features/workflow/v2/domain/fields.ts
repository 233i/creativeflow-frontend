export type FieldType =
  "string" | "number" | "boolean" | "object" | "array" | "image" | "contextChunks" | "answer";
export interface WorkflowField {
  key: string;
  label?: string;
  type: FieldType;
  required: boolean;
  default?: unknown;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  description?: string;
  nullable?: boolean;
  integer?: boolean;
  properties?: WorkflowField[];
  items?: WorkflowField;
  enum?: (string | number | boolean | null)[];
  minItems?: number;
  maxItems?: number;
}

export const FIELD_TYPES: FieldType[] = ["string", "number", "boolean", "object", "array", "image"];
