import { BaseAgent } from './agents/base.js';
import { Config } from './types/config.js';

export class Agent extends BaseAgent {
  constructor(config: Config) {
    super(config, config.prompts.system_prompt);
  }
} 