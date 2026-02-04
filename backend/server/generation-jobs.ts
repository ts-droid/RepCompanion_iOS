
export interface GenerationJob {
  id: string;
  userId: string;
  status: 'queued' | 'generating' | 'completed' | 'failed';
  progress: number;
  result?: any;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

// In-memory job store
const jobs = new Map<string, GenerationJob>();

export const JobManager = {
  createJob(userId: string): GenerationJob {
    const id = `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const job: GenerationJob = {
      id,
      userId,
      status: 'queued',
      progress: 0,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    jobs.set(id, job);
    return job;
  },

  getJob(id: string): GenerationJob | undefined {
    return jobs.get(id);
  },

  getUserActiveJob(userId: string): GenerationJob | undefined {
    return Array.from(jobs.values()).find(
      (job) => job.userId === userId && (job.status === 'queued' || job.status === 'generating')
    );
  },

  updateJob(id: string, updates: Partial<Omit<GenerationJob, 'id' | 'userId' | 'createdAt'>>): GenerationJob | undefined {
    const job = jobs.get(id);
    if (!job) return undefined;

    const updatedJob = {
      ...job,
      ...updates,
      updatedAt: Date.now()
    };
    jobs.set(id, updatedJob);
    return updatedJob;
  },

  cleanupOldJobs(maxAgeMs = 24 * 60 * 60 * 1000) {
    const now = Date.now();
    for (const [id, job] of Array.from(jobs.entries())) {
      if (now - job.createdAt > maxAgeMs) {
        jobs.delete(id);
      }
    }
  }
};
