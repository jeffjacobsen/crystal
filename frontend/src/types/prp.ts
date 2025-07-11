export interface ProductRequirementPrompt {
  id: number;
  project_id: number;
  title: string;
  content: string;
  version: number;
  created_at: string;
  updated_at: string;
}

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
  tags?: string[];
  language?: string;
  framework?: string;
  complexity: 'low' | 'medium' | 'high';
  useCase: string;
  author?: string;
  version?: string;
  isCustom?: boolean;  // Distinguishes user templates
  path?: string;       // Full path to template directory
  variables?: TemplateVariable[];
  
  // Legacy field for backward compatibility
  file?: string;
}

export interface PRPValidationIssue {
  type: 'warning' | 'error';
  message: string;
  line?: number;
  column?: number;
}

export interface PRPGenerationRequest {
  templateId: string;
  featureRequest: string;
  codebasePath?: string;  // Optional path to existing codebase
  variables?: Record<string, any>;  // User-provided variable values
}

export interface PRPGenerationResponse {
  content: string;
  templateUsed: string;
  generatedAt: string;
}