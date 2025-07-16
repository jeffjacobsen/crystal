export interface TelemetryData {
  metrics: {
    sessionCount: number;
    linesOfCodeModified: number;
    apiCost: number;
    tokenUsage: {
      input: number;
      output: number;
      total: number;
    };
    activeTimeMs: number;
    toolDecisions: Record<string, number>;
  };
  traces: {
    spans: Array<{
      name: string;
      startTime: string;
      endTime?: string;
      duration?: number;
      attributes: Record<string, any>;
    }>;
  };
  lastUpdate: string;
}

export interface PRPGenerationProgressWithTelemetry {
  stage: 'starting' | 'processing' | 'finalizing' | 'complete' | 'error';
  message: string;
  progress: number;
  telemetry?: TelemetryData;
  metadata?: any;
}

export interface TelemetryConfig {
  enableTelemetry?: boolean;
  telemetryEndpoint?: string;
  telemetryExporter?: 'console' | 'otlp';
}