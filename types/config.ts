export interface OpenRouterConfig {
  api_key: string;
  base_url: string;
  model: string;
}

export interface AgentConfig {
  max_iterations: number;
  max_execution_time: number;
  temperature: number;
}

export interface OrchestratorConfig {
  max_agents: number;
  synthesis_model: string;
}

export interface ToolsConfig {
  search: {
    max_results: number;
    timeout: number;
  };
  calculator: {
    precision: number;
  };
}

export interface InputConfig {
  type: 'input' | 'text' | 'editor';
  max_length: number;
  multiline: boolean;
  editor_command?: string;
}

export interface PromptsConfig {
  system_prompt: string;
  orchestrator_prompt: string;
  synthesis_prompt: string;
}

export interface Config {
  openrouter: OpenRouterConfig;
  agent: AgentConfig;
  orchestrator: OrchestratorConfig;
  tools: ToolsConfig;
  input: InputConfig;
  prompts: PromptsConfig;
} 