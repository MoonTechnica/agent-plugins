import { type JobScheduleRequest } from '@workspace/project-protocol';
export declare function createJobs(send: (path: string, body: unknown) => Promise<unknown>): {
    schedule(input: JobScheduleRequest): Promise<{
        id: string;
        status: "done" | "running" | "failed" | "cancelled" | "pending";
    }>;
    cancel(id: string): Promise<{
        cancelled: boolean;
    }>;
};
