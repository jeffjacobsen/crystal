import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { EventEmitter } from 'events';
import { Logger } from '../utils/logger';

interface ScrapingResult {
  success: boolean;
  title?: string;
  content?: string;
  excerpt?: string;
  metadata?: {
    description?: string;
    author?: string;
    keywords?: string[];
    codeExamples?: string[];
  };
  error?: string;
}

interface ScrapingProgress {
  status: string;
  message: string;
  progress?: number;
}

export class WebScrapingService extends EventEmitter {
  private logger: Logger;
  private pythonProcess: ChildProcess | null = null;
  private pythonPath: string | null = null;
  private scraperPath: string;

  constructor(logger: Logger) {
    super();
    this.logger = logger;
    this.scraperPath = path.join(__dirname, '..', 'scripts', 'web_scraper.py');
    // Fallback scraper path
    this.fallbackScraperPath = path.join(__dirname, '..', 'scripts', 'web_scraper_fallback.py');
  }

  private fallbackScraperPath: string;

  async initialize(): Promise<void> {
    // Check if Python is available
    this.pythonPath = await this.findPython();
    if (!this.pythonPath) {
      throw new Error('Python 3.8+ is required for web scraping. Please install Python.');
    }

    // Check if the scraper script exists
    if (!fs.existsSync(this.scraperPath)) {
      throw new Error(`Web scraper script not found at ${this.scraperPath}. Please ensure the Python script is available.`);
    }
    
    this.logger.info('Using web scraper with recursive crawling support');

    // Install crawl4ai if needed
    await this.ensureCrawl4aiInstalled();
  }

  private async findPython(): Promise<string | null> {
    const pythonCommands = ['python3', 'python'];
    
    for (const cmd of pythonCommands) {
      try {
        const result = await this.executeCommand(cmd, ['--version']);
        if (result.includes('Python 3.')) {
          const versionMatch = result.match(/Python 3\.(\d+)/);
          if (versionMatch && parseInt(versionMatch[1]) >= 8) {
            this.logger.info(`Found Python: ${result.trim()}`);
            return cmd;
          }
        }
      } catch (error) {
        // Continue trying other commands
      }
    }
    
    return null;
  }

  private executeCommand(command: string, args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const process = spawn(command, args);
      let output = '';
      let error = '';

      process.stdout.on('data', (data) => {
        output += data.toString();
      });

      process.stderr.on('data', (data) => {
        error += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(error || `Command failed with code ${code}`));
        }
      });
    });
  }

  private async ensureCrawl4aiInstalled(): Promise<void> {
    try {
      await this.executeCommand(this.pythonPath!, ['-c', 'import crawl4ai']);
      this.logger.info('crawl4ai is already installed');
    } catch (error) {
      this.logger.info('Installing crawl4ai...');
      this.emit('progress', {
        status: 'installing',
        message: 'Installing crawl4ai library...'
      });

      try {
        // Install in user directory to avoid permission issues
        await this.executeCommand(this.pythonPath!, ['-m', 'pip', 'install', '--user', 'crawl4ai']);
        this.logger.info('crawl4ai installed successfully');
      } catch (installError) {
        this.logger.error('Failed to install crawl4ai:', installError instanceof Error ? installError : new Error(String(installError)));
        throw new Error('Failed to install crawl4ai. Please install it manually: pip install crawl4ai');
      }
    }
  }


  async scrapeUrl(url: string, options?: {
    mode?: 'single' | 'recursive' | 'auto';
    maxDepth?: number;
    maxPages?: number;
    followInternalOnly?: boolean;
  }): Promise<ScrapingResult> {
    if (!this.pythonPath) {
      throw new Error('Python not available. Please initialize the service first.');
    }

    return new Promise((resolve, reject) => {
      this.logger.info(`Scraping URL: ${url} with options: ${JSON.stringify(options)}`);
      
      // Prepare arguments
      const args = [this.scraperPath, url];
      if (options) {
        args.push(JSON.stringify(options));
      }
      
      const process = spawn(this.pythonPath!, args);
      let outputBuffer = '';

      process.stdout.on('data', (data) => {
        outputBuffer += data.toString();
        
        // Try to parse complete JSON messages
        const lines = outputBuffer.split('\n');
        outputBuffer = lines.pop() || ''; // Keep incomplete line in buffer
        
        for (const line of lines) {
          if (line.trim()) {
            try {
              const message = JSON.parse(line);
              
              if (message.type === 'progress') {
                this.emit('progress', {
                  status: message.status,
                  message: message.message,
                  progress: message.progress
                } as ScrapingProgress);
              } else if (message.type === 'result') {
                resolve(message as ScrapingResult);
              } else if (message.type === 'error') {
                reject(new Error(message.error));
              }
            } catch (error) {
              this.logger.warn(`Failed to parse scraper output: ${line}`);
            }
          }
        }
      });

      process.stderr.on('data', (data) => {
        this.logger.error(`Scraper error: ${data.toString()}`);
      });

      process.on('error', (error) => {
        reject(new Error(`Failed to start scraper: ${error.message}`));
      });

      process.on('close', (code) => {
        if (code !== 0 && code !== null) {
          reject(new Error(`Scraper exited with code ${code}`));
        }
      });

      // Timeout after 120 seconds
      setTimeout(() => {
        process.kill();
        reject(new Error('Scraping timeout after 120 seconds'));
      }, 120000);
    });
  }

  /**
   * Detect the type of documentation based on URL and content
   */
  detectDocumentationType(url: string, content: string): string {
    const urlLower = url.toLowerCase();
    const contentLower = content.toLowerCase();

    // API documentation patterns
    if (urlLower.includes('/api/') || urlLower.includes('/reference/') ||
        contentLower.includes('api reference') || contentLower.includes('endpoint')) {
      return 'api-reference';
    }

    // Framework documentation
    if (urlLower.includes('/docs/') || urlLower.includes('/guide/') ||
        contentLower.includes('getting started') || contentLower.includes('installation')) {
      return 'framework-docs';
    }

    // Tutorial or guide
    if (urlLower.includes('/tutorial/') || urlLower.includes('/learn/') ||
        contentLower.includes('step by step') || contentLower.includes('how to')) {
      return 'tutorial';
    }

    // Tool documentation
    if (urlLower.includes('/cli/') || urlLower.includes('/tools/') ||
        contentLower.includes('command line') || contentLower.includes('cli')) {
      return 'tool-docs';
    }

    return 'general';
  }

  /**
   * Generate tags based on content analysis
   */
  generateTags(url: string, content: string, metadata?: any): string[] {
    const tags = new Set<string>();

    // Add tags from URL
    const urlParts = url.split('/').filter(part => part && !part.includes('.'));
    urlParts.forEach(part => {
      if (part.length > 2 && !part.match(/^(www|com|org|io|dev|docs)$/)) {
        tags.add(part.toLowerCase());
      }
    });

    // Add tags from metadata keywords
    if (metadata?.keywords) {
      metadata.keywords.forEach((keyword: string) => {
        if (keyword.trim()) {
          tags.add(keyword.trim().toLowerCase());
        }
      });
    }

    // Detect common technologies
    const techPatterns = [
      { pattern: /react/i, tag: 'react' },
      { pattern: /vue/i, tag: 'vue' },
      { pattern: /angular/i, tag: 'angular' },
      { pattern: /typescript/i, tag: 'typescript' },
      { pattern: /javascript/i, tag: 'javascript' },
      { pattern: /python/i, tag: 'python' },
      { pattern: /node\.?js/i, tag: 'nodejs' },
      { pattern: /electron/i, tag: 'electron' },
      { pattern: /api/i, tag: 'api' },
      { pattern: /rest/i, tag: 'rest' },
      { pattern: /graphql/i, tag: 'graphql' },
      { pattern: /database/i, tag: 'database' },
      { pattern: /authentication/i, tag: 'auth' },
      { pattern: /docker/i, tag: 'docker' },
      { pattern: /kubernetes/i, tag: 'kubernetes' },
    ];

    const contentSample = content.substring(0, 5000); // Check first 5000 chars
    techPatterns.forEach(({ pattern, tag }) => {
      if (pattern.test(contentSample)) {
        tags.add(tag);
      }
    });

    return Array.from(tags).slice(0, 10); // Limit to 10 tags
  }

  destroy(): void {
    if (this.pythonProcess) {
      this.pythonProcess.kill();
      this.pythonProcess = null;
    }
  }
}