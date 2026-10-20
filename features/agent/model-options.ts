export interface ModelOption {
  value: string;
  providerId: string;
  modelKey: string;
  providerName: string;
  providerBuiltinId: string | null | undefined;
  modelName: string;
  modelIcon: string | null | undefined;
  protocol: string;
  supportsVision: boolean;
  supportsThinking: boolean;
  supportsFunctionCall: boolean;
  contextLength: number | null | undefined;
}
