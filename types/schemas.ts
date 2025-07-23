import { randomUUID } from 'crypto';

export interface ResearchQuery {
  query: string;
  max_subagents?: number; // Default 3, min 1, max 10
  max_iterations?: number; // Default 5, min 1, max 20
}

export interface SubAgentTask {
  task_id: string;
  objective: string;
  search_focus: string;
  expected_output_format: string;
  max_searches?: number; // Default 5
  status: 'pending' | 'running' | 'completed' | 'failed';
}

export interface SearchResult {
  url: string;
  title: string;
  snippet: string;
  content?: string;
  relevance_score: number; // 0-1
}

export interface SubAgentResult {
  task_id: string;
  findings: Record<string, any>[];
  sources: SearchResult[];
  summary: string;
  token_count: number;
}

export interface ResearchPlan {
  plan_id: string;
  strategy: string;
  subtasks: SubAgentTask[];
  estimated_complexity: 'simple' | 'moderate' | 'complex';
}

export interface ResearchResult {
  research_id: string;
  query: string;
  report: string;
  citations: Record<string, any>[];
  sources_used: SearchResult[];
  total_tokens_used: number;
  execution_time: number;
}

export interface Citation {
  id: string;
  url: string;
  title: string;
  snippet: string;
  relevance: number;
}

export interface FollowUpTask {
  task_id: string;
  reason: string;
  additional_queries: string[];
  focus_areas: string[];
}

export interface ResearchContext {
  research_id: string;
  query: string;
  plan: ResearchPlan;
  completed_tasks: SubAgentResult[];
  pending_tasks: SubAgentTask[];
  iteration_count: number;
  total_tokens_used: number;
  start_time: number;
}

// Utility function to generate UUIDs
export const generateTaskId = () => randomUUID();
export const generateResearchId = () => randomUUID(); 