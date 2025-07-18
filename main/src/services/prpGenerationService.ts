import { Logger } from '../utils/logger';
import { TemplateService } from './templateService';
import type { PRPGenerationRequest } from '../types/prp';
import { execSync, spawn } from 'child_process';
import { ConfigManager } from './configManager';
import { DatabaseService } from '../database/database';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';
import { getShellPath, findExecutableInPath } from '../utils/shellPath';
import { EventEmitter } from 'events';
import { getClaudeTelemetryEnv, getTracer } from '../telemetry';
import { ClaudeTelemetryCollector } from '../telemetry/claudeInstrumentation';
import { SpanStatusCode } from '@opentelemetry/api';
import { OTLPReceiver } from '../telemetry/otlpReceiver';

export class PRPGenerationService extends EventEmitter {
  private lastProgress = 0;
  private activeProcess: ReturnType<typeof spawn> | null = null;
  
  constructor(
    private templateService: TemplateService,
    private logger: Logger,
    private configManager?: ConfigManager
  ) {
    super();
  }

  async generateFromTemplate(request: PRPGenerationRequest): Promise<{
    content: string;
    templateUsed: string;
    generatedAt: string;
  }> {
    try {
      this.logger.info(`generateFromTemplate called with request: ${JSON.stringify({
        templateId: request.templateId,
        featureRequest: request.featureRequest?.substring(0, 50) + '...',
        codebasePath: request.codebasePath
      })}`);
      
      // Load template components
      const { metadata, template } = await this.templateService.getTemplate(
        request.templateId
      );
      
      this.logger.info(`Generating PRP using template: ${metadata.name}`);
      // Process variables
      let processedTemplate = template;
      
      // TODO: We aren't currently using metadata.variables, but we should.
      
      // First, validate required variables
      if (metadata.variables) {
        for (const variable of metadata.variables) {
          const value = request.variables?.[variable.name] ?? variable.default;
          
          // Check required variables
          if (variable.required && (value === undefined || value === null || value === '')) {
            throw new Error(`Missing required variable: ${variable.name}`);
          }
          
          // Validate patterns for string variables
          if (variable.type === 'string' && variable.pattern && value !== undefined && value !== null && value !== '') {
            const pattern = new RegExp(variable.pattern);
            if (!pattern.test(String(value))) {
              throw new Error(`Invalid value for ${variable.name}: does not match pattern ${variable.pattern}`);
            }
          }
          
          // Validate enum values (for string type with options)
          if (variable.type === 'string' && variable.options && value !== undefined && value !== null && value !== '') {
            if (!variable.options.includes(String(value))) {
              throw new Error(`Invalid value for ${variable.name}: must be one of ${variable.options.join(', ')}`);
            }
          }
        }
      }
      
      // Replace user-provided variables
      if (request.variables && metadata.variables) {
        for (const variable of metadata.variables) {
          const value = request.variables[variable.name] ?? variable.default ?? '';
          const placeholder = new RegExp(`{{${variable.name}}}`, 'g');
          
          processedTemplate = processedTemplate.replace(placeholder, String(value));
          
          // Handle conditional sections for boolean variables
          if (variable.type === 'boolean') {
            // Handle positive conditionals {{#VAR}}...{{/VAR}}
            const conditionalPattern = new RegExp(
              `{{#${variable.name}}}([\\s\\S]*?){{/${variable.name}}}`,
              'g'
            );
            processedTemplate = processedTemplate.replace(
              conditionalPattern,
              value ? '$1' : ''
            );
            
            // Handle negative conditionals {{^VAR}}...{{/VAR}}
            const negativePattern = new RegExp(
              `{{\\^${variable.name}}}([\\s\\S]*?){{/${variable.name}}}`,
              'g'
            );
            processedTemplate = processedTemplate.replace(
              negativePattern,
              !value ? '$1' : ''
            );
          }
          
          // Handle enum equality checks
          if (variable.type === 'enum') {
            variable.options?.forEach(option => {
              const eqPattern = new RegExp(
                `{{#eq ${variable.name} "${option}"}}([\\s\\S]*?){{/eq}}`,
                'g'
              );
              processedTemplate = processedTemplate.replace(
                eqPattern,
                value === option ? '$1' : ''
              );
            });
          }
        }
      }
      
      // Replace standard variables
      const standardReplacements = {
        FEATURE_REQUEST: request.featureRequest,
        CODEBASE_PATH: request.codebasePath || 'This is a NEW PROJECT with no existing codebase',
      };
      
      for (const [key, value] of Object.entries(standardReplacements)) {
        const placeholder = new RegExp(`\\$${key}`, 'g');
        processedTemplate = processedTemplate.replace(placeholder, value);
      }

      // Use Claude Code to enhance the template with project-specific context
      let finalContent = processedTemplate;
      if (request.useClaudeGeneration !== false) {
        finalContent = await this.enhanceWithClaude(
          processedTemplate,
          request
        );
      }

      return {
        content: finalContent,
        templateUsed: metadata.id,
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error('Failed to generate PRP from template:', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  private async enhanceWithClaude(
    template: string,
    request: PRPGenerationRequest
  ): Promise<string> {
    return new Promise(async (resolve, reject) => {
      let otlpReceiver: OTLPReceiver | null = null;
      
      try {
        // Use provided codebase path or current directory
        const codebasePath = request.codebasePath || process.cwd();
        
        // Simply use the template as the prompt (it already has everything)
        const prompt = template;
        
        // Get Claude executable path
        const claudePath = this.getClaudePath();
        
        // Prepare environment
        const telemetryEnv = getClaudeTelemetryEnv({
          enable: true, // Always enable telemetry for PRP generation
          exporter: this.configManager?.getConfig()?.telemetryExporter || 'otlp', // Default to OTLP
          endpoint: this.configManager?.getConfig()?.telemetryEndpoint || 'http://localhost:4318'
        });
        
        const env = {
          ...process.env,
          PATH: getShellPath(),
          ...telemetryEnv,
          OTEL_SERVICE_NAME: 'crystal-prp-generation'
        } as { [key: string]: string };
        
        // Log telemetry configuration for debugging
        this.logger.info(`Telemetry enabled: CLAUDE_CODE_ENABLE_TELEMETRY=${telemetryEnv.CLAUDE_CODE_ENABLE_TELEMETRY}, OTEL_METRICS_EXPORTER=${telemetryEnv.OTEL_METRICS_EXPORTER}`);
        // Check if we should use OTLP
        const useOTLP = env.OTEL_METRICS_EXPORTER === 'otlp';
        
        if (useOTLP) {
          // Start OTLP receiver
          otlpReceiver = new OTLPReceiver(4318, this.logger);
          await otlpReceiver.start();
          
          // Override environment to use local OTLP endpoint
          env.OTEL_EXPORTER_OTLP_ENDPOINT = 'http://localhost:4318';
          env.OTEL_EXPORTER_OTLP_PROTOCOL = 'http/json';
          
          this.logger.info('Started local OTLP receiver for telemetry collection');
          this.logger.info(`Claude env vars: OTEL_EXPORTER_OTLP_ENDPOINT=${env.OTEL_EXPORTER_OTLP_ENDPOINT}, OTEL_METRICS_EXPORTER=${env.OTEL_METRICS_EXPORTER}, OTEL_METRIC_EXPORT_INTERVAL=${env.OTEL_METRIC_EXPORT_INTERVAL}`);
        }
        
        // Emit initial progress
        this.logger.info('Starting Claude for PRP generation');
        this.emit('progress', {
          stage: 'starting',
          message: 'Starting Claude Code...'
        });
        
        // Use --print with --verbose (no streaming)
        const args = ['--print', '--verbose'];
        this.logger.info(`Executing Claude with args: ${args.join(' ')}`);
        
        const claudeProcess = spawn(claudePath, args, {
          cwd: codebasePath,
          env
        });
        
        // Store reference to active process
        this.activeProcess = claudeProcess;
        
        // Initialize telemetry
        const tracer = getTracer('prp-generation');
        const span = tracer.startSpan('claude.prp.generation');
        span.setAttributes({
          'prp.template_id': request.templateId,
          'prp.codebase_path': codebasePath,
          'claude.command': args.join(' ')
        });
        
        const telemetryCollector = new ClaudeTelemetryCollector();
        telemetryCollector.startOperation('prp-generation', {
          templateId: request.templateId,
          codebasePath
        });
        
        let output = '';
        const startTime = Date.now();
        
        // Set up OTLP telemetry updates
        if (otlpReceiver) {
          otlpReceiver.on('telemetry-update', (telemetryData) => {
            // Merge OTLP data with collector data
            telemetryCollector.metrics.tokenUsage = telemetryData.metrics.tokenUsage;
            telemetryCollector.metrics.apiCost = telemetryData.metrics.apiCost;
            telemetryCollector.metrics.toolDecisions = telemetryData.metrics.toolDecisions;
            telemetryCollector.metrics.activeTimeMs = telemetryData.metrics.activeTimeMs;
            
            this.logger.info(`OTLP telemetry update - tokens: ${telemetryData.metrics.tokenUsage.total}, cost: $${telemetryData.metrics.apiCost.toFixed(2)}`);
            
            // Emit progress update when we receive telemetry
            this.emit('progress', {
              stage: 'processing',
              message: 'Claude is analyzing your requirements...',
              progress: Math.min(50 + Math.floor(telemetryData.metrics.tokenUsage.total / 100), 90),
              telemetry: telemetryCollector.getTelemetryData()
            });
          });
        }
        
        
        // Handle stdout data - simple collection without JSON parsing
        claudeProcess.stdout.on('data', (data) => {
          output += data.toString();
        });
        
        // Handle stderr 
        claudeProcess.stderr.on('data', (data) => {
          const stderr = data.toString();
          if (stderr.toLowerCase().includes('error')) {
            this.logger.warn(`Claude stderr: ${stderr}`);
          }
        });
        
        // Write the prompt
        claudeProcess.stdin.write(prompt);
        claudeProcess.stdin.end();
        
        // Emit processing stage after sending prompt
        this.emit('progress', {
          stage: 'processing',
          message: 'Claude is analyzing your requirements...',
          progress: 10
        });
        
        // Handle process completion
        claudeProcess.on('close', async (code) => {
          
          // Clear process reference
          this.activeProcess = null;
          
          // Stop OTLP receiver if running
          if (otlpReceiver) {
            await otlpReceiver.stop();
            this.logger.info('Stopped OTLP receiver');
          }
          
          const duration = Date.now() - startTime;
          
          if (code === 0) {
            // End telemetry spans successfully
            telemetryCollector.endOperation('prp-generation', {
              code: SpanStatusCode.OK
            });
            span.setStatus({ code: SpanStatusCode.OK });
            span.end();
            
            const telemetryData = telemetryCollector.getTelemetryData();
            const enhanced = this.postProcessResult(output.trim(), request, duration, telemetryData);
            this.emit('progress', {
              stage: 'complete',
              message: 'PRP generation complete!',
              progress: 100,
              telemetry: telemetryData,
              metadata: {
                duration_ms: duration
              }
            });
            this.logger.info(`PRP generation completed in ${duration}ms`);
            resolve(enhanced);
          } else if (code === null || code === -15) { // -15 is SIGTERM
            // Process was killed by timeout
            telemetryCollector.endOperation('prp-generation', {
              code: SpanStatusCode.ERROR,
              message: 'Process terminated'
            });
            span.setStatus({ code: SpanStatusCode.ERROR, message: 'Process terminated' });
            span.end();
            
            this.logger.error(`Claude process terminated (timeout or manual kill)`);
            // Don't emit another error if already emitted by timeout handler
            if (output.trim()) {
              // If we have partial output, use it
              const telemetryData = telemetryCollector.getTelemetryData();
              const enhanced = this.postProcessResult(output.trim(), request, duration, telemetryData);
              resolve(enhanced);
            } else {
              resolve(this.enhanceWithSimpleLogic(prompt, request));
            }
          } else {
            telemetryCollector.endOperation('prp-generation', {
              code: SpanStatusCode.ERROR,
              message: `Process exited with code ${code}`
            });
            span.setStatus({ code: SpanStatusCode.ERROR, message: `Process exited with code ${code}` });
            span.end();
            
            this.logger.error(`Claude process exited with code ${code}`);
            this.emit('progress', {
              stage: 'error',
              message: 'Claude encountered an error, using fallback generation',
              progress: 0,
              telemetry: telemetryCollector.getTelemetryData()
            });
            resolve(this.enhanceWithSimpleLogic(prompt, request));
          }
        });
        
        // Handle errors
        claudeProcess.on('error', async (error) => {
          
          // Clear process reference
          this.activeProcess = null;
          
          // Stop OTLP receiver if running
          if (otlpReceiver) {
            await otlpReceiver.stop();
            this.logger.info('Stopped OTLP receiver after error');
          }
          
          telemetryCollector.endOperation('prp-generation', {
            code: SpanStatusCode.ERROR,
            message: error.message
          });
          span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
          span.end();
          
          this.logger.error('Failed to spawn Claude process:', error);
          this.emit('progress', {
            stage: 'error',
            message: 'Failed to start Claude, using fallback generation',
            progress: 0,
            telemetry: telemetryCollector.getTelemetryData()
          });
          resolve(this.enhanceWithSimpleLogic(prompt, request));
        });
        
      } catch (error) {
        // Clean up OTLP receiver if it was started
        if (otlpReceiver) {
          await otlpReceiver.stop();
          this.logger.info('Stopped OTLP receiver after exception');
        }
        
        this.logger.error('Failed to start streaming Claude:', error instanceof Error ? error : new Error(String(error)));
        reject(error);
      }
    });
  }
  
  private postProcessResult(result: string, request: PRPGenerationRequest, duration?: number, telemetryData?: any): string {
    let enhanced = result;
    
    // Add timestamp
    enhanced = enhanced.replace(
      /^(# .+)$/m,
      `$1\n\n*Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}*`
    );
    
    // Add template attribution at the end if not already present
    if (!enhanced.includes('Template used:')) {
      enhanced += `\n\n---\n\n*Template used: ${request.templateId}*`;
      if (request.codebasePath) {
        enhanced += `\n*Generated for codebase: ${request.codebasePath}*`;
      } else {
        enhanced += `\n*Generated for new project*`;
      }
      
      // Add generation duration if provided
      if (duration !== undefined) {
        const minutes = Math.floor(duration / 60000);
        const seconds = Math.floor((duration % 60000) / 1000);
        enhanced += `\n*Generation time: ${minutes}m ${seconds}s*`;
      }
      
      // Add token usage and API cost if telemetry data is available
      if (telemetryData?.metrics) {
        const { tokenUsage, apiCost } = telemetryData.metrics;
        if (tokenUsage && tokenUsage.total > 0) {
          enhanced += `\n*Tokens used: ${tokenUsage.total.toLocaleString()} (${tokenUsage.input.toLocaleString()} input, ${tokenUsage.output.toLocaleString()} output)*`;
        }
        if (apiCost !== undefined && apiCost > 0) {
          enhanced += `\n*API cost: $${apiCost.toFixed(2)}*`;
        }
      }
    }
    
    return enhanced;
  }
  
  
  private getClaudePath(): string {
    // Check for custom Claude path
    const customPath = this.configManager?.getConfig()?.claudeExecutablePath;
    if (customPath) {
      return customPath;
    }
    
    // Find Claude in PATH
    const claudePath = findExecutableInPath('claude');
    if (claudePath) {
      return claudePath;
    }
    
    // Default fallback
    return 'claude';
  }
  
  private async enhanceWithSimpleLogic(
    template: string,
    request: PRPGenerationRequest
  ): Promise<string> {
    // Simple enhancements without AI as fallback
    let enhanced = template;
    
    // Add timestamp
    enhanced = enhanced.replace(
      /^(# .+)$/m,
      `$1\n\n*Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}*`
    );
    
    // Add template attribution at the end
    if (!enhanced.includes('Template used:')) {
      enhanced += `\n\n---\n\n*Template used: ${request.templateId}*`;
      if (request.codebasePath) {
        enhanced += `\n*Generated for codebase: ${request.codebasePath}*`;
      } else {
        enhanced += `\n*Generated for new project*`;
      }
    }
    
    // Clean up any remaining placeholders
    enhanced = enhanced.replace(/{{[^}]+}}/g, '[TO BE FILLED]');
    
    return enhanced;
  }

  async getAvailableTemplates() {
    return this.templateService.getAllTemplates();
  }

  async validateTemplate(templatePath: string) {
    return this.templateService.validateTemplate(templatePath);
  }

  /**
   * Cancel the active PRP generation process if one is running
   */
  cancelGeneration(): void {
    if (this.activeProcess) {
      this.logger.info('Cancelling active PRP generation process');
      
      // Kill the process
      this.activeProcess.kill('SIGTERM');
      
      // Emit cancellation event
      this.emit('progress', {
        stage: 'error',
        message: 'Generation cancelled by user',
        progress: 0
      });
      
      this.activeProcess = null;
    }
  }
}