/**
 * TodoParser - Parse and serialize todo.md-style execution plans
 * 
 * Format:
 * # Agent Plan: [Task Title]
 * 
 * ## Phase 1: Research
 * - [x] Completed task
 * - [ ] Pending task
 * - [~] In progress task
 * - [!] Blocked task
 */

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'blocked';
export type PhaseStatus = 'pending' | 'active' | 'completed';

export interface Task {
  id: string;
  description: string;
  status: TaskStatus;
  tool?: string;
  dependencies?: string[];
  startedAt?: Date;
  completedAt?: Date;
  duration?: number;
}

export interface Phase {
  id: string;
  name: string;
  number: number;
  tasks: Task[];
  status: PhaseStatus;
  startedAt?: Date;
  completedAt?: Date;
  duration?: number;
}

export interface TodoPlan {
  title: string;
  phases: Phase[];
  currentPhase: number;
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  blockedTasks: number;
  createdAt?: Date;
  updatedAt?: Date;
}

// Task status markers in markdown
const STATUS_MARKERS: Record<string, TaskStatus> = {
  'x': 'completed',
  ' ': 'pending',
  '~': 'in_progress',
  '!': 'blocked',
};

const REVERSE_MARKERS: Record<TaskStatus, string> = {
  'completed': 'x',
  'pending': ' ',
  'in_progress': '~',
  'blocked': '!',
};

export class TodoParser {
  /**
   * Parse a todo.md markdown string into a TodoPlan object
   */
  parse(markdown: string): TodoPlan {
    const lines = markdown.split('\n');
    const phases: Phase[] = [];
    let title = 'Untitled Plan';
    let currentPhase: Phase | null = null;
    let phaseNumber = 0;

    for (const line of lines) {
      // Parse title
      if (line.startsWith('# ')) {
        const titleMatch = line.match(/^#\s*(?:Agent Plan:\s*)?(.+)$/);
        if (titleMatch) {
          title = titleMatch[1].trim();
        }
        continue;
      }

      // Parse phase header
      if (line.startsWith('## ')) {
        if (currentPhase) {
          phases.push(currentPhase);
        }
        
        phaseNumber++;
        const phaseMatch = line.match(/^##\s*(?:Phase\s*\d+:\s*)?(.+)$/);
        const phaseName = phaseMatch ? phaseMatch[1].trim() : `Phase ${phaseNumber}`;
        
        currentPhase = {
          id: `phase-${phaseNumber}`,
          name: phaseName,
          number: phaseNumber,
          tasks: [],
          status: 'pending',
        };
        continue;
      }

      // Parse task
      const taskMatch = line.match(/^-\s*\[([x ~!])\]\s*(.+)$/i);
      if (taskMatch && currentPhase) {
        const statusMarker = taskMatch[1].toLowerCase();
        const description = taskMatch[2].trim();
        
        // Extract tool hint from description (format: "Description @tool_name")
        const toolMatch = description.match(/@(\w+(?:\.\w+)?)/);
        const tool = toolMatch ? toolMatch[1] : undefined;
        const cleanDescription = description.replace(/@\w+(?:\.\w+)?/, '').trim();
        
        // Extract dependencies (format: "Description [depends: task-1, task-2]")
        const depsMatch = description.match(/\[depends:\s*([^\]]+)\]/);
        const dependencies = depsMatch 
          ? depsMatch[1].split(',').map(d => d.trim())
          : undefined;
        const finalDescription = cleanDescription.replace(/\[depends:[^\]]+\]/, '').trim();

        const task: Task = {
          id: `${currentPhase.id}-task-${currentPhase.tasks.length + 1}`,
          description: finalDescription,
          status: STATUS_MARKERS[statusMarker] || 'pending',
          tool,
          dependencies,
        };

        currentPhase.tasks.push(task);
      }
    }

    // Add last phase
    if (currentPhase) {
      phases.push(currentPhase);
    }

    // Calculate phase statuses
    for (const phase of phases) {
      phase.status = this.calculatePhaseStatus(phase);
    }

    // Find current phase
    const activePhaseIndex = phases.findIndex(p => p.status === 'active');
    const currentPhaseNumber = activePhaseIndex >= 0 
      ? activePhaseIndex + 1 
      : phases.findIndex(p => p.status === 'pending') + 1 || phases.length;

    // Calculate totals
    const allTasks = phases.flatMap(p => p.tasks);
    const completedTasks = allTasks.filter(t => t.status === 'completed').length;
    const inProgressTasks = allTasks.filter(t => t.status === 'in_progress').length;
    const blockedTasks = allTasks.filter(t => t.status === 'blocked').length;

    return {
      title,
      phases,
      currentPhase: currentPhaseNumber,
      totalTasks: allTasks.length,
      completedTasks,
      inProgressTasks,
      blockedTasks,
    };
  }

  /**
   * Serialize a TodoPlan object back to markdown
   */
  serialize(plan: TodoPlan): string {
    const lines: string[] = [];

    // Title
    lines.push(`# Agent Plan: ${plan.title}`);
    lines.push('');

    // Phases and tasks
    for (const phase of plan.phases) {
      lines.push(`## Phase ${phase.number}: ${phase.name}`);
      
      for (const task of phase.tasks) {
        const marker = REVERSE_MARKERS[task.status];
        let taskLine = `- [${marker}] ${task.description}`;
        
        if (task.tool) {
          taskLine += ` @${task.tool}`;
        }
        
        if (task.dependencies && task.dependencies.length > 0) {
          taskLine += ` [depends: ${task.dependencies.join(', ')}]`;
        }
        
        lines.push(taskLine);
      }
      
      lines.push('');
    }

    return lines.join('\n').trim();
  }

  /**
   * Update a specific task's status
   */
  updateTask(plan: TodoPlan, taskId: string, status: TaskStatus): TodoPlan {
    const newPlan = JSON.parse(JSON.stringify(plan)) as TodoPlan;
    
    for (const phase of newPlan.phases) {
      const taskIndex = phase.tasks.findIndex(t => t.id === taskId);
      if (taskIndex >= 0) {
        const task = phase.tasks[taskIndex];
        const previousStatus = task.status;
        task.status = status;
        
        // Update timestamps
        if (status === 'in_progress' && previousStatus !== 'in_progress') {
          task.startedAt = new Date();
        } else if (status === 'completed' && previousStatus !== 'completed') {
          task.completedAt = new Date();
          if (task.startedAt) {
            task.duration = Date.now() - new Date(task.startedAt).getTime();
          }
        }
        
        // Recalculate phase status
        phase.status = this.calculatePhaseStatus(phase);
        break;
      }
    }

    // Recalculate totals
    const allTasks = newPlan.phases.flatMap(p => p.tasks);
    newPlan.completedTasks = allTasks.filter(t => t.status === 'completed').length;
    newPlan.inProgressTasks = allTasks.filter(t => t.status === 'in_progress').length;
    newPlan.blockedTasks = allTasks.filter(t => t.status === 'blocked').length;
    newPlan.updatedAt = new Date();

    // Update current phase
    const activePhaseIndex = newPlan.phases.findIndex(p => p.status === 'active');
    newPlan.currentPhase = activePhaseIndex >= 0 
      ? activePhaseIndex + 1 
      : newPlan.phases.findIndex(p => p.status === 'pending') + 1 || newPlan.phases.length;

    return newPlan;
  }

  /**
   * Advance to the next phase
   */
  advancePhase(plan: TodoPlan): TodoPlan {
    const newPlan = JSON.parse(JSON.stringify(plan)) as TodoPlan;
    
    const currentPhaseIndex = newPlan.currentPhase - 1;
    const currentPhase = newPlan.phases[currentPhaseIndex];
    
    if (currentPhase) {
      // Mark all pending tasks as completed
      for (const task of currentPhase.tasks) {
        if (task.status === 'pending' || task.status === 'in_progress') {
          task.status = 'completed';
          task.completedAt = new Date();
        }
      }
      currentPhase.status = 'completed';
      currentPhase.completedAt = new Date();
    }

    // Activate next phase
    if (currentPhaseIndex + 1 < newPlan.phases.length) {
      const nextPhase = newPlan.phases[currentPhaseIndex + 1];
      nextPhase.status = 'active';
      nextPhase.startedAt = new Date();
      newPlan.currentPhase = currentPhaseIndex + 2;
    }

    // Recalculate totals
    const allTasks = newPlan.phases.flatMap(p => p.tasks);
    newPlan.completedTasks = allTasks.filter(t => t.status === 'completed').length;
    newPlan.inProgressTasks = allTasks.filter(t => t.status === 'in_progress').length;
    newPlan.blockedTasks = allTasks.filter(t => t.status === 'blocked').length;
    newPlan.updatedAt = new Date();

    return newPlan;
  }

  /**
   * Mark a task as completed and advance if needed
   */
  completeTask(plan: TodoPlan, taskId: string, notes?: string): TodoPlan {
    let newPlan = this.updateTask(plan, taskId, 'completed');
    
    // Check if current phase is complete
    const currentPhase = newPlan.phases[newPlan.currentPhase - 1];
    if (currentPhase && this.isPhaseComplete(currentPhase)) {
      currentPhase.status = 'completed';
      currentPhase.completedAt = new Date();
      
      // Auto-advance to next phase if available
      if (newPlan.currentPhase < newPlan.phases.length) {
        const nextPhase = newPlan.phases[newPlan.currentPhase];
        nextPhase.status = 'active';
        nextPhase.startedAt = new Date();
        newPlan.currentPhase++;
      }
    }

    return newPlan;
  }

  /**
   * Create a new plan from a template
   */
  createPlan(title: string, phases: Array<{ name: string; tasks: string[] }>): TodoPlan {
    const parsedPhases: Phase[] = phases.map((p, i) => ({
      id: `phase-${i + 1}`,
      name: p.name,
      number: i + 1,
      tasks: p.tasks.map((t, j) => ({
        id: `phase-${i + 1}-task-${j + 1}`,
        description: t,
        status: 'pending' as TaskStatus,
      })),
      status: i === 0 ? 'active' as PhaseStatus : 'pending' as PhaseStatus,
      startedAt: i === 0 ? new Date() : undefined,
    }));

    const totalTasks = parsedPhases.reduce((sum, p) => sum + p.tasks.length, 0);

    return {
      title,
      phases: parsedPhases,
      currentPhase: 1,
      totalTasks,
      completedTasks: 0,
      inProgressTasks: 0,
      blockedTasks: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Get the next pending task in the current phase
   */
  getNextTask(plan: TodoPlan): Task | null {
    const currentPhase = plan.phases[plan.currentPhase - 1];
    if (!currentPhase) return null;
    
    return currentPhase.tasks.find(t => 
      t.status === 'pending' || t.status === 'in_progress'
    ) || null;
  }

  /**
   * Calculate progress percentage
   */
  getProgress(plan: TodoPlan): number {
    if (plan.totalTasks === 0) return 0;
    return Math.round((plan.completedTasks / plan.totalTasks) * 100);
  }

  private calculatePhaseStatus(phase: Phase): PhaseStatus {
    const tasks = phase.tasks;
    if (tasks.length === 0) return 'pending';
    
    const allCompleted = tasks.every(t => t.status === 'completed');
    if (allCompleted) return 'completed';
    
    const anyInProgress = tasks.some(t => t.status === 'in_progress');
    const anyCompleted = tasks.some(t => t.status === 'completed');
    if (anyInProgress || anyCompleted) return 'active';
    
    return 'pending';
  }

  private isPhaseComplete(phase: Phase): boolean {
    return phase.tasks.every(t => t.status === 'completed');
  }
}

// Export singleton instance
export const todoParser = new TodoParser();
