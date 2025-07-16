export interface AppConfig {
  verbose?: boolean;
  anthropicApiKey?: string;
  // Legacy fields for backward compatibility
  gitRepoPath?: string;
  systemPromptAppend?: string;
  runScript?: string[];
  // Custom claude executable path (for when it's not in PATH)
  claudeExecutablePath?: string;
  // Permission mode for all sessions
  defaultPermissionMode?: 'approve' | 'ignore';
  // Theme preference
  theme?: 'light' | 'dark';
  // PRP Template settings
  customTemplatePaths?: string[];  // Array of paths to scan for templates
  defaultTemplateId?: string;       // Default template to pre-select
  defaultPRPPromptTemplate?: string; // Default prompt template when PRP is selected
  templateSettings?: {
    enableCustomTemplates: boolean;
    scanSubdirectories: boolean;
    cacheTemplates: boolean;
  };
  // OpenTelemetry settings
  enableTelemetry?: boolean;
  telemetryEndpoint?: string;
  telemetryExporter?: 'console' | 'otlp';
}

export interface UpdateConfigRequest {
  verbose?: boolean;
  anthropicApiKey?: string;
  claudeExecutablePath?: string;
  systemPromptAppend?: string;
  defaultPermissionMode?: 'approve' | 'ignore';
  theme?: 'light' | 'dark';
  customTemplatePaths?: string[];
  defaultTemplateId?: string;
  defaultPRPPromptTemplate?: string;
  templateSettings?: {
    enableCustomTemplates: boolean;
    scanSubdirectories: boolean;
    cacheTemplates: boolean;
  };
  // OpenTelemetry settings
  enableTelemetry?: boolean;
  telemetryEndpoint?: string;
  telemetryExporter?: 'console' | 'otlp';
}