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

export class PRPGenerationService extends EventEmitter {
  private lastProgress = 0;
  
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
      
      // First, replace user-provided variables
      if (request.variables && metadata.variables) {
        for (const variable of metadata.variables) {
          const value = request.variables[variable.name] ?? variable.default ?? '';
          const placeholder = new RegExp(`{{${variable.name}}}`, 'g');
          
          processedTemplate = processedTemplate.replace(placeholder, String(value));
          
          // Handle conditional sections for boolean variables
          if (variable.type === 'boolean') {
            const conditionalPattern = new RegExp(
              `{{#${variable.name}}}([\\s\\S]*?){{/${variable.name}}}`,
              'g'
            );
            processedTemplate = processedTemplate.replace(
              conditionalPattern,
              value ? '$1' : ''
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
      const enhancedContent = await this.enhanceWithClaude(
        processedTemplate,
        request
      );
      
      return {
        content: enhancedContent,
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
      const env = {
        ...process.env,
        PATH: getShellPath()
      };
      
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
    return new Promise((resolve, reject) => {
      try {
        // Emit initial progress
        this.logger.info('Starting Claude with streaming mode for PRP generation');
        this.emit('progress', {
          stage: 'starting',
          message: 'Starting Claude Code...',
          progress: 5
        });
        
        // Use --print with --verbose and --output-format stream-json
        const args = ['--print', '--verbose', '--output-format', 'stream-json'];
        this.logger.info(`Executing Claude with args: ${args.join(' ')}`);
        
        const claudeProcess = spawn(claudePath, args, {
          cwd: codebasePath,
          env
        });
        
        let output = '';
        let jsonBuffer = '';
        let messageCount = 0;
        let lastProgressUpdate = Date.now();
        let lastMessageTime = Date.now();
        const startTime = Date.now();
        const MAX_SILENCE_MS = 300000; // 5 minutes without messages
        const MAX_TOTAL_TIME_MS = 3600000; // 60 minutes total
        
        // Set up timeout handlers
        let silenceTimeout: NodeJS.Timeout;
        let totalTimeout: NodeJS.Timeout;
        
        const resetSilenceTimeout = () => {
          if (silenceTimeout) clearTimeout(silenceTimeout);
          silenceTimeout = setTimeout(() => {
            this.logger.warn(`Claude process silent for ${MAX_SILENCE_MS}ms, terminating...`);
            this.emit('progress', {
              stage: 'error',
              message: 'Process timeout - no output for 5 minutes',
              progress: 0
            });
            claudeProcess.kill();
          }, MAX_SILENCE_MS);
        };
        
        // Total timeout
        totalTimeout = setTimeout(() => {
          this.logger.warn('Claude process exceeded maximum time limit, terminating...');
          this.emit('progress', {
            stage: 'error',
            message: 'Process timeout - exceeded 60 minute limit',
            progress: 0
          });
          claudeProcess.kill();
        }, MAX_TOTAL_TIME_MS);
        
        // Start silence timer
        resetSilenceTimeout();
        
        // Handle stdout data
        claudeProcess.stdout.on('data', (data) => {
          const chunk = data.toString();
          jsonBuffer += chunk;
          
          // Reset silence timeout on any data
          lastMessageTime = Date.now();
          resetSilenceTimeout();
          
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
                
                // Check if this is the final assistant message
                if (message.message.stop_reason) {
                  this.logger.info(`Assistant message stopped with reason: ${message.message.stop_reason}`);
                }
              }
              
              // Always check for progress updates on any message (except system)
              if (message.type !== 'system') {
                // Send progress update (throttled)
                const now = Date.now();
                if (now - lastProgressUpdate > 500) { // Update every 500ms
                  const progressPercent = Math.floor(Math.min(10 + messageCount / 2.3, 80));
                  const timeSinceLastMessage = now - lastMessageTime;
                  const totalElapsed = now - startTime;
                  
                  let statusMessage = `Claude is analyzing your requirements... (${messageCount} messages)`;
                  
                  // Add warning if approaching timeouts
                  if (timeSinceLastMessage > 120000) { // 2 minutes of silence
                    statusMessage += ' - waiting for response...';
                  }
                  if (totalElapsed > 1200000) { // 20 minutes total
                    statusMessage += ' - this is taking longer than usual';
                  }
                  if (totalElapsed > 2400000) { // 40 minutes total
                    statusMessage += ' (consider simplifying the request)';
                  }
                  
                  this.emit('progress', {
                    stage: 'processing',
                    message: statusMessage,
                    progress: progressPercent
                  });
                  lastProgressUpdate = now;
                }
              } else if (message.type === 'result') {
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
          // Only log stderr if it contains actual errors (not just warnings)
          if (stderr.toLowerCase().includes('error')) {
            this.logger.warn(`Claude stderr: ${stderr}`);
          }
        });
        
        // Write the prompt
        claudeProcess.stdin.write(prompt);
        claudeProcess.stdin.end();
        
        // Handle process completion
        claudeProcess.on('close', (code) => {
          // Clear timeouts
          if (silenceTimeout) clearTimeout(silenceTimeout);
          if (totalTimeout) clearTimeout(totalTimeout);
          
          const duration = Date.now() - startTime;
          
          if (code === 0) {
            const enhanced = this.postProcessResult(output.trim(), request, duration);
            this.emit('progress', {
              stage: 'complete',
              message: 'PRP generation complete!',
              progress: 100,
              metadata: {
                duration_ms: duration
              }
            });
            this.logger.info(`PRP generation completed in ${duration}ms`);
            resolve(enhanced);
          } else if (code === null || code === -15) { // -15 is SIGTERM
            // Process was killed by timeout
            this.logger.error(`Claude process terminated (timeout or manual kill)`);
            // Don't emit another error if already emitted by timeout handler
            if (output.trim()) {
              // If we have partial output, use it
              const enhanced = this.postProcessResult(output.trim(), request, duration);
              resolve(enhanced);
            } else {
              resolve(this.enhanceWithSimpleLogic(prompt, request));
            }
          } else {
            this.logger.error(`Claude process exited with code ${code}`);
            this.emit('progress', {
              stage: 'error',
              message: 'Claude encountered an error, using fallback generation',
              progress: 0
            });
            resolve(this.enhanceWithSimpleLogic(prompt, request));
          }
        });
        
        // Handle errors
        claudeProcess.on('error', (error) => {
          this.logger.error('Failed to spawn Claude process:', error);
          this.emit('progress', {
            stage: 'error',
            message: 'Failed to start Claude, using fallback generation',
            progress: 0
          });
          resolve(this.enhanceWithSimpleLogic(prompt, request));
        });
        
      } catch (error) {
        this.logger.error('Failed to start streaming Claude:', error instanceof Error ? error : new Error(String(error)));
        reject(error);
      }
    });
  }
  
  private postProcessResult(result: string, request: PRPGenerationRequest, duration?: number): string {
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
}