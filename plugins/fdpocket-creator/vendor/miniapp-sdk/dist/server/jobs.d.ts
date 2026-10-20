import { type JobScheduleRequest } from '@workspace/project-protocol';
export declare function createJobs(send: (path: string, body: unknown) => Promise<unknown>): {
    schedule(input: JobScheduleRequest): Promise<{
        id: string;
        status: "failed" | "pending" | "running" | "done" | "cancelled";
    }>;
    cancel(id: string): Promise<{
        cancelled: boolean;
    }>;
};
