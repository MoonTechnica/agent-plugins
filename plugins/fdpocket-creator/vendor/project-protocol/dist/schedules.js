import { Cron, CronPattern } from 'croner';
const options = { timezone: 'UTC', paused: true, mode: '5-part' };
/** Timers are never started: this is the common UTC parser for validation and dispatch. */
export function nextSchedule(expression, after) {
    const next = new Cron(expression, options).nextRun(after);
    if (!next)
        throw new Error('schedule has no future execution');
    return next;
}
/** Five-field UTC cron with a minimum five-minute distance between all executions. */
export function validateSchedule(expression) {
    const fields = expression.trim().split(/\s+/);
    if (fields.length !== 5 || fields.slice(0, 2).some((field) => !/^[0-9*/,-]+$/.test(field)))
        return false;
    try {
        const pattern = new CronPattern(expression, 'UTC', { mode: '5-part' });
        const times = [];
        for (let hour = 0; hour < 24; hour++) {
            if (!pattern.hour[hour])
                continue;
            for (let minute = 0; minute < 60; minute++)
                if (pattern.minute[minute])
                    times.push(hour * 60 + minute);
        }
        if (!times.length || times.some((time, i) => i > 0 && time - (times[i - 1] ?? 0) < 5))
            return false;
        // Only midnight can cross calendar days. Gregorian dates repeat every 400 years;
        // enumerate matching days only if the clock part could cross that boundary too quickly.
        if (1440 - (times.at(-1) ?? 0) + (times[0] ?? 0) < 5) {
            const days = new Cron(`0 0 ${fields.slice(2).join(' ')}`, options);
            let previous = days.nextRun(new Date('1999-12-31T23:59:59Z'));
            const end = Date.parse('2400-01-01T00:00:00Z');
            while (previous && previous.getTime() < end) {
                const next = days.nextRun(previous);
                if (next && next.getTime() - previous.getTime() === 86_400_000)
                    return false;
                previous = next;
            }
        }
        return new Cron(expression, options).nextRun(new Date('2000-01-01T00:00:00Z')) !== null;
    }
    catch {
        // A malformed expression is invalid user input, never a runtime scheduling failure.
        return false;
    }
}
