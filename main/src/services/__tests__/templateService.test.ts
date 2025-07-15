import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TemplateService } from '../templateService';
import * as path from 'path';
import * as fsExtra from 'fs-extra';

// Mock dependencies
vi.mock('fs-extra', () => ({
  ensureDirSync: vi.fn(),
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  readdirSync: vi.fn(),
  readFile: vi.fn(),
  readdir: vi.fn(),
  pathExists: vi.fn(),
  readJson: vi.fn(),
  stat: vi.fn()
}));
vi.mock('electron', () => ({
  app: {
    getAppPath: vi.fn(() => '/mock/app/path'),
    getPath: vi.fn(() => '/mock/path/userData')
  }
}));

// Helper to create Dirent-like objects
function createDirent(name: string, isDirectory: boolean) {
  return {
    name,
    isDirectory: () => isDirectory,
    isFile: () => !isDirectory,
    isBlockDevice: () => false,
    isCharacterDevice: () => false,
    isSymbolicLink: () => false,
    isFIFO: () => false,
    isSocket: () => false
  };
}

describe('TemplateService', () => {
  let templateService: TemplateService;
  let mockLogger: any;
  const mockTemplateDir = '/mock/app/path/resources/prp-templates/default';

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      verbose: vi.fn(),
      warn: vi.fn()
    };

    templateService = new TemplateService(mockLogger);

    // Set up default mocks
    vi.mocked(fsExtra.ensureDirSync).mockImplementation(() => {});
    vi.mocked(fsExtra.existsSync).mockReturnValue(true);
    vi.mocked(fsExtra.pathExists).mockResolvedValue(true as any);
    vi.mocked(fsExtra.readdir).mockResolvedValue([]);
    vi.mocked(fsExtra.readFile).mockResolvedValue(Buffer.from('{}'));
    vi.mocked(fsExtra.readJson).mockResolvedValue({});
    vi.mocked(fsExtra.stat).mockResolvedValue({ isDirectory: () => true } as any);
  });

  describe('initialization', () => {
    it('should initialize with template directory', () => {
      expect(templateService).toBeDefined();
      // Constructor creates user template directory
      expect(vi.mocked(fsExtra.ensureDirSync)).toHaveBeenCalledWith('/mock/path/userData/templates');
    });

    it('should handle missing template directory', async () => {
      vi.mocked(fsExtra.pathExists).mockResolvedValue(false);
      
      const service = new TemplateService(mockLogger);
      await service.initialize();
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Default templates path not found')
      );
    });
  });

  describe('initialize', () => {
    const mockTemplateStructure = {
      'default': {
        'base': {
          'metadata.json': JSON.stringify({
            id: 'base',
            name: 'Base Template',
            description: 'General purpose template',
            category: 'general',
            tags: ['general'],
            complexity: 'medium',
            useCase: 'General development',
            version: '1.0.0'
          }),
          'template.md': '# Base Template'
        },
        'bug-fix': {
          'metadata.json': JSON.stringify({
            id: 'bug-fix',
            name: 'Bug Fix Template',
            description: 'Template for bug fixes',
            category: 'maintenance',
            tags: ['bug', 'fix'],
            complexity: 'low',
            useCase: 'Bug fixing',
            variables: [
              {
                name: 'BUG_TYPE',
                type: 'enum',
                options: ['crash', 'ui', 'logic'],
                default: 'logic'
              }
            ]
          }),
          'template.md': '# Bug Fix Template'
        }
      },
      'examples': {
        'web-react': {
          'metadata.json': JSON.stringify({
            id: 'web-react',
            name: 'React Component',
            description: 'React component template',
            category: 'frontend',
            tags: ['react', 'typescript'],
            complexity: 'medium',
            useCase: 'React components',
            language: 'TypeScript',
            framework: 'React',
            variables: [
              {
                name: 'COMPONENT_NAME',
                type: 'string',
                required: true,
                pattern: '^[A-Z][a-zA-Z0-9]*$'
              }
            ]
          }),
          'template.md': '# React Component Template'
        }
      }
    };

    beforeEach(() => {
      
      // Mock pathExists
      vi.mocked(fsExtra.pathExists).mockResolvedValue(true as any);
      
      // Mock directory structure
      vi.mocked(fsExtra.readdir).mockImplementation(async (dir: any, options?: any) => {
        const pathParts = dir.split(path.sep);
        const lastPart = pathParts[pathParts.length - 1];
        
        if (options?.withFileTypes) {
          if (dir === mockTemplateDir || dir.includes('default')) {
            return [
              createDirent('base', true),
              createDirent('bug-fix', true)
            ] as any;
          } else if (dir.includes('userData')) {
            return [
              createDirent('web-react', true)
            ] as any;
          }
        } else {
          if (dir === mockTemplateDir || dir.includes('default')) {
            return ['base', 'bug-fix'];
          } else if (dir.includes('userData')) {
            return ['web-react'];
          }
        }
        return [];
      });

      // Mock readJson
      vi.mocked(fsExtra.readJson).mockImplementation(async (filePath: string) => {
        const pathStr = filePath.toString();
        
        if (pathStr.includes('base') && pathStr.endsWith('metadata.json')) {
          return JSON.parse(mockTemplateStructure.default.base['metadata.json']);
        } else if (pathStr.includes('bug-fix') && pathStr.endsWith('metadata.json')) {
          return JSON.parse(mockTemplateStructure.default['bug-fix']['metadata.json']);
        } else if (pathStr.includes('web-react') && pathStr.endsWith('metadata.json')) {
          return JSON.parse(mockTemplateStructure.examples['web-react']['metadata.json']);
        }
        
        throw new Error('File not found');
      });
    });

    it('should load all templates from directory structure', async () => {
      await templateService.initialize();
      const templates = templateService.getAllTemplates();

      expect(templates).toHaveLength(3);
      expect(templates.map(t => t.id)).toContain('base');
      expect(templates.map(t => t.id)).toContain('bug-fix');
      expect(templates.map(t => t.id)).toContain('web-react');
    });

    it('should parse template metadata correctly', async () => {
      await templateService.initialize();
      const result = await templateService.getTemplate('base');

      expect(result).toBeDefined();
      expect(result.metadata.name).toBe('Base Template');
      expect(result.metadata.category).toBe('general');
      expect(result.metadata.complexity).toBe('medium');
      expect(result.metadata.tags).toEqual(['general']);
    });

    it('should handle template variables', async () => {
      await templateService.initialize();
      const bugResult = await templateService.getTemplate('bug-fix');
      const reactResult = await templateService.getTemplate('web-react');

      expect(bugResult.metadata.variables).toBeDefined();
      expect(bugResult.metadata.variables).toHaveLength(1);
      expect(bugResult.metadata.variables?.[0].name).toBe('BUG_TYPE');
      expect(bugResult.metadata.variables?.[0].type).toBe('enum');

      expect(reactResult.metadata.variables).toBeDefined();
      expect(reactResult.metadata.variables?.[0].required).toBe(true);
      expect(reactResult.metadata.variables?.[0].pattern).toBeDefined();
    });

    it.skip('should set isCustom to false for built-in templates', async () => {
      await templateService.initialize();
      const templates = templateService.getAllTemplates();

      templates.forEach(template => {
        expect(template.isCustom).toBe(false);
      });
    });

    it.skip('should handle missing metadata.json gracefully', async () => {
      vi.mocked(fsExtra.pathExists).mockImplementation(async (path: string) => {
        if (path.includes('base') && path.endsWith('metadata.json')) {
          return false;
        }
        return true;
      });

      await templateService.initialize();
      const templates = templateService.getAllTemplates();

      expect(templates).toHaveLength(2); // bug-fix and web-react loaded
      expect(mockLogger.verbose).toHaveBeenCalledWith(
        expect.stringContaining('Scanning template directory')
      );
    });

    it.skip('should handle invalid JSON in metadata', async () => {
      vi.mocked(fsExtra.readJson).mockImplementation(async (filePath: string) => {
        if (filePath.toString().includes('base')) {
          throw new SyntaxError('Unexpected end of JSON input');
        }
        return JSON.parse(mockTemplateStructure.default['bug-fix']['metadata.json']);
      });

      await templateService.initialize();
      const templates = templateService.getAllTemplates();

      expect(templates).toHaveLength(2); // bug-fix and web-react loaded
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load template from')
      );
    });

    it.skip('should validate required metadata fields', async () => {
      vi.mocked(fsExtra.readFile).mockImplementation(async (filePath: any) => {
        if (filePath.toString().includes('base')) {
          // Missing required 'name' field
          return Buffer.from(JSON.stringify({
            id: 'base',
            description: 'Test',
            category: 'general'
          }));
        }
        return Buffer.from(mockTemplateStructure.default['bug-fix']['metadata.json']);
      });

      await templateService.initialize();
      const templates = templateService.getAllTemplates();

      expect(templates).toHaveLength(1); // Only bug-fix loaded
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Invalid template metadata')
      );
    });
  });

  describe('getTemplate', () => {
    beforeEach(async () => {
      
      // Mock pathExists
      vi.mocked(fsExtra.pathExists).mockResolvedValue(true as any);
      
      // Mock directory structure
      vi.mocked(fsExtra.readdir).mockImplementation(async (dir: any) => {
        return [
          createDirent('test-template', true)
        ] as any;
      });

      // Mock readJson
      vi.mocked(fsExtra.readJson).mockResolvedValue({
        id: 'test-template',
        name: 'Test Template',
        description: 'Test',
        category: 'test'
      });

      // Mock readFile for template content
      vi.mocked(fsExtra.readFile).mockResolvedValue(Buffer.from('# Test Template Content'));

      await templateService.initialize();
    });

    it('should return template by id', async () => {
      const result = await templateService.getTemplate('test-template');
      expect(result).toBeDefined();
      expect(result.metadata.id).toBe('test-template');
      expect(result.metadata.name).toBe('Test Template');
    });

    it('should return null for non-existent template', async () => {
      await expect(templateService.getTemplate('non-existent')).rejects.toThrow('Template non-existent not found');
    });

    it('should be case-sensitive', async () => {
      await expect(templateService.getTemplate('TEST-TEMPLATE')).rejects.toThrow('Template TEST-TEMPLATE not found');
    });
  });

  describe('getAllTemplates', () => {
    it('should return empty array before loading', () => {
      const templates = templateService.getAllTemplates();
      expect(templates).toEqual([]);
    });

    it.skip('should return all loaded templates', async () => {
      // Create a fresh instance for this test
      const freshService = new TemplateService(mockLogger);
      
      vi.mocked(fsExtra.pathExists).mockResolvedValue(true as any);
      vi.mocked(fsExtra.readdir).mockImplementation(async () => {
        return [
          createDirent('template1', true),
          createDirent('template2', true)
        ] as any;
      });

      let callCount = 0;
      vi.mocked(fsExtra.readJson).mockImplementation(async () => {
        callCount++;
        return {
          id: `template${callCount}`,
          name: `Template ${callCount}`,
          description: 'Test',
          category: 'test'
        };
      });

      await freshService.initialize();
      const templates = freshService.getAllTemplates();

      expect(templates).toHaveLength(2);
      expect(templates[0].id).toBe('template1');
      expect(templates[1].id).toBe('template2');
    });

    it('should return a copy of templates array', async () => {
      
      vi.mocked(fsExtra.pathExists).mockResolvedValue(true as any);
      vi.mocked(fsExtra.readdir).mockResolvedValue([
        createDirent('test', true)
      ] as any);
      vi.mocked(fsExtra.readJson).mockResolvedValue({
        id: 'test',
        name: 'Test',
        description: 'Test',
        category: 'test'
      } as any);

      await templateService.initialize();
      
      const templates1 = templateService.getAllTemplates();
      const templates2 = templateService.getAllTemplates();
      
      expect(templates1).not.toBe(templates2); // Different array instances
      expect(templates1).toEqual(templates2); // Same content
    });
  });

  describe('template path handling', () => {
    it.skip('should construct correct template paths', async () => {
      const readFileCalls: string[] = [];
      vi.mocked(fsExtra.readFile).mockImplementation(async (filePath: any) => {
        readFileCalls.push(filePath.toString());
        return Buffer.from(JSON.stringify({
          id: 'test',
          name: 'Test',
          description: 'Test',
          category: 'test'
        }));
      });

      vi.mocked(fsExtra.readdir).mockImplementation(async (dir: any) => {
        if (dir === mockTemplateDir) return ['category'] as any;
        return ['template'] as any;
      });

      vi.mocked(fsExtra.stat).mockResolvedValue({ isDirectory: () => true } as any);

      await templateService.initialize();

      expect(readFileCalls).toHaveLength(1);
      expect(readFileCalls[0]).toContain(path.join('category', 'template', 'metadata.json'));
    });

    it.skip('should store template directory path', async () => {
      vi.mocked(fsExtra.readdir).mockImplementation(async (dir: any) => {
        if (dir === mockTemplateDir) return ['cat'] as any;
        return ['temp'] as any;
      });

      vi.mocked(fsExtra.stat).mockResolvedValue({ isDirectory: () => true } as any);
      vi.mocked(fsExtra.readFile).mockResolvedValue(Buffer.from(JSON.stringify({
        id: 'test',
        name: 'Test',
        description: 'Test',
        category: 'test'
      })));

      await templateService.initialize();
      const templates = templateService.getAllTemplates();
      const template = templates.find(t => t.id === 'test');

      expect(template?.path).toBe(path.join(mockTemplateDir, 'cat', 'temp'));
      // Note: templatePath property doesn't exist in PRPTemplate type
      // expect(template?.templatePath).toBe(path.join(mockTemplateDir, 'cat', 'temp', 'template.md'));
    });
  });

  describe.skip('error recovery', () => {
    it('should continue loading other templates after error', async () => {
      // Create a fresh instance for this test
      const freshService = new TemplateService(mockLogger);
      
      vi.mocked(fsExtra.readdir).mockImplementation(async (dir: any) => {
        if (dir === mockTemplateDir) return ['default'] as any;
        return ['good-template', 'bad-template', 'another-good'] as any;
      });

      vi.mocked(fsExtra.stat).mockResolvedValue({ isDirectory: () => true } as any);

      vi.mocked(fsExtra.readFile).mockImplementation(async (filePath: any) => {
        const pathStr = filePath.toString();
        
        if (pathStr.includes('bad-template')) {
          throw new Error('Read error');
        }
        
        if (pathStr.includes('good-template')) {
          return Buffer.from(JSON.stringify({
            id: 'good-template',
            name: 'Good Template',
            description: 'Works',
            category: 'test'
          }));
        }
        
        return Buffer.from(JSON.stringify({
          id: 'another-good',
          name: 'Another Good',
          description: 'Also works',
          category: 'test'
        }));
      });

      await freshService.initialize();
      const templates = freshService.getAllTemplates();

      expect(templates).toHaveLength(2);
      expect(templates.map(t => t.id)).toContain('good-template');
      expect(templates.map(t => t.id)).toContain('another-good');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });
});