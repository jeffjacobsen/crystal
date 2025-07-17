import { NodeSDK } from '@opentelemetry/sdk-node';
// Auto-instrumentations are optional and not critical for telemetry
// import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { ConsoleSpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { ConsoleMetricExporter, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { trace, metrics, SpanStatusCode } from '@opentelemetry/api';

let telemetrySDK: NodeSDK | null = null;

export interface TelemetryConfig {
  enable?: boolean;
  exporter?: 'console' | 'otlp';
  endpoint?: string;
  serviceName?: string;
}

export function initializeTelemetry(config: TelemetryConfig = {}) {
  if (!config.enable || telemetrySDK) {
    return;
  }

  const {
    exporter = 'console',
    endpoint = 'http://localhost:4317',
    serviceName = 'crystal-prp-generation'
  } = config;

  // Create resource
  const resource = Resource.default().merge(
    new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
      [SemanticResourceAttributes.SERVICE_VERSION]: process.env.npm_package_version || '0.1.0',
    })
  );

  // Configure exporters based on type
  let traceExporter;
  let metricExporter;

  if (exporter === 'console') {
    traceExporter = new ConsoleSpanExporter();
    metricExporter = new ConsoleMetricExporter();
  } else {
    traceExporter = new OTLPTraceExporter({
      url: `${endpoint}/v1/traces`,
    });
    metricExporter = new OTLPMetricExporter({
      url: `${endpoint}/v1/metrics`,
    });
  }

  // Create SDK
  telemetrySDK = new NodeSDK({
    resource,
    spanProcessor: new SimpleSpanProcessor(traceExporter),
    metricReader: new PeriodicExportingMetricReader({
      exporter: metricExporter,
      exportIntervalMillis: 5000, // Export every 5 seconds for real-time updates
    }),
    // Instrumentations can be added later if needed
    instrumentations: [],
  });

  // Initialize the SDK
  telemetrySDK.start();

  console.log(`OpenTelemetry initialized with ${exporter} exporter`);
}

export function shutdownTelemetry() {
  if (telemetrySDK) {
    telemetrySDK.shutdown()
      .then(() => console.log('OpenTelemetry shut down successfully'))
      .catch((error) => console.error('Error shutting down OpenTelemetry', error));
    telemetrySDK = null;
  }
}

export function getTracer(name: string) {
  return trace.getTracer(name);
}

export function getMeter(name: string) {
  return metrics.getMeter(name);
}

// Helper function to create environment variables for Claude
export function getClaudeTelemetryEnv(config: TelemetryConfig = {}) {
  const env: Record<string, string> = {};

  if (config.enable) {
    env.CLAUDE_CODE_ENABLE_TELEMETRY = '1';
    
    // Set exporter - console outputs to stderr
    env.OTEL_METRICS_EXPORTER = config.exporter || 'console';
    env.OTEL_TRACES_EXPORTER = config.exporter || 'console';
    env.OTEL_LOGS_EXPORTER = config.exporter || 'console';
    env.OTEL_SERVICE_NAME = 'crystal-prp-generation';
    
    if (config.exporter === 'otlp') {
      // Use provided endpoint or default to localhost
      env.OTEL_EXPORTER_OTLP_ENDPOINT = config.endpoint || 'http://localhost:4318';
      env.OTEL_EXPORTER_OTLP_PROTOCOL = 'http/json';
    }
    
    // Set shorter export intervals for better real-time monitoring
    env.OTEL_METRIC_EXPORT_INTERVAL = '2000'; // 2 seconds for more frequent updates
    env.OTEL_BSP_SCHEDULE_DELAY = '1000'; // 1 second for trace batching
    
    // Additional settings from Claude docs
    env.OTEL_EXPORTER_OTLP_COMPRESSION = 'gzip';
    env.OTEL_RESOURCE_ATTRIBUTES = 'service.name=crystal-prp-generation';
  }

  return env;
}

// Telemetry data parser for Claude output
export function parseClaudeTelemetryMessage(message: any): any {
  // Claude telemetry messages have a specific format
  // This function will parse them and extract relevant metrics
  if (message.type === 'telemetry' || message.type === 'metrics') {
    return {
      timestamp: new Date().toISOString(),
      ...message.data
    };
  }
  
  // Try to extract telemetry from other message types
  if (message.type === 'status' && message.data?.metrics) {
    return {
      timestamp: new Date().toISOString(),
      metrics: message.data.metrics
    };
  }

  return null;
}

export { SpanStatusCode };