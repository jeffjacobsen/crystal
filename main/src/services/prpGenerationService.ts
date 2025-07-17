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
        codebasePath: request.codebasePath,
        streamProgress: request.streamProgress
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
      
      // Check if we should use streaming mode
      const useStreaming = request.streamProgress !== false;
      this.logger.info(`PRP generation mode - streaming: ${useStreaming}, streamProgress: ${request.streamProgress}`);
      
      if (useStreaming) {
        // Use streaming with proper flags
        this.logger.info('Calling enhanceWithClaudeStreaming method');
        return this.enhanceWithClaudeStreaming(prompt, codebasePath, claudePath, env, request);
      } else {
        // No progress events, just execute with --print
        try {
          this.logger.info('Starting Claude with non-streaming mode for PRP generation');
          const result = execSync(
            `${claudePath} --print --output-format text`,
            {
              input: prompt,
              encoding: 'utf8',
              cwd: codebasePath,
              env,
              maxBuffer: 10 * 1024 * 1024 // 10MB buffer
            }
          );
          console.log('ClaudeCode execution completed');
          return this.postProcessResult(result.trim(), request);
        } catch (error) {
          this.logger.error('Failed to enhance PRP with Claude:', error instanceof Error ? error : new Error(String(error)));
          return this.enhanceWithSimpleLogic(template, request);
        }
      }
    } catch (error) {
      this.logger.error('Failed to enhance PRP with Claude:', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }
  
  private async enhanceWithClaudeStreaming(
    prompt: string,
    codebasePath: string,
    claudePath: string,
    env: any,
    request: PRPGenerationRequest
  ): Promise<string> {
    return new Promise(async (resolve, reject) => {
      let otlpReceiver: OTLPReceiver | null = null;
      
      try {
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
        this.logger.info('Starting Claude with streaming mode for PRP generation');
        this.emit('progress', {
          stage: 'starting',
          message: 'Starting Claude Code...'
        });
        
        // Use --print with --verbose and --output-format stream-json
        const args = ['--print', '--verbose', '--output-format', 'stream-json'];
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
        let jsonBuffer = '';
        let messageCount = 0;
        let lastProgressUpdate = Date.now();
        let lastMessageTime = Date.now();
        const startTime = Date.now();
        const MAX_SILENCE_MS = 300000; // 5 minutes without messages
        const MAX_TOTAL_TIME_MS = 3600000; // 60 minutes total
        
        
        // Set up telemetry interval updates (every 1 second)
        let currentStage: 'starting' | 'processing' = 'processing';
        
        // If using OTLP, listen for telemetry updates and emit progress immediately
        if (otlpReceiver) {
          otlpReceiver.on('telemetry-update', (telemetryData) => {
            // Merge OTLP data with collector data
            telemetryCollector.metrics.tokenUsage = telemetryData.metrics.tokenUsage;
            telemetryCollector.metrics.apiCost = telemetryData.metrics.apiCost;
            telemetryCollector.metrics.toolDecisions = telemetryData.metrics.toolDecisions;
            telemetryCollector.metrics.activeTimeMs = telemetryData.metrics.activeTimeMs;
            
            this.logger.info(`OTLP telemetry update - tokens: ${telemetryData.metrics.tokenUsage.total}, cost: $${telemetryData.metrics.apiCost.toFixed(2)}`);
            
            // Emit progress update immediately when OTLP data is received
            const now = Date.now();
            const timeSinceLastMessage = now - lastMessageTime;
            const totalElapsed = now - startTime;
            
            let statusMessage = 'Claude is analyzing your requirements...';
            
            // Add warning if approaching timeouts
            if (timeSinceLastMessage > 120000) { // 2 minutes of silence
              statusMessage = 'Waiting for Claude response...';
            }
            if (totalElapsed > 1200000) { // 20 minutes total
              statusMessage = 'This is taking longer than usual...';
            }
            if (totalElapsed > 2400000) { // 40 minutes total
              statusMessage = 'Consider simplifying the request if Claude seems stuck';
            }
            
            // Emit progress with the fresh OTLP data
            this.emit('progress', {
              stage: currentStage,
              message: statusMessage,
              progress: Math.floor(Math.min(10 + messageCount / 2.3, 80)),
              telemetry: telemetryCollector.getTelemetryData()
            });
          });
        }
        
        const telemetryInterval = setInterval(() => {
          // If using OTLP, skip interval updates as we get real-time updates from OTLP events
          if (otlpReceiver) {
            return;
          }
          
          const now = Date.now();
          const timeSinceLastMessage = now - lastMessageTime;
          const totalElapsed = now - startTime;
          
          // Get telemetry data from collector (for console exporter)
          const telemetryData = telemetryCollector.getTelemetryData();
          
          let statusMessage = 'Claude is analyzing your requirements...';
          
          // Add warning if approaching timeouts
          if (timeSinceLastMessage > 120000) { // 2 minutes of silence
            statusMessage = 'Waiting for Claude response...';
          }
          if (totalElapsed > 1200000) { // 20 minutes total
            statusMessage = 'This is taking longer than usual...';
          }
          if (totalElapsed > 2400000) { // 40 minutes total
            statusMessage = 'Consider simplifying the request if Claude seems stuck';
          }
          
          this.emit('progress', {
            stage: currentStage,
            message: statusMessage,
            progress: Math.floor(Math.min(10 + messageCount / 2.3, 80)),
            telemetry: telemetryData
          });
        }, 10000);
        
        
        // Handle stdout data
        claudeProcess.stdout.on('data', (data) => {
          const chunk = data.toString();
          jsonBuffer += chunk;
          
          
          // Try to parse complete JSON messages (newline-delimited)
          const lines = jsonBuffer.split('\n');
          jsonBuffer = lines.pop() || ''; // Keep incomplete line in buffer
          
          for (const line of lines) {
            if (!line.trim()) continue;
            
            try {
              const message = JSON.parse(line);
              messageCount++;
              
              // Log message types for debugging timeout issues
              if (messageCount > 200) {
                this.logger.info(`Message #${messageCount} type: ${message.type}`);
              }
              
              // Handle different message types
              if (message.type === 'assistant' && message.message) {
                // Extract text content from nested message structure
                const content = message.message.content;
                if (Array.isArray(content)) {
                  for (const item of content) {
                    if (item.type === 'text' && item.text) {
                      output += item.text;
                    }
                  }
                }
                
              } else if (message.type === 'telemetry' || message.type === 'metrics') {
                // Handle telemetry messages specifically
                this.logger.info(`Received telemetry message: ${JSON.stringify(message)}`);
              }
              
              // Only update last message time for timeout tracking
              if (message.type !== 'system') {
                lastMessageTime = Date.now();
              }
              
              if (message.type === 'result') {
                // Final result message with metadata
                this.emit('progress', {
                  stage: 'finalizing',
                  message: 'Finalizing PRP generation...',
                  progress: 90,
                  metadata: {
                    duration_ms: message.duration_ms,
                    num_turns: message.num_turns
                  }
                });
              }
            } catch (err) {
              // Not valid JSON, might be partial - this is normal
            }
          }
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
        
        // Handle process completion
        claudeProcess.on('close', async (code) => {
          // Clear timeouts and intervals
          if (telemetryInterval) clearInterval(telemetryInterval);
          
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
          // Clear interval
          if (telemetryInterval) clearInterval(telemetryInterval);
          
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