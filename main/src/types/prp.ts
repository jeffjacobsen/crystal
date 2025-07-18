export interface TemplateVariable {
  name: string;
  description: string;
  type: 'string' | 'boolean' | 'number' | 'enum';
  required: boolean;
  default?: string | boolean | number;
  pattern?: string;
  options?: string[];  // For enum type
}

export interface PRPTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  language?: string;
  framework?: string;
  complexity: 'low' | 'medium' | 'high';
  useCase: string;
  author?: string;
  version: string;
  isCustom: boolean;  // Distinguishes user templates
  path: string;       // Full path to template directory
  variables?: TemplateVariable[];
  
  // Legacy field for backward compatibility
  file?: string;
}

export interface PRPGenerationRequest {
  templateId: string;
  featureRequest: string;
  sessionId?: string;  // Optional session ID for context
  codebasePath?: string;  // Optional path to existing codebase
  variables?: Record<string, any>;  // User-provided variable values
  useClaudeGeneration?: boolean;  // Whether to enhance template with Claude
}