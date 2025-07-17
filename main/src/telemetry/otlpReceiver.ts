import express, { Express, Request, Response } from 'express';
import { Server } from 'http';
import { Logger } from '../utils/logger';
import { EventEmitter } from 'events';
import * as zlib from 'zlib';

interface OTLPMetric {
  name: string;
  gauge?: {
    dataPoints: Array<{
      asInt?: number;
      asDouble?: number;
      attributes?: Array<{
        key: string;
        value: {
          stringValue?: string;
          intValue?: number;
        };
      }>;
    }>;
  };
  sum?: {
    dataPoints: Array<{
      asInt?: number;
      asDouble?: number;
      attributes?: Array<{
        key: string;
        value: {
          stringValue?: string;
          intValue?: number;
        };
      }>;
    }>;
  };
  histogram?: {
    dataPoints: Array<{
      count?: number;
      sum?: number;
      attributes?: Array<{
        key: string;
        value: {
          stringValue?: string;
          intValue?: number;
        };
      }>;
    }>;
  };
}

interface OTLPResourceMetrics {
  resource?: {
    attributes?: Array<{
      key: string;
      value: {
        stringValue?: string;
        intValue?: number;
      };
    }>;
  };
  scopeMetrics?: Array<{
    scope?: {
      name: string;
      version?: string;
    };
    metrics?: OTLPMetric[];
  }>;
}

interface OTLPMetricsPayload {
  resourceMetrics?: OTLPResourceMetrics[];
}

interface OTLPLogRecord {
  timeUnixNano?: string;
  severityNumber?: number;
  severityText?: string;
  body?: {
    stringValue?: string;
    kvlistValue?: {
      values?: Array<{
        key: string;
        value: {
          stringValue?: string;
          intValue?: string;
          doubleValue?: number;
          boolValue?: boolean;
        };
      }>;
    };
  };
  attributes?: Array<{
    key: string;
    value: {
      stringValue?: string;
      intValue?: string;
      doubleValue?: number;
      boolValue?: boolean;
    };
  }>;
}

interface OTLPLogsPayload {
  resourceLogs?: Array<{
    resource?: {
      attributes?: Array<{
        key: string;
        value: {
          stringValue?: string;
        };
      }>;
    };
    scopeLogs?: Array<{
      scope?: {
        name: string;
        version?: string;
      };
      logRecords?: OTLPLogRecord[];
    }>;
  }>;
}

export interface TelemetryStatus {
  sessions: number;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheCreationTokens?: number;
  totalCost: number;
  linesAdded: number;
  linesRemoved: number;
  activeTimeMs: number;
  toolUsage: Record<string, number>;
  lastUpdate: string | null;
  currentSessionId: string | null;
}

export class OTLPReceiver extends EventEmitter {
  private app: Express;
  private server?: Server;
  private port: number;
  private status: TelemetryStatus;
  private logger: Logger;

  constructor(port: number = 4318, logger: Logger) {
    super();
    this.port = port;
    this.logger = logger;
    this.app = express();
    this.status = {
      sessions: 0,
      totalTokens: 0,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
      totalCost: 0,
      linesAdded: 0,
      linesRemoved: 0,
      activeTimeMs: 0,
      toolUsage: {},
      lastUpdate: null,
      currentSessionId: null,
    };

    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Middleware to handle gzip decompression
    this.app.use((req, res, next) => {
      if (req.headers['content-encoding'] === 'gzip') {
        const chunks: Buffer[] = [];
        req.on('data', (chunk) => chunks.push(chunk));
        req.on('end', () => {
          const buffer = Buffer.concat(chunks);
          zlib.gunzip(buffer, (err, decompressed) => {
            if (err) {
              this.logger.error('Failed to decompress gzip data:', err);
              res.status(400).json({ error: 'Invalid gzip data' });
              return;
            }
            try {
              req.body = JSON.parse(decompressed.toString());
              next();
            } catch (parseErr) {
              this.logger.error('Failed to parse decompressed data:', parseErr as Error);
              res.status(400).json({ error: 'Invalid JSON data' });
            }
          });
        });
      } else {
        next();
      }
    });
    
    this.app.use(express.json({ limit: '10mb' }));

    // OTLP HTTP endpoint for metrics
    this.app.post('/v1/metrics', (req: Request, res: Response) => {
      try {
        // this.logger.info(`Received OTLP metrics request from ${req.ip}`);
        // this.logger.info(`Content-Type: ${req.headers['content-type']}`);
        // this.logger.info(`Body: ${JSON.stringify(req.body).substring(0, 200)}...`);
        // this.processMetrics(req.body);
        res.status(200).json({ status: 'ok' });
      } catch (error) {
        this.logger.error('Error processing OTLP metrics:', error as Error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });

    // OTLP HTTP endpoint for traces
    this.app.post('/v1/traces', (req: Request, res: Response) => {
      try {
        this.logger.info('Received OTLP traces');
        // For now, we're focused on metrics, but traces could be processed here
        res.status(200).json({ status: 'ok' });
      } catch (error) {
        this.logger.error('Error processing OTLP traces:', error as Error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });

    // OTLP HTTP endpoint for logs
    this.app.post('/v1/logs', (req: Request, res: Response) => {
      try {
        // this.logger.info(`Received OTLP logs request from ${req.ip}`);
        // this.logger.info(`Content-Type: ${req.headers['content-type']}`);
        // this.logger.info(`Content-Encoding: ${req.headers['content-encoding']}`);
        
        // Process log data if needed
        this.processLogs(req.body);
        
        res.status(200).json({ status: 'ok' });
      } catch (error) {
        this.logger.error('Error processing OTLP logs:', error as Error);
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
      }
    });

    // Status endpoint for querying current metrics
    this.app.get('/status', (req: Request, res: Response) => {
      res.json(this.status);
    });

    // Health check
    this.app.get('/health', (req: Request, res: Response) => {
      res.json({ status: 'healthy', uptime: process.uptime() });
    });

    // Catch-all for debugging - must be last
    this.app.use((req: Request, res: Response) => {
      this.logger.info(`Unhandled request: ${req.method} ${req.path}`);
      this.logger.info(`Headers: ${JSON.stringify(req.headers)}`);
      res.status(404).json({ error: 'Not found' });
    });
  }

  private processLogs(payload: OTLPLogsPayload): void {
    if (!payload.resourceLogs) {
      this.logger.warn('No resourceLogs in OTLP logs payload');
      return;
    }

    let logCount = 0;
    let telemetryUpdated = false;

    payload.resourceLogs.forEach(rl => {
      // Extract resource attributes if needed
      const resourceAttrs = this.extractAttributes(rl.resource?.attributes || []);
      
      rl.scopeLogs?.forEach(sl => {
        const scopeName = sl.scope?.name || 'unknown';
        // this.logger.info(`Processing logs from scope: ${scopeName}`);
        
        sl.logRecords?.forEach(logRecord => {
          logCount++;
          
          // Extract log severity (currently unused)
          // const severity = logRecord.severityText || `SEVERITY_${logRecord.severityNumber}` || 'UNKNOWN';
          // logSummary[severity] = (logSummary[severity] || 0) + 1;
          
          // Extract log body
          let logMessage = '';
          if (logRecord.body?.stringValue) {
            logMessage = logRecord.body.stringValue;
          } else if (logRecord.body?.kvlistValue?.values) {
            // Handle structured logs
            const kvPairs = logRecord.body.kvlistValue.values.map(kv => 
              `${kv.key}=${kv.value.stringValue || kv.value.intValue || kv.value.doubleValue || kv.value.boolValue}`
            );
            logMessage = kvPairs.join(', ');
          }
          
          // Extract attributes
          const attrs = this.extractAttributes(logRecord.attributes || []);
          
          // Process API request logs to extract accurate token and cost data
          if (attrs['event.name'] === 'api_request' || attrs['event.name'] === 'user_prompt') {
            const inputTokens = parseInt(attrs['input_tokens'] || '0');
            const outputTokens = parseInt(attrs['output_tokens'] || '0');
            const cacheReadTokens = parseInt(attrs['cache_read_tokens'] || '0');
            const cacheCreationTokens = parseInt(attrs['cache_creation_tokens'] || '0');
            const cost = parseFloat(attrs['cost_usd'] || '0');
            
            // Update our telemetry status with the actual values from logs
            this.status.inputTokens += inputTokens;
            this.status.outputTokens += outputTokens;
            this.status.totalTokens = this.status.inputTokens + this.status.outputTokens;
            this.status.totalCost += cost;
            
            // Track cache tokens separately if needed
            if (!this.status.cacheReadTokens) this.status.cacheReadTokens = 0;
            if (!this.status.cacheCreationTokens) this.status.cacheCreationTokens = 0;
            this.status.cacheReadTokens += cacheReadTokens;
            this.status.cacheCreationTokens += cacheCreationTokens;
            
            telemetryUpdated = true;
            
            this.logger.info(`[API Request] Tokens: ${inputTokens} in, ${outputTokens} out, Cache: ${cacheReadTokens} read, ${cacheCreationTokens} created, Cost: $${cost.toFixed(2)}`);
          }
          
          // Log at appropriate level
          const timestamp = logRecord.timeUnixNano ? 
            new Date(parseInt(logRecord.timeUnixNano) / 1_000_000).toISOString() : 
            new Date().toISOString();
          
          // this.logger.info(`[OTLP Log] ${timestamp} [${severity}] ${logMessage} ${JSON.stringify(attrs)}`);
        });
      });
    });

    // this.logger.info(`Processed ${logCount} log records. Summary: ${JSON.stringify(logSummary)}`);
    
    // If we updated telemetry from logs, emit the update
    if (telemetryUpdated) {
      this.status.lastUpdate = new Date().toISOString();
      
      // Emit telemetry update with data from logs
      this.emit('telemetry-update', {
        metrics: {
          sessionCount: this.status.sessions,
          linesOfCodeModified: this.status.linesAdded + this.status.linesRemoved,
          apiCost: this.status.totalCost,
          tokenUsage: {
            input: this.status.inputTokens,
            output: this.status.outputTokens,
            total: this.status.totalTokens,
            cacheRead: this.status.cacheReadTokens,
            cacheCreation: this.status.cacheCreationTokens,
          },
          activeTimeMs: this.status.activeTimeMs,
          toolDecisions: this.status.toolUsage,
        },
        traces: {
          spans: [],
        },
        lastUpdate: this.status.lastUpdate,
      });
      
      this.logger.info(`Updated telemetry from logs - Total tokens: ${this.status.totalTokens}, Total cost: $${this.status.totalCost.toFixed(2)}`);
    }
    
    // Emit event for log processing
    this.emit('logs-received', {
      count: logCount,
      timestamp: new Date().toISOString()
    });
  }

  private processMetrics(payload: OTLPMetricsPayload): void {
    if (!payload.resourceMetrics) {
      this.logger.warn('No resourceMetrics in OTLP payload');
      return;
    }

    payload.resourceMetrics.forEach(rm => {
      // Extract resource attributes if needed
      const resourceAttrs = this.extractAttributes(rm.resource?.attributes || []);
      
      rm.scopeMetrics?.forEach(sm => {
        const scopeName = sm.scope?.name || 'unknown';
        this.logger.info(`Processing metrics from scope: ${scopeName}`);
        
        sm.metrics?.forEach(metric => {
          this.updateStatus(metric);
        });
      });
    });

    this.status.lastUpdate = new Date().toISOString();
    
    // Emit event with updated telemetry data

    this.emit('telemetry-update', {
      metrics: {
        sessionCount: this.status.sessions,
        linesOfCodeModified: this.status.linesAdded + this.status.linesRemoved,
        apiCost: this.status.totalCost,
        tokenUsage: {
          input: this.status.inputTokens,
          output: this.status.outputTokens,
          total: this.status.totalTokens,
        },
        activeTimeMs: this.status.activeTimeMs,
        toolDecisions: this.status.toolUsage,
      },
      traces: {
        spans: [], // Could be populated from trace data
      },
      lastUpdate: this.status.lastUpdate,
    });

  }

  private updateStatus(metric: OTLPMetric): void {
    const name = metric.name;
    this.logger.info(`Processing metric: ${name}`);

    switch (name) {
      case 'claude.sessions.total':
      case 'claude_code.session.count':
        this.status.sessions = this.getMetricValue(metric);
        this.status.currentSessionId = this.getAttribute(metric, 'session.id') || 
                                       this.getAttribute(metric, 'session_id') || null;
        break;

      case 'claude.tokens.total':
      case 'claude_code.token.usage':
        // NOTE: Token counts from metrics appear to be less accurate than logs
        // We now get more accurate token counts from the logs API request events
        const tokens = this.getMetricValue(metric);
        const tokenType = this.getAttribute(metric, 'type') || 
                         this.getAttribute(metric, 'token_type');
        
        // Only update if we haven't received log data yet
        if (this.status.totalTokens === 0) {
          if (tokenType === 'input') {
            this.status.inputTokens += tokens;
          } else if (tokenType === 'output') {
            this.status.outputTokens += tokens;
          }
          this.status.totalTokens = this.status.inputTokens + this.status.outputTokens;
        }
        break;

      case 'claude.api_calls.total':
      case 'claude_code.api_calls.count':
        // Could track API call counts here
        break;

      case 'claude.api_cost.total':
      case 'claude_code.cost.usage':
        // NOTE: Cost from metrics appears to be less accurate than logs
        // Only update if we haven't received log data yet
        if (this.status.totalCost === 0) {
          this.status.totalCost += this.getMetricValue(metric);
        }
        break;

      case 'claude.lines_modified.total':
      case 'claude_code.lines_of_code.count':
        const lines = this.getMetricValue(metric);
        const lineType = this.getAttribute(metric, 'type') || 
                        this.getAttribute(metric, 'operation');
        
        if (lineType === 'added' || lineType === 'add') {
          this.status.linesAdded += lines;
        } else if (lineType === 'removed' || lineType === 'remove') {
          this.status.linesRemoved += lines;
        }
        break;

      case 'claude.active_time.duration':
      case 'claude_code.active_time.ms':
        this.status.activeTimeMs = this.getMetricValue(metric);
        break;

      case 'claude.tool_usage.total':
      case 'claude_code.tool_usage.count':
        const toolName = this.getAttribute(metric, 'tool') || 
                        this.getAttribute(metric, 'tool_name') || 
                        'unknown';
        const count = this.getMetricValue(metric);
        
        if (!this.status.toolUsage[toolName]) {
          this.status.toolUsage[toolName] = 0;
        }
        this.status.toolUsage[toolName] += count;
        break;

      default:
        this.logger.info(`Unhandled metric: ${name}`);
    }
  }

  private getMetricValue(metric: OTLPMetric): number {
    // Handle different metric types
    let dataPoints: any[] = [];
    
    if (metric.sum?.dataPoints) {
      dataPoints = metric.sum.dataPoints;
    } else if (metric.gauge?.dataPoints) {
      dataPoints = metric.gauge.dataPoints;
    } else if (metric.histogram?.dataPoints) {
      // For histograms, we might want the sum or count
      return metric.histogram.dataPoints[0]?.sum || 
             metric.histogram.dataPoints[0]?.count || 0;
    }

    if (dataPoints.length > 0) {
      const point = dataPoints[0];
      return point.asInt || point.asDouble || 0;
    }

    return 0;
  }

  private getAttribute(metric: OTLPMetric, attrName: string): string | undefined {
    const dataPoints = metric.sum?.dataPoints || 
                      metric.gauge?.dataPoints || 
                      metric.histogram?.dataPoints || [];
    
    if (dataPoints.length > 0) {
      const attributes = dataPoints[0].attributes || [];
      const attr = attributes.find(a => a.key === attrName);
      return attr?.value?.stringValue || 
             (attr?.value?.intValue !== undefined ? String(attr.value.intValue) : undefined);
    }
    
    return undefined;
  }

  private extractAttributes(attributes: Array<{ key: string; value: any }>): Record<string, any> {
    const result: Record<string, any> = {};
    
    attributes.forEach(attr => {
      result[attr.key] = attr.value.stringValue || 
                        attr.value.intValue || 
                        attr.value.boolValue || 
                        attr.value;
    });
    
    return result;
  }

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.port, () => {
          this.logger.info(`OTLP Receiver running on http://localhost:${this.port}`);
          this.logger.info(`Metrics endpoint: http://localhost:${this.port}/v1/metrics`);
          this.logger.info(`Status API: http://localhost:${this.port}/status`);
          resolve();
        });

        this.server.on('error', (error: any) => {
          if (error.code === 'EADDRINUSE') {
            this.logger.warn(`Port ${this.port} is in use, OTLP receiver not started`);
            resolve(); // Don't fail the app if port is in use
          } else {
            reject(error);
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.logger.info('OTLP Receiver stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  getStatus(): TelemetryStatus {
    return { ...this.status };
  }

  resetStatus(): void {
    this.status = {
      sessions: 0,
      totalTokens: 0,
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
      totalCost: 0,
      linesAdded: 0,
      linesRemoved: 0,
      activeTimeMs: 0,
      toolUsage: {},
      lastUpdate: null,
      currentSessionId: null,
    };
  }
}