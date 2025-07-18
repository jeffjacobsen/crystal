import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PRPGenerationService } from '../prpGenerationService';
import { TemplateService } from '../templateService';
import { DatabaseService } from '../../database/database';
import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock dependencies
vi.mock('../templateService');
vi.mock('../../database/database');
vi.mock('fs/promises');

// Mock child_process with proper hoisting
vi.mock('child_process', () => {
  const mockChildProcess = {
    stdout: {
      on: vi.fn(),
      setEncoding: vi.fn()
    },
    stderr: {
      on: vi.fn(),
      setEncoding: vi.fn()
    },
    stdin: {
      write: vi.fn(),
      end: vi.fn()
    },
    on: vi.fn(),
    kill: vi.fn()
  };
  
  return {
    spawn: vi.fn().mockReturnValue(mockChildProcess)
  };
});

vi.mock('../../utils/shellPath', () => ({
  getShellPath: vi.fn().mockReturnValue('/usr/bin:/usr/local/bin'),
  findExecutableInPath: vi.fn().mockResolvedValue('/usr/local/bin/claude-code')
}));

describe('PRPGenerationService', () => {
  let prpService: PRPGenerationService;
  let mockTemplateService: any;
  let mockDatabase: any;
  let mockLogger: any;
  let mockEmitter: EventEmitter;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Create mock instances
    mockEmitter = new EventEmitter();
    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      verbose: vi.fn(),
      warn: vi.fn()
    };

    mockTemplateService = {
      getTemplate: vi.fn(),
      getTemplates: vi.fn()
    };

    mockDatabase = {
      addPromptMarker: vi.fn(),
      updatePromptMarkerCompletion: vi.fn()
    };

    // Initialize service
    prpService = new PRPGenerationService(
      mockTemplateService as any,
      mockLogger
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('generateFromTemplate', () => {
    beforeEach(() => {
      // Set up default template - getTemplate returns both metadata and template content
      const templateMetadata = {
        id: 'test-template',
        name: 'Test Template',
        templatePath: '/templates/test/template.md',
        generatePath: '/templates/test/generate.md',
        variables: [
          {
            name: 'COMPONENT_NAME',
            type: 'string',
            description: 'Component name',
            required: true,
            pattern: '^[A-Z][a-zA-Z]*$'
          },
          {
            name: 'USE_HOOKS',
            type: 'boolean',
            description: 'Use React hooks',
            default: false
          },
          {
            name: 'COMPONENT_TYPE',
            type: 'string',
            description: 'Component type',
            default: 'page',
            options: ['page', 'component', 'layout']
          }
        ]
      };
      
      // Mock template content
      const templateContent = `# Test Template

## Instructions
Research the codebase to understand patterns.

## PRP Generation
<template>
# Product Requirement Prompt

Component: {{COMPONENT_NAME}}
Type: {{COMPONENT_TYPE}}

{{#USE_HOOKS}}
This component will use React hooks.
{{/USE_HOOKS}}

{{^USE_HOOKS}}
This component will use class-based structure.
{{/USE_HOOKS}}

## Requirements
Build a {{COMPONENT_TYPE}} component named {{COMPONENT_NAME}}.
</template>`;

      // Mock returns both metadata and template content
      mockTemplateService.getTemplate.mockResolvedValue({
        metadata: templateMetadata,
        template: templateContent
      });

      // Mock file system (no longer needed for these tests)
      vi.mocked(fs.readFile).mockResolvedValue(Buffer.from(''));
    });

    it('should generate PRP with basic variable substitution', async () => {
      const result = await prpService.generateFromTemplate({
        templateId: 'test-template',
        featureRequest: 'Create a user profile component',
        codebasePath: '/project/src',
        variables: {
          COMPONENT_NAME: 'UserProfile',
          USE_HOOKS: true,
          COMPONENT_TYPE: 'page'
        },
        useClaudeGeneration: false, // Disable Claude generation for this test
        sessionId: 'test-session',
      });

      expect(result).toBeDefined();
      expect(result.content).toContain('Component: UserProfile');
      expect(result.content).toContain('Type: page');
      expect(result.content).toContain('This component will use React hooks.');
      expect(result.content).not.toContain('class-based structure');
    });

    it('should use default values for missing variables', async () => {
      const result = await prpService.generateFromTemplate({
        templateId: 'test-template',
        featureRequest: 'Create a component',
        variables: {
          COMPONENT_NAME: 'TestComponent'
          // USE_HOOKS and COMPONENT_TYPE not provided
        },
        useClaudeGeneration: false,
        sessionId: 'test-session',
      });

      expect(result).toBeDefined();
      expect(result.content).toContain('Type: page'); // default
      expect(result.content).toContain('class-based structure'); // default false
    });

    it('should validate required variables', async () => {
      await expect(prpService.generateFromTemplate({
        templateId: 'test-template',
        featureRequest: 'Create a component',
        variables: {
          // COMPONENT_NAME is required but not provided
          USE_HOOKS: true
        },
        useClaudeGeneration: false,
        sessionId: 'test-session',
      })).rejects.toThrow('Missing required variable: COMPONENT_NAME');
    });

    it('should validate string patterns', async () => {
      await expect(prpService.generateFromTemplate({
        templateId: 'test-template',
        featureRequest: 'Create a component',
        variables: {
          COMPONENT_NAME: 'user-profile', // Invalid pattern (should start with uppercase)
          USE_HOOKS: true
        },
        useClaudeGeneration: false,
        sessionId: 'test-session',
      })).rejects.toThrow('Invalid value for COMPONENT_NAME');
    });

    it('should validate enum values', async () => {
      await expect(prpService.generateFromTemplate({
        templateId: 'test-template',
        featureRequest: 'Create a component',
        variables: {
          COMPONENT_NAME: 'TestComponent',
          COMPONENT_TYPE: 'invalid-type' // Not in enum options
        },
        useClaudeGeneration: false,
        sessionId: 'test-session',
      })).rejects.toThrow('Invalid value for COMPONENT_TYPE');
    });

    it('should handle template not found', async () => {
      mockTemplateService.getTemplate.mockRejectedValue(
        new Error('Template non-existent not found')
      );

      await expect(prpService.generateFromTemplate({
        templateId: 'non-existent',
        featureRequest: 'Test',
        useClaudeGeneration: false,
        sessionId: 'test-session',
      })).rejects.toThrow('Template non-existent not found');
    });

  });

  describe('generateWithClaude', () => {
    it('should handle Claude generation when enabled', async () => {
      mockTemplateService.getTemplate.mockResolvedValue({
        metadata: {
          id: 'test',
          name: 'Test Template',
          templatePath: '/test/template.md'
        },
        template: `# Template
<template>
# PRP for $FEATURE_REQUEST
</template>`
      });

      // No need to mock fs.readFile - template content is provided by getTemplate mock

      // Mock Claude generation (would normally spawn a process)
      const mockGeneratedContent = '# Generated PRP\n\nDetailed requirements...';
      
      // For this test, we'll simulate the Claude generation by mocking the internal method
      vi.spyOn(prpService as any, 'enhanceWithClaude').mockResolvedValue(mockGeneratedContent);

      const result = await prpService.generateFromTemplate({
        templateId: 'test',
        featureRequest: 'Build a dashboard',
        useClaudeGeneration: true,
        sessionId: 'test-session',
      });

      expect(result).toBeDefined();
      expect(result.content).toBe(mockGeneratedContent);
    });
  });

  describe('variable substitution', () => {
    it('should handle complex conditional sections', async () => {
      const complexTemplateContent = `<template>
{{#FEATURE_A}}
Feature A is enabled
{{#FEATURE_B}}
Both A and B are enabled
{{/FEATURE_B}}
{{^FEATURE_B}}
Only A is enabled
{{/FEATURE_B}}
{{/FEATURE_A}}
{{^FEATURE_A}}
Feature A is disabled
{{/FEATURE_A}}
</template>`;

      mockTemplateService.getTemplate.mockResolvedValue({
        metadata: {
          id: 'complex',
          name: 'Complex Template',
          templatePath: '/test/complex.md',
          variables: [
            { name: 'FEATURE_A', type: 'boolean', default: false },
            { name: 'FEATURE_B', type: 'boolean', default: false }
          ]
        },
        template: complexTemplateContent
      });

      // Test with both features enabled
      let result = await prpService.generateFromTemplate({
        templateId: 'complex',
        featureRequest: 'Test',
        variables: { FEATURE_A: true, FEATURE_B: true },
        useClaudeGeneration: false,
        sessionId: 'test-session',
      });

      expect(result.content).toContain('Both A and B are enabled');
      expect(result.content).not.toContain('Only A is enabled');
      expect(result.content).not.toContain('Feature A is disabled');

      // Test with only A enabled
      result = await prpService.generateFromTemplate({
        templateId: 'complex',
        featureRequest: 'Test',
        variables: { FEATURE_A: true, FEATURE_B: false },
        useClaudeGeneration: false,
        sessionId: 'test-session',
      });

      expect(result.content).toContain('Only A is enabled');
      expect(result.content).not.toContain('Both A and B are enabled');

      // Test with both disabled
      result = await prpService.generateFromTemplate({
        templateId: 'complex',
        featureRequest: 'Test',
        variables: { FEATURE_A: false, FEATURE_B: false },
        useClaudeGeneration: false,
        sessionId: 'test-session',
      });

      expect(result.content).toContain('Feature A is disabled');
      expect(result.content).not.toContain('enabled');
    });
  });
});