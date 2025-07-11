-- Rename PRD (Product Requirements Document) to PRP (Product Requirement Prompt)
-- This migration updates terminology throughout the database schema

-- First, rename the main table
ALTER TABLE product_requirements RENAME TO product_requirement_prompts;

-- Update the session_prd table to session_prp
ALTER TABLE session_prd RENAME TO session_prp;

-- Rename the foreign key column to match new terminology
ALTER TABLE session_prp RENAME COLUMN prd_id TO prp_id;
ALTER TABLE session_prp RENAME COLUMN prd_version TO prp_version;

-- Update indexes to reflect new table names
DROP INDEX IF EXISTS idx_prd_project;
DROP INDEX IF EXISTS idx_prd_active;

CREATE INDEX IF NOT EXISTS idx_prp_project ON product_requirement_prompts(project_id);
CREATE INDEX IF NOT EXISTS idx_prp_active ON product_requirement_prompts(project_id, is_active);