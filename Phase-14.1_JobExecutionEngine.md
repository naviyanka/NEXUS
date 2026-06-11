# Phase 14.1 — Job Execution Engine

> **Read NEXUS-MASTER.md first** before working on this phase.

---

## Goal
Establish a robust asynchronous Job Execution Model for long-running remote operations (e.g., patching, SP upgrades). This prevents WinRM session timeouts and blocked UI threads by moving heavy work into trackable, async jobs.

---

## Scope
**In scope:**
- Backend: `NexusJob` EF Core Entity
- Backend: `JobService` implementation
- Logging: Remote `C:\NexusJobs\<jobId>.log` convention
- SignalR: Job lifecycle events (`job.started`, `job.progress`, etc.)
- Frontend: `JobStatusBadge` and `JobOutputDrawer` components

---

## Prerequisites
- Phase 02.5 (Execution Scheduler)
- Phase 05 (Database)
- Phase 09 (SignalR)

---

## Detailed Tasks

### 1. NexusJob Entity and Schema

```csharp
public class NexusJob
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string MachineId { get; set; }
    public string PluginId { get; set; }
    public JobStatus Status { get; set; } = JobStatus.Queued;
    public string Command { get; set; }
    public string? OutputPath { get; set; }          // C:\NexusJobs\<jobId>.log
    public string? ErrorSummary { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? StartedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
    public int ProgressPercent { get; set; }
}

public enum JobStatus { Queued, Running, Completed, Failed, Cancelled, TimedOut }
```

### 2. Execution Pattern (Start-Job vs Scheduled Task)

All long-running tasks should use PowerShell's `Start-Job` and redirect output to a local file on the target server. 
**Remote execution stub:**
```powershell
$outputDir = "C:\NexusJobs"
$outputFile = Join-Path $outputDir "$jobId.log"
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

Start-Job -ScriptBlock {
    # long running work
} | Out-File -FilePath $using:outputFile
```

### 3. SignalR Job Events

```
job.started    → { jobId, machineId, pluginId, startedAt }
job.progress   → { jobId, progressPercent, currentStep }
job.completed  → { jobId, durationMs, outputPath }
job.failed     → { jobId, errorSummary, failedAt }
```

### 4. UI Components
- **JobStatusBadge**: A global component in the React top bar showing active jobs.
- **JobOutputDrawer**: A slide-out panel that streams or reads the remote log file for a specific job.

---

## Test Criteria
- [ ] Submitting a 5-minute simulated sleep command returns a Job ID immediately.
- [ ] The `JobStatusBadge` shows the job as Running and updates its progress via SignalR.
- [ ] Checking the target machine confirms `C:\NexusJobs\<jobId>.log` exists.
