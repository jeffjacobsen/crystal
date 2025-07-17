import { getTracer, getMeter } from './index';
import { SpanKind, SpanStatusCode } from '@opentelemetry/api';
import { TelemetryData } from '../types/telemetry';

const tracer = getTracer('claude-instrumentation');
const meter = getMeter('claude-instrumentation');

// Create metrics
const tokenCounter = meter.createCounter('claude.tokens.total', {
  description: 'Total tokens used by Claude',
});

const apiCallCounter = meter.createCounter('claude.api_calls.total', {
  description: 'Total API calls made by Claude',
});

const activeTimeHistogram = meter.createHistogram('claude.active_time.duration', {
  description: 'Duration of active Claude operations',
  unit: 'ms',
});

const toolUsageCounter = meter.createCounter('claude.tool_usage.total', {
  description: 'Tools used by Claude',
});

export class ClaudeTelemetryCollector {
  private currentSpans: Map<string, any> = new Map();
  public metrics: TelemetryData['metrics'] = {
    sessionCount: 0,
    linesOfCodeModified: 0,
    apiCost: 0,
    tokenUsage: {
      input: 0,
      output: 0,
      total: 0,
    },
    activeTimeMs: 0,
    toolDecisions: {},
  };
  private startTime: number = Date.now();

  startOperation(operationName: string, attributes?: Record<string, any>) {
    const span = tracer.startSpan(operationName, {
      kind: SpanKind.INTERNAL,
      attributes,
    });
    
    this.currentSpans.set(operationName, {
      span,
      startTime: Date.now(),
    });
    
    return span;
  }

  endOperation(operationName: string, status?: { code: SpanStatusCode; message?: string }) {
    const spanData = this.currentSpans.get(operationName);
    if (spanData) {
      const { span, startTime } = spanData;
      
      if (status) {
        span.setStatus(status);
      }
      
      span.end();
      
      // Record duration
      const duration = Date.now() - startTime;
      activeTimeHistogram.record(duration, { operation: operationName });
      this.metrics.activeTimeMs += duration;
      
      this.currentSpans.delete(operationName);
    }
  }

  recordTokenUsage(input: number, output: number) {
    tokenCounter.add(input, { type: 'input' });
    tokenCounter.add(output, { type: 'output' });
    
    this.metrics.tokenUsage.input += input;
    this.metrics.tokenUsage.output += output;
    this.metrics.tokenUsage.total += (input + output);
  }

  recordApiCall(endpoint: string, cost?: number) {
    apiCallCounter.add(1, { endpoint });
    
    if (cost) {
      this.metrics.apiCost += cost;
    }
  }

  recordToolUsage(toolName: string) {
    toolUsageCounter.add(1, { tool: toolName });
    
    if (!this.metrics.toolDecisions[toolName]) {
      this.metrics.toolDecisions[toolName] = 0;
    }
    this.metrics.toolDecisions[toolName]++;
  }

  recordLinesModified(lines: number) {
    this.metrics.linesOfCodeModified += lines;
  }

  incrementSessionCount() {
    this.metrics.sessionCount++;
  }

  getActiveSpans(): TelemetryData['traces']['spans'] {
    const spans: TelemetryData['traces']['spans'] = [];
    
    for (const [name, spanData] of this.currentSpans) {
      spans.push({
        name,
        startTime: new Date(spanData.startTime).toISOString(),
        attributes: {},
      });
    }
    
    return spans;
  }

  getTelemetryData(): TelemetryData {
    // Calculate current active time including ongoing operations
    let currentActiveTime = this.metrics.activeTimeMs;
    
    // Add time from currently active operations
    for (const [_, spanData] of this.currentSpans) {
      const elapsed = Date.now() - spanData.startTime;
      currentActiveTime += elapsed;
    }
    
    return {
      metrics: { 
        ...this.metrics,
        activeTimeMs: currentActiveTime
      },
      traces: {
        spans: this.getActiveSpans(),
      },
      lastUpdate: new Date().toISOString(),
    };
  }

  // Parse telemetry from Claude messages
  parseClaudeMessage(message: any): Partial<TelemetryData['metrics']> | null {
    const updates: Partial<TelemetryData['metrics']> = {};
    
    // Parse different message types for telemetry data
    
    // Handle usage updates from assistant messages
    if (message.type === 'assistant' && message.message?.usage) {
      const usage = message.message.usage;
      if (usage.input_tokens !== undefined && usage.output_tokens !== undefined) {
        this.recordTokenUsage(usage.input_tokens, usage.output_tokens);
      }
    }
    
    // Handle tool use messages
    if (message.type === 'tool_use') {
      const toolName = message.name || message.tool_name || 'unknown';
      this.recordToolUsage(toolName);
    }
    
    // Handle explicit usage messages
    if (message.type === 'usage' && message.data) {
      if (message.data.input_tokens) {
        this.recordTokenUsage(message.data.input_tokens, message.data.output_tokens || 0);
      }
    }
    
    // Handle metrics messages (from OTEL)
    if (message.type === 'metrics' && message.data) {
      // Direct metrics from Claude telemetry
      if (message.data.tokens) {
        this.recordTokenUsage(
          message.data.tokens.input || 0,
          message.data.tokens.output || 0
        );
      }
      
      if (message.data.api_calls) {
        for (const call of message.data.api_calls) {
          this.recordApiCall(call.endpoint, call.cost);
        }
      }
      
      if (message.data.code_changes) {
        this.recordLinesModified(message.data.code_changes.lines_modified || 0);
      }
    }
    
    // Handle status messages that might contain metrics
    if (message.type === 'status' && message.data?.metrics) {
      const metrics = message.data.metrics;
      if (metrics.tokens) {
        this.recordTokenUsage(metrics.tokens.input || 0, metrics.tokens.output || 0);
      }
    }
    
    return Object.keys(updates).length > 0 ? updates : null;
  }

  reset() {
    // End all active spans
    for (const [operationName] of this.currentSpans) {
      this.endOperation(operationName, {
        code: SpanStatusCode.ERROR,
        message: 'Operation cancelled',
      });
    }
    
    // Reset metrics
    this.metrics = {
      sessionCount: 0,
      linesOfCodeModified: 0,
      apiCost: 0,
      tokenUsage: {
        input: 0,
        output: 0,
        total: 0,
      },
      activeTimeMs: 0,
      toolDecisions: {},
    };
    
    this.startTime = Date.now();
  }
}