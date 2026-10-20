/** Timers are never started: this is the common UTC parser for validation and dispatch. */
export declare function nextSchedule(expression: string, after: Date): Date;
/** Five-field UTC cron with a minimum five-minute distance between all executions. */
export declare function validateSchedule(expression: string): boolean;
