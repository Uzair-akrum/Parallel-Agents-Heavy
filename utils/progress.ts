export interface AgentProgress {
  id: string;
  name: string;
  status: 'idle' | 'running' | 'completed' | 'failed';
  progress: number; // 0-100
  message?: string;
}

export class ProgressDisplay {
  private agents: Map<string, AgentProgress> = new Map();
  private startTime: number = Date.now();
  private updateInterval: NodeJS.Timeout | null = null;
  private isActive = false;

  constructor() {
    // Hide cursor when showing progress
    process.stdout.write('\x1b[?25l');
  }

  addAgent(id: string, name: string): void {
    this.agents.set(id, {
      id,
      name,
      status: 'idle',
      progress: 0
    });
  }

  updateAgent(id: string, updates: Partial<AgentProgress>): void {
    const agent = this.agents.get(id);
    if (agent) {
      Object.assign(agent, updates);
    }
  }

  start(): void {
    this.isActive = true;
    this.startTime = Date.now();

    // Clear screen and position cursor
    console.clear();

    this.updateInterval = setInterval(() => {
      this.render();
    }, 100); // Update every 100ms for smooth animation
  }

  stop(): void {
    this.isActive = false;

    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    // Show cursor again
    process.stdout.write('\x1b[?25h');

    // Final render
    this.render();
    console.log(''); // Add final newline
  }

  private render(): void {
    if (!this.isActive) return;

    // Move cursor to top-left
    process.stdout.write('\x1b[H');

    // Header
    const elapsed = this.getElapsedTime();
    const status = this.getAllCompleted() ? 'COMPLETED' : 'RUNNING';
    const statusColor = status === 'COMPLETED' ? '\x1b[32m' : '\x1b[33m'; // Green or Yellow

    console.log(`\x1b[1m\x1b[36m4.1 HEAVY\x1b[0m`); // Bold Cyan
    console.log(`${statusColor}● ${status} ●\x1b[0m ${elapsed}`);
    console.log(''); // Empty line

    // Agent progress bars
    for (const agent of this.agents.values()) {
      this.renderAgentProgress(agent);
    }

    // Clear any remaining lines
    process.stdout.write('\x1b[J');
  }

  private renderAgentProgress(agent: AgentProgress): void {
    const statusSymbol = this.getStatusSymbol(agent.status);
    const statusColor = this.getStatusColor(agent.status);
    const progressBar = this.generateProgressBar(agent.progress, agent.status);

    console.log(`${statusColor}${agent.name} ${statusSymbol}\x1b[0m ${progressBar}`);
  }

  private getStatusSymbol(status: string): string {
    switch (status) {
      case 'idle': return '○';
      case 'running': return '●';
      case 'completed': return '✓';
      case 'failed': return '✗';
      default: return '○';
    }
  }

  private getStatusColor(status: string): string {
    switch (status) {
      case 'idle': return '\x1b[90m'; // Gray
      case 'running': return '\x1b[33m'; // Yellow
      case 'completed': return '\x1b[32m'; // Green
      case 'failed': return '\x1b[31m'; // Red
      default: return '\x1b[90m';
    }
  }

  private generateProgressBar(progress: number, status: string): string {
    const barWidth = 70;
    const filledWidth = Math.floor((progress / 100) * barWidth);

    if (status === 'running') {
      // Animated progress bar with moving pattern
      const animationFrame = Math.floor(Date.now() / 150) % 4;
      const patterns = [':', '·', ':', '·'];
      const pattern = patterns[animationFrame] || ':';
      return pattern.repeat(barWidth);
    } else if (status === 'completed') {
      return '█'.repeat(barWidth);
    } else if (status === 'failed') {
      return '░'.repeat(barWidth);
    } else {
      // Idle state
      return '─'.repeat(barWidth);
    }
  }

  private getElapsedTime(): string {
    const elapsed = Date.now() - this.startTime;
    const minutes = Math.floor(elapsed / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    return `${minutes}M${seconds.toString().padStart(2, '0')}S`;
  }

  private getAllCompleted(): boolean {
    return Array.from(this.agents.values()).every(
      agent => agent.status === 'completed' || agent.status === 'failed'
    );
  }
} 