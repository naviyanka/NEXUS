# Phase 02.5 — Execution Scheduler (MANDATORY INFRASTRUCTURE)

> **Read NEXUS-MASTER.md first** before working on this phase.

---

## Goal
Implement the central WinRM Command Scheduler. All remote operations in NEXUS must route through this layer to manage WinRM concurrency limits, quotas, and handle transient `WSManFault` errors gracefully.

---

## Scope
**In scope:**
- Backend: `WinRmCommandScheduler` service
- Backend: Quartz.NET job for scheduler heartbeat and queue processing
- Database: SQLite schema for `execution_queue` table
- Frontend: Per-machine throttle configuration UI
- SignalR: `scheduler.throttled`, `scheduler.queue_depth` events
- Tests: Unit tests for retry and backoff logic

---

## Prerequisites
- Phase 02 (WinRM Configuration)
- Phase 05 (Database Layer)
- Phase 09 (SignalR Event Bus)

---

## Detailed Tasks

### 1. SQLite Schema for Execution Queue

```sql
CREATE TABLE execution_queue (
    Id TEXT PRIMARY KEY,
    MachineId TEXT NOT NULL,
    PluginId TEXT NOT NULL,
    Command TEXT NOT NULL,
    Status TEXT NOT NULL, /* Queued, Running, Completed, Failed */
    CreatedAt DATETIME NOT NULL,
    StartedAt DATETIME,
    CompletedAt DATETIME,
    AttemptCount INTEGER NOT NULL DEFAULT 0,
    LastError TEXT
);
CREATE INDEX IDX_ExecutionQueue_MachineId ON execution_queue(MachineId);
CREATE INDEX IDX_ExecutionQueue_Status ON execution_queue(Status);
```

### 2. WinRmCommandScheduler Implementation

```csharp
public class WinRmCommandScheduler
{
    // Hard limits — do not exceed
    private const int MaxConcurrentPerMachine = 2;
    private const int GlobalThrottleLimit = 20;

    private readonly SemaphoreSlim _globalThrottle = new(GlobalThrottleLimit);
    private readonly ConcurrentDictionary<string, SemaphoreSlim> _perMachineLocks = new();
    private readonly Channel<ExecutionTask> _taskQueue = Channel.CreateUnbounded<ExecutionTask>();

    public async Task<ExecutionResult> EnqueueAsync(ExecutionTask task, CancellationToken ct)
    {
        var machineLock = _perMachineLocks.GetOrAdd(
            task.MachineId, _ => new SemaphoreSlim(MaxConcurrentPerMachine));

        await _globalThrottle.WaitAsync(ct);
        await machineLock.WaitAsync(ct);
        try
        {
            return await ExecuteWithRetryAsync(task, ct);
        }
        finally
        {
            machineLock.Release();
            _globalThrottle.Release();
        }
    }

    private async Task<ExecutionResult> ExecuteWithRetryAsync(
        ExecutionTask task, CancellationToken ct, int attempt = 0)
    {
        try
        {
            return await RunWinRmAsync(task, ct); // Inner call to actual PSRunspace execution
        }
        catch (PSRemotingTransportException ex)
            when (ex.Message.Contains("quota") || ex.Message.Contains("WSManFault"))
        {
            if (attempt >= 4) throw;
            var delay = TimeSpan.FromSeconds(Math.Pow(2, attempt)); // exponential backoff
            await Task.Delay(delay, ct);
            return await ExecuteWithRetryAsync(task, ct, attempt + 1);
        }
    }
    
    private Task<ExecutionResult> RunWinRmAsync(ExecutionTask task, CancellationToken ct) {
        // Core execution logic goes here...
        throw new NotImplementedException();
    }
}
```

### 3. Quartz.NET Scheduler Heartbeat

Implement a Quartz `IJob` that runs every 10 seconds to process the `execution_queue` table, emitting `scheduler.queue_depth` events via SignalR.

```csharp
public class ExecutionQueueProcessorJob : IJob
{
    public async Task Execute(IJobExecutionContext context)
    {
        // 1. Check queue depth
        // 2. Emit scheduler.queue_depth to UI
        // 3. Dequeue tasks and submit to WinRmCommandScheduler
    }
}
```

### 4. Admin Throttle Configuration UI

Create a Settings page component (`ui/components/ThrottleConfig.tsx`) that allows administrators to adjust `MaxConcurrentPerMachine` on a per-machine basis, overriding the default of 2.

### 5. SignalR Events

- `scheduler.throttled`: Emitted when a task is delayed due to semaphore locking.
- `scheduler.queue_depth`: Emitted periodically to update the UI on pending tasks.

---

## Test Criteria
- [ ] `WinRmCommandScheduler` respects `MaxConcurrentPerMachine` when concurrently bombarded with 10 tasks for the same machine.
- [ ] Simulated `WSManFault` triggers the exponential backoff retry logic and eventually succeeds or fails after 4 attempts.
