# Phase 14 — Machine & Group Management (Full-Stack CRUD + UI)

> **Read NEXUS-MASTER.md first** before working on this phase.

---

## Goal
Build the complete machine and group management experience — the first full-stack feature in NEXUS. Backend: persistent machine/group storage in SQLite (superseding the read-only YAML config from Phase 2), full CRUD APIs, bulk operations, and credential assignment. Frontend: machine list page with card/table views, group management panel, machine detail panel with live metrics, search/filter/sort controls, and bulk operations bar. This phase is the foundation that every subsequent plugin phase (15+) depends on.

---

## Context: What is NEXUS?
NEXUS manages all domain machines without installing any software on them. Phase 2 built the connection engine and a basic read-only `MachinesController` that reads machine definitions from `config/machines.yaml`. Phase 14 upgrades this to a full management layer: machines and groups are stored in SQLite for CRUD, the YAML file becomes a one-time seed on first run, and the frontend gets a rich UI for viewing, organizing, and operating on machines.

---

## Scope

> ⚙️ **Architecture Constraint**: All remote operations use WinRM/CIM exclusively.
> No agents, binaries, or persistent services may be deployed to target machines.
> All PowerShell executed remotely must be signed scripts or inline commands passed
> through the WinRmCommandScheduler service (see Phase-02.5).
**In scope:**
- Database entities: `machines`, `machine_groups`, `machine_group_members` tables
- EF Core migration (adds to Phase 5 schema)
- `IMachineManagementService` — full CRUD for machines and groups
- First-run import from `config/machines.yaml` into SQLite
- Extended `MachinesController` — full REST API for machine/group CRUD + bulk ops
- EventBus events: `MachineCreated`, `MachineDeleted`, `MachineUpdated`, `GroupCreated`, `GroupDeleted`
- Frontend `MachinesPage` — card grid + table view with search/filter/sort
- Frontend `MachineDetailPanel` — full machine info + live metrics via SignalR
- Frontend `GroupManagementPanel` — group CRUD + member management
- Frontend `BulkOperationsBar` — multi-select actions
- Shared components: `StatusBadge`, `TagChip`, `MetricsBar`, `SearchFilterBar`
- Custom hooks: `useMachines`, `useMachineMetrics`
- Routing updates: `/machines`, `/machines/:hostname`
- Sidebar "Machines" link (core shell feature, not plugin-contributed)

**Out of scope:**
- WinRM/CIM connection logic (Phase 2 — already built)
- Machine Overview plugin panel content (Phase 15)
- Credential manager UI (Phase 40)
- Plugin-contributed machine context menus (Phase 12 renderer handles this)

---

## Prerequisites
- Phase 2 (WinRM/CIM engine + `IMachineStatusService` + `MachineConfigLoader`)
- Phase 5 (SQLite + EF Core + `NexusDbContext`)
- Phase 9 (EventBus — for publishing machine/group lifecycle events)
- Phase 10 (React frontend shell + Zustand stores + API client + routing)

---

## Tech Stack for This Phase
| Component | Package/Tech |
|-----------|-------------|
| Database | EF Core 8 + SQLite (Phase 5 infrastructure) |
| Models | C# records + Data Annotations |
| Background | Integration with `MachineStatusService` (Phase 2) |
| Events | `IEventBus` (Phase 9) |
| Frontend | React 18 + TypeScript + Zustand |
| Real-time | SignalR `MetricsHub` subscription (Phase 7) |
| Icons | `lucide-react` |
| Styling | Tailwind CSS + CSS variable theme tokens |

---

## Detailed Tasks

### 1. Create Database Entities

```csharp
// src/Nexus.Gateway/Data/Entities/MachineEntity.cs
[Table("machines")]
public class MachineEntity
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)]
    [Column("id")]
    public int Id { get; set; }

    [Required][MaxLength(255)][Column("hostname")]
    public string Hostname { get; set; } = "";           // Unique, WinRM target

    [Required][MaxLength(255)][Column("display_name")]
    public string DisplayName { get; set; } = "";

    [MaxLength(64)][Column("icon")]
    public string Icon { get; set; } = "server";         // Lucide icon name

    [MaxLength(64)][Column("role")]
    public string Role { get; set; } = "";               // "WFE", "APP", "DC", etc.

    [Column("tags")]
    public string Tags { get; set; } = "[]";             // JSON array of strings

    [MaxLength(128)][Column("credential_id")]
    public string? CredentialId { get; set; }             // FK to DPAPI vault (Phase 8)

    [Column("is_active")]
    public bool IsActive { get; set; } = true;           // Soft-delete flag

    [Column("notes")]
    public string? Notes { get; set; }

    [MaxLength(255)][Column("fqdn")]
    public string? Fqdn { get; set; }                    // Optional FQDN override

    [Required][Column("created_at")]
    public string CreatedAt { get; set; } = DateTime.UtcNow.ToString("o");

    [Required][Column("modified_at")]
    public string ModifiedAt { get; set; } = DateTime.UtcNow.ToString("o");

    public ICollection<MachineGroupMemberEntity> GroupMemberships { get; set; } = new List<MachineGroupMemberEntity>();
}
```

```csharp
// src/Nexus.Gateway/Data/Entities/MachineGroupEntity.cs
[Table("machine_groups")]
public class MachineGroupEntity
{
    [Key][MaxLength(128)][Column("id")]
    public string Id { get; set; } = "";                 // Kebab-case: "sp-spse"

    [Required][MaxLength(255)][Column("label")]
    public string Label { get; set; } = "";

    [MaxLength(9)][Column("color")]
    public string Color { get; set; } = "#888888";       // Hex color for UI badge

    [MaxLength(500)][Column("description")]
    public string? Description { get; set; }

    [MaxLength(64)][Column("icon")]
    public string Icon { get; set; } = "folder";

    [Column("sort_order")]
    public int SortOrder { get; set; } = 0;

    [Required][Column("created_at")]
    public string CreatedAt { get; set; } = DateTime.UtcNow.ToString("o");

    [Required][Column("modified_at")]
    public string ModifiedAt { get; set; } = DateTime.UtcNow.ToString("o");

    public ICollection<MachineGroupMemberEntity> Members { get; set; } = new List<MachineGroupMemberEntity>();
}
```

```csharp
// src/Nexus.Gateway/Data/Entities/MachineGroupMemberEntity.cs
// Junction table — composite PK (MachineId, GroupId) via Fluent API
[Table("machine_group_members")]
public class MachineGroupMemberEntity
{
    [Column("machine_id")]
    public int MachineId { get; set; }

    [Column("group_id")]
    public string GroupId { get; set; } = "";

    [Column("added_at")]
    public string AddedAt { get; set; } = DateTime.UtcNow.ToString("o");

    public MachineEntity Machine { get; set; } = null!;
    public MachineGroupEntity Group { get; set; } = null!;
}
```

### 2. Update NexusDbContext

```csharp
// src/Nexus.Gateway/Data/NexusDbContext.cs — ADD to existing DbSets:
public DbSet<MachineEntity> Machines { get; set; }
public DbSet<MachineGroupEntity> MachineGroups { get; set; }
public DbSet<MachineGroupMemberEntity> MachineGroupMembers { get; set; }

// ADD to OnModelCreating:
modelBuilder.Entity<MachineEntity>(entity =>
{
    entity.HasIndex(e => e.Hostname).IsUnique();
    entity.HasIndex(e => e.IsActive);
});

modelBuilder.Entity<MachineGroupMemberEntity>(entity =>
{
    entity.HasKey(e => new { e.MachineId, e.GroupId });
    entity.HasOne(e => e.Machine)
          .WithMany(m => m.GroupMemberships)
          .HasForeignKey(e => e.MachineId)
          .OnDelete(DeleteBehavior.Cascade);
    entity.HasOne(e => e.Group)
          .WithMany(g => g.Members)
          .HasForeignKey(e => e.GroupId)
          .OnDelete(DeleteBehavior.Cascade);
});
```

### 3. Create Management DTOs

```csharp
// src/Nexus.Gateway/Models/MachineManagementModels.cs

public class CreateMachineRequest
{
    public string Hostname { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public string Icon { get; set; } = "server";
    public string Role { get; set; } = "";
    public List<string> Tags { get; set; } = new();
    public string? CredentialId { get; set; }
    public string? Notes { get; set; }
    public string? Fqdn { get; set; }
    public List<string> GroupIds { get; set; } = new();  // Assign to groups on create
}

public class UpdateMachineRequest
{
    public string? DisplayName { get; set; }
    public string? Icon { get; set; }
    public string? Role { get; set; }
    public List<string>? Tags { get; set; }
    public string? CredentialId { get; set; }
    public string? Notes { get; set; }
    public string? Fqdn { get; set; }
}

public class MachineDetailResponse
{
    public int Id { get; set; }
    public string Hostname { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public string Icon { get; set; } = "server";
    public string Role { get; set; } = "";
    public List<string> Tags { get; set; } = new();
    public string? CredentialId { get; set; }
    public string? Notes { get; set; }
    public string? Fqdn { get; set; }
    public bool IsActive { get; set; }
    public string CreatedAt { get; set; } = "";
    public string ModifiedAt { get; set; } = "";
    public List<GroupSummary> Groups { get; set; } = new();

    // Live status merged from IMachineStatusService (Phase 2)
    public bool IsOnline { get; set; }
    public string? OsVersion { get; set; }
    public double? CpuPercent { get; set; }
    public long? RamTotalMb { get; set; }
    public long? RamFreeMb { get; set; }
    public string? Uptime { get; set; }
    public DateTime LastSeen { get; set; }
    public DateTime LastChecked { get; set; }
}

public class GroupSummary
{
    public string Id { get; set; } = "";
    public string Label { get; set; } = "";
    public string Color { get; set; } = "#888888";
}

public class CreateGroupRequest
{
    public string Id { get; set; } = "";                 // User-chosen kebab-case
    public string Label { get; set; } = "";
    public string Color { get; set; } = "#888888";
    public string? Description { get; set; }
    public string Icon { get; set; } = "folder";
    public int SortOrder { get; set; } = 0;
    public List<string> MachineHostnames { get; set; } = new();  // Initial members
}

public class UpdateGroupRequest
{
    public string? Label { get; set; }
    public string? Color { get; set; }
    public string? Description { get; set; }
    public string? Icon { get; set; }
    public int? SortOrder { get; set; }
}

public class GroupDetailResponse
{
    public string Id { get; set; } = "";
    public string Label { get; set; } = "";
    public string Color { get; set; } = "#888888";
    public string? Description { get; set; }
    public string Icon { get; set; } = "folder";
    public int SortOrder { get; set; }
    public string CreatedAt { get; set; } = "";
    public string ModifiedAt { get; set; } = "";
    public List<MachineSummary> Machines { get; set; } = new();
    public int MemberCount { get; set; }
}

public class MachineSummary
{
    public int Id { get; set; }
    public string Hostname { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public string Icon { get; set; } = "server";
    public bool IsOnline { get; set; }
}

public class GroupMembershipRequest
{
    public List<string> Hostnames { get; set; } = new();  // Machines to add/remove
}

public class BulkOperationRequest
{
    public List<string> Hostnames { get; set; } = new();  // Target machines
}

public class BulkAssignCredentialRequest : BulkOperationRequest
{
    public string CredentialId { get; set; } = "";
}

public class BulkTagRequest : BulkOperationRequest
{
    public List<string> Tags { get; set; } = new();
}

public class BulkOperationResult
{
    public int TotalRequested { get; set; }
    public int Succeeded { get; set; }
    public int Failed { get; set; }
    public List<string> Errors { get; set; } = new();
}

public class MachineImportResult
{
    public int MachinesImported { get; set; }
    public int GroupsImported { get; set; }
    public int Skipped { get; set; }
    public List<string> Warnings { get; set; } = new();
}
```

### 4. Create Machine Management Service

```csharp
// src/Nexus.Gateway/Core/IMachineManagementService.cs
public interface IMachineManagementService
{
    // Machine CRUD
    Task<List<MachineDetailResponse>> GetAllMachinesAsync(bool includeInactive = false);
    Task<MachineDetailResponse?> GetMachineByHostnameAsync(string hostname);
    Task<MachineDetailResponse> CreateMachineAsync(CreateMachineRequest request);
    Task<MachineDetailResponse> UpdateMachineAsync(string hostname, UpdateMachineRequest request);
    Task DeleteMachineAsync(string hostname);  // Soft-delete

    // Group CRUD
    Task<List<GroupDetailResponse>> GetAllGroupsAsync();
    Task<GroupDetailResponse?> GetGroupByIdAsync(string groupId);
    Task<GroupDetailResponse> CreateGroupAsync(CreateGroupRequest request);
    Task<GroupDetailResponse> UpdateGroupAsync(string groupId, UpdateGroupRequest request);
    Task DeleteGroupAsync(string groupId);

    // Membership
    Task AddMachinesToGroupAsync(string groupId, GroupMembershipRequest request);
    Task RemoveMachinesFromGroupAsync(string groupId, GroupMembershipRequest request);

    // Bulk operations
    Task<BulkOperationResult> BulkAssignCredentialAsync(BulkAssignCredentialRequest request);
    Task<BulkOperationResult> BulkAddTagAsync(BulkTagRequest request);
    Task<BulkOperationResult> BulkRemoveTagAsync(BulkTagRequest request);

    // Import
    Task<MachineImportResult> ImportFromYamlAsync();
}

// src/Nexus.Gateway/Core/MachineManagementService.cs
public class MachineManagementService : IMachineManagementService
{
    private readonly NexusDbContext _db;
    private readonly IMachineStatusService _statusService;  // Phase 2
    private readonly IMachineConfigLoader _configLoader;    // Phase 2, for YAML import
    private readonly IEventBus _eventBus;                   // Phase 9
    private readonly ILogger<MachineManagementService> _logger;

    // GetAllMachinesAsync:
    //   1. Query all active MachineEntity from DB (include GroupMemberships)
    //   2. For each, merge live status from IMachineStatusService.GetStatus(hostname)
    //   3. Return as MachineDetailResponse list

    // CreateMachineAsync:
    //   1. Validate hostname uniqueness
    //   2. Create MachineEntity, serialize tags to JSON
    //   3. Create group memberships if GroupIds provided
    //   4. Publish MachineCreatedEvent via EventBus
    //   5. Return detail response

    // DeleteMachineAsync:
    //   1. Set IsActive = false, update ModifiedAt
    //   2. Publish MachineDeletedEvent

    // ImportFromYamlAsync:
    //   1. Read machines + groups from MachineConfigLoader
    //   2. For each group: upsert MachineGroupEntity
    //   3. For each machine: upsert MachineEntity, create group memberships
    //   4. Return import summary
}
```

### 5. Extend MachinesController

```csharp
// src/Nexus.Gateway/Controllers/MachinesController.cs
[ApiController]
[Route("api/machines")]
public class MachinesController : ControllerBase
{
    private readonly IMachineManagementService _managementService;
    private readonly IMachineStatusService _statusService;   // Phase 2 (kept for ping)
    private readonly ICimClient _cimClient;                  // Phase 2 (kept for ping)

    // ── Machine CRUD ──────────────────────────────────────────

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] bool includeInactive = false)
        => Ok(await _managementService.GetAllMachinesAsync(includeInactive));

    [HttpGet("{hostname}")]
    public async Task<IActionResult> GetOne(string hostname)
    {
        var machine = await _managementService.GetMachineByHostnameAsync(hostname);
        return machine is null ? NotFound() : Ok(machine);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateMachineRequest request)
        => Created($"/api/machines/{request.Hostname}",
                   await _managementService.CreateMachineAsync(request));

    [HttpPut("{hostname}")]
    public async Task<IActionResult> Update(string hostname, [FromBody] UpdateMachineRequest request)
        => Ok(await _managementService.UpdateMachineAsync(hostname, request));

    [HttpDelete("{hostname}")]
    public async Task<IActionResult> Delete(string hostname)
    {
        await _managementService.DeleteMachineAsync(hostname);
        return NoContent();
    }

    // ── Ping (from Phase 2, preserved) ────────────────────────

    [HttpPost("{hostname}/ping")]
    public async Task<IActionResult> Ping(string hostname)
        => Ok(await _cimClient.PingAsync(hostname));

    // ── Import ────────────────────────────────────────────────

    [HttpPost("import")]
    public async Task<IActionResult> ImportFromYaml()
        => Ok(await _managementService.ImportFromYamlAsync());

    // ── Bulk Operations ───────────────────────────────────────

    [HttpPost("bulk/assign-credential")]
    public async Task<IActionResult> BulkAssignCredential([FromBody] BulkAssignCredentialRequest request)
        => Ok(await _managementService.BulkAssignCredentialAsync(request));

    [HttpPost("bulk/add-tag")]
    public async Task<IActionResult> BulkAddTag([FromBody] BulkTagRequest request)
        => Ok(await _managementService.BulkAddTagAsync(request));

    [HttpPost("bulk/remove-tag")]
    public async Task<IActionResult> BulkRemoveTag([FromBody] BulkTagRequest request)
        => Ok(await _managementService.BulkRemoveTagAsync(request));

    // ── Groups ────────────────────────────────────────────────

    [HttpGet("groups")]
    public async Task<IActionResult> GetGroups()
        => Ok(await _managementService.GetAllGroupsAsync());

    [HttpGet("groups/{groupId}")]
    public async Task<IActionResult> GetGroup(string groupId)
    {
        var group = await _managementService.GetGroupByIdAsync(groupId);
        return group is null ? NotFound() : Ok(group);
    }

    [HttpPost("groups")]
    public async Task<IActionResult> CreateGroup([FromBody] CreateGroupRequest request)
        => Created($"/api/machines/groups/{request.Id}",
                   await _managementService.CreateGroupAsync(request));

    [HttpPut("groups/{groupId}")]
    public async Task<IActionResult> UpdateGroup(string groupId, [FromBody] UpdateGroupRequest request)
        => Ok(await _managementService.UpdateGroupAsync(groupId, request));

    [HttpDelete("groups/{groupId}")]
    public async Task<IActionResult> DeleteGroup(string groupId)
    {
        await _managementService.DeleteGroupAsync(groupId);
        return NoContent();
    }

    [HttpPost("groups/{groupId}/members")]
    public async Task<IActionResult> AddMembers(string groupId, [FromBody] GroupMembershipRequest request)
    {
        await _managementService.AddMachinesToGroupAsync(groupId, request);
        return Ok();
    }

    [HttpDelete("groups/{groupId}/members")]
    public async Task<IActionResult> RemoveMembers(string groupId, [FromBody] GroupMembershipRequest request)
    {
        await _managementService.RemoveMachinesFromGroupAsync(groupId, request);
        return Ok();
    }
}
```

### 6. Add EventBus Events

```csharp
// src/Nexus.Gateway/Core/EventBus.cs — ADD to existing events:
public record MachineCreatedEvent(string Hostname, DateTime Timestamp) : NexusEvent;
public record MachineDeletedEvent(string Hostname, DateTime Timestamp) : NexusEvent;
public record MachineUpdatedEvent(string Hostname, DateTime Timestamp) : NexusEvent;
public record GroupCreatedEvent(string GroupId, DateTime Timestamp) : NexusEvent;
public record GroupDeletedEvent(string GroupId, DateTime Timestamp) : NexusEvent;
```

### 7. Register Services in DI

```csharp
// src/Nexus.Gateway/Program.cs — ADD:
builder.Services.AddScoped<IMachineManagementService, MachineManagementService>();
```

### 8. Frontend TypeScript Types

```typescript
// src/Nexus.Frontend/src/types/index.ts — ADD to existing types:

/** Extended machine detail with group memberships and live status */
export interface MachineDetail {
  id: number;
  hostname: string;
  displayName: string;
  icon: string;
  role: string;
  tags: string[];
  credentialId: string | null;
  notes: string | null;
  fqdn: string | null;
  isActive: boolean;
  createdAt: string;
  modifiedAt: string;
  groups: GroupSummary[];
  // Live status (merged from MachineStatusService)
  isOnline: boolean;
  osVersion: string | null;
  cpuPercent: number | null;
  ramTotalMb: number | null;
  ramFreeMb: number | null;
  uptime: string | null;
  lastSeen: string;
  lastChecked: string;
}

export interface GroupSummary {
  id: string;
  label: string;
  color: string;
}

export interface MachineGroupDetail {
  id: string;
  label: string;
  color: string;
  description: string | null;
  icon: string;
  sortOrder: number;
  createdAt: string;
  modifiedAt: string;
  machines: MachineSummary[];
  memberCount: number;
}

export interface MachineSummary {
  id: number;
  hostname: string;
  displayName: string;
  icon: string;
  isOnline: boolean;
}

export interface CreateMachineRequest {
  hostname: string;
  displayName: string;
  icon?: string;
  role?: string;
  tags?: string[];
  credentialId?: string | null;
  notes?: string | null;
  fqdn?: string | null;
  groupIds?: string[];
}

export interface UpdateMachineRequest {
  displayName?: string;
  icon?: string;
  role?: string;
  tags?: string[];
  credentialId?: string | null;
  notes?: string | null;
  fqdn?: string | null;
}

export interface CreateGroupRequest {
  id: string;
  label: string;
  color?: string;
  description?: string | null;
  icon?: string;
  sortOrder?: number;
  machineHostnames?: string[];
}

export interface UpdateGroupRequest {
  label?: string;
  color?: string;
  description?: string | null;
  icon?: string;
  sortOrder?: number;
}

export interface BulkOperationResult {
  totalRequested: number;
  succeeded: number;
  failed: number;
  errors: string[];
}

export interface MachineImportResult {
  machinesImported: number;
  groupsImported: number;
  skipped: number;
  warnings: string[];
}

export type MachineViewMode = 'grid' | 'table';
export type MachineFilterStatus = 'all' | 'online' | 'offline';
export type MachineSortField = 'hostname' | 'displayName' | 'status' | 'cpuPercent' | 'group';
export type SortDirection = 'asc' | 'desc';
```

### 9. Extend machineStore (Zustand)

```typescript
// src/Nexus.Frontend/src/store/machineStore.ts — EXTEND existing store:
interface MachineState {
  // ── Existing (Phase 10) ──────────────────────────────────
  machines: MachineDetail[];
  groups: MachineGroupDetail[];
  selectedMachine: string | null;
  isLoading: boolean;
  fetchAll: () => Promise<void>;
  selectMachine: (hostname: string) => void;

  // ── NEW (Phase 14) ──────────────────────────────────────
  // CRUD
  createMachine: (req: CreateMachineRequest) => Promise<MachineDetail>;
  updateMachine: (hostname: string, req: UpdateMachineRequest) => Promise<MachineDetail>;
  deleteMachine: (hostname: string) => Promise<void>;
  createGroup: (req: CreateGroupRequest) => Promise<MachineGroupDetail>;
  updateGroup: (groupId: string, req: UpdateGroupRequest) => Promise<MachineGroupDetail>;
  deleteGroup: (groupId: string) => Promise<void>;
  addToGroup: (groupId: string, hostnames: string[]) => Promise<void>;
  removeFromGroup: (groupId: string, hostnames: string[]) => Promise<void>;

  // Bulk operations
  bulkAssignCredential: (hostnames: string[], credentialId: string) => Promise<BulkOperationResult>;
  bulkAddTag: (hostnames: string[], tags: string[]) => Promise<BulkOperationResult>;
  bulkRemoveTag: (hostnames: string[], tags: string[]) => Promise<BulkOperationResult>;
  importFromYaml: () => Promise<MachineImportResult>;

  // Selection (multi-select for bulk ops)
  selectedHostnames: string[];
  toggleSelection: (hostname: string) => void;
  selectAll: () => void;
  clearSelection: () => void;

  // Filtering & sorting
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  filterGroup: string | null;
  setFilterGroup: (groupId: string | null) => void;
  filterTag: string | null;
  setFilterTag: (tag: string | null) => void;
  filterStatus: MachineFilterStatus;
  setFilterStatus: (status: MachineFilterStatus) => void;
  sortField: MachineSortField;
  sortDirection: SortDirection;
  setSort: (field: MachineSortField, dir: SortDirection) => void;
  viewMode: MachineViewMode;
  setViewMode: (mode: MachineViewMode) => void;
}
```

### 10. Frontend Custom Hooks

```typescript
// src/Nexus.Frontend/src/hooks/useMachines.ts
// Wraps machineStore with derived filtered/sorted list
export function useMachines() {
  const store = useMachineStore();
  // Returns: filteredMachines (apply search + group + tag + status filters),
  //          sortedMachines (apply sort field + direction),
  //          pagination helpers if needed,
  //          all store actions
}

// src/Nexus.Frontend/src/hooks/useMachineMetrics.ts
// Subscribes to SignalR MetricsHub for a specific machine
export function useMachineMetrics(hostname: string) {
  // Connects to /hubs/metrics
  // Calls SubscribeToMachine(hostname)
  // Returns: { cpuPercent, ramPercent, diskPercent, isOnline, timestamp }
  // Cleans up subscription on unmount
}
```

### 11. Frontend Pages & Components

**MachinesPage.tsx** — Main page at route `/machines`:
```tsx
// src/Nexus.Frontend/src/pages/MachinesPage.tsx
// Layout:
// ┌────────────────────────────────────────────────────────┐
// │  Machines                    [+ Add] [Import] [Grid|Table] │
// │  [Search...]  [Group ▼]  [Tag ▼]  [Status ▼]              │
// ├────────────────────────────────────────────────────────┤
// │                                                        │
// │  ┌── Group: SharePoint SE ────────────────────────┐   │
// │  │  [SPSE-WFE01 ●] [SPSE-APP01 ●]                │   │
// │  └────────────────────────────────────────────────┘   │
// │  ┌── Group: Standalone ───────────────────────────┐   │
// │  │  [DC01 ●] [SQL01 ●] [WIN11 ○]                 │   │
// │  └────────────────────────────────────────────────┘   │
// │                                                        │
// │  ═══════════ BulkOperationsBar (when selected) ═══════ │
// └────────────────────────────────────────────────────────┘
```

**MachineCard.tsx** — Individual machine card:
```tsx
// - Status dot (green/red/grey via StatusBadge)
// - Hostname + display name
// - CPU/RAM mini-bars (MetricsBar) if online
// - Tags as colored chips (TagChip)
// - Group badge with color swatch
// - Selection checkbox for bulk ops
// - Click → navigates to /machines/{hostname}
// - Right-click → context menu (ping, terminal, manage)
```

**MachineTable.tsx** — Alternative table view:
```tsx
// - Sortable columns: hostname, display name, status, CPU, RAM, group, tags
// - Row selection checkboxes for bulk ops
// - Inline StatusBadge for status column
// - Click row → navigates to /machines/{hostname}
```

**MachineDetailPanel.tsx** — Detail view at `/machines/:hostname`:
```tsx
// Layout:
// ┌─────────────────────────────────────────┐
// │  ← Back  |  DC01 — Domain Controller  ● │
// ├─────────────────────────────────────────┤
// │  Status: Online       OS: Windows Server 2022       │
// │  Uptime: 14d 3h 22m   IP: 10.0.0.10                │
// ├─────────────────────────────────────────┤
// │  CPU  [████████░░░░░░░░] 52%            │  ← live via SignalR
// │  RAM  [██████████░░░░░░] 68%  (8.2/12GB) │
// │  Disk [████░░░░░░░░░░░░] 28%            │
// ├─────────────────────────────────────────┤
// │  Tags:  [dc] [dns] [adds] [+ Add]      │  ← editable
// │  Groups: [Domain Controllers] [+ Add]   │  ← editable
// │  Credential: [domain-admin ▼]           │  ← dropdown
// │  Notes: [ editable text area          ] │
// ├─────────────────────────────────────────┤
// │  [Ping] [Open Terminal] [Refresh]       │
// └─────────────────────────────────────────┘
```

**GroupManagementPanel.tsx** — Accessed from sidebar or MachinesPage:
```tsx
// - Group list with color swatches + member counts
// - [+ Create Group] button → GroupCreateDialog
// - Click group → expand to show members
// - Inline edit/delete per group
// - Drag machines between groups (future enhancement)
```

**GroupCreateDialog.tsx** — Modal for group CRUD:
```tsx
// - Text input: ID (kebab-case, auto-suggested from label)
// - Text input: Label
// - Color picker (palette of 12 preset colors + custom hex input)
// - Text input: Description (optional)
// - Icon selector (common Lucide icons grid)
// - Multi-select: initial machine members
// - [Create] / [Cancel] buttons
```

**BulkOperationsBar.tsx** — Floating bar:
```tsx
// Appears when selectedHostnames.length > 0
// ┌──────────────────────────────────────────────────────────────┐
// │  3 machines selected  [Assign Credential] [Add Tag] [Remove Tag] [Add to Group] [Ping All] [✕ Clear] │
// └──────────────────────────────────────────────────────────────┘
```

### 12. Shared Components

```tsx
// src/Nexus.Frontend/src/components/StatusBadge.tsx
// Props: status: 'online' | 'offline' | 'unknown', size?: 'sm' | 'md' | 'lg'
// Renders: colored dot + optional label
// Colors from theme tokens: --color-status-online, --color-status-offline, --color-status-unknown

// src/Nexus.Frontend/src/components/TagChip.tsx
// Props: tag: string, onRemove?: () => void, color?: string
// Renders: pill-shaped chip with tag text, optional × button in edit mode

// src/Nexus.Frontend/src/components/MetricsBar.tsx
// Props: value: number (0-100), label: string, color?: string
// Renders: animated progress bar with percentage label
// Color shifts: green (<60%), yellow (60-85%), red (>85%)

// src/Nexus.Frontend/src/components/SearchFilterBar.tsx
// Props: onSearch, filters: FilterDefinition[], onFilterChange
// Renders: search input + dropdown filter buttons
// Reusable by future plugin pages
```

### 13. Routing & Sidebar Updates

```tsx
// src/Nexus.Frontend/src/App.tsx — ADD routes:
<Route path="/machines" element={<MachinesPage />} />
<Route path="/machines/:hostname" element={<MachineDetailPanel />} />

// src/Nexus.Frontend/src/shell/Sidebar.tsx — ADD hardcoded link:
// After "📊 Dashboard" link:
// 🖥️ Machines → /machines  (with online count badge: "3/9")
```

---

## API Endpoints Produced

| Method | Endpoint | Response | Notes |
|--------|----------|----------|-------|
| GET | `/api/machines` | `List<MachineDetailResponse>` | Extended from Phase 2 — now from SQLite + live status |
| GET | `/api/machines/{hostname}` | `MachineDetailResponse` | Extended from Phase 2 |
| POST | `/api/machines` | `MachineDetailResponse` | **NEW** — create machine |
| PUT | `/api/machines/{hostname}` | `MachineDetailResponse` | **NEW** — update machine |
| DELETE | `/api/machines/{hostname}` | `204 No Content` | **NEW** — soft-delete |
| POST | `/api/machines/{hostname}/ping` | `{ online, latencyMs }` | Preserved from Phase 2 |
| POST | `/api/machines/import` | `MachineImportResult` | **NEW** — YAML import |
| POST | `/api/machines/bulk/assign-credential` | `BulkOperationResult` | **NEW** |
| POST | `/api/machines/bulk/add-tag` | `BulkOperationResult` | **NEW** |
| POST | `/api/machines/bulk/remove-tag` | `BulkOperationResult` | **NEW** |
| GET | `/api/machines/groups` | `List<GroupDetailResponse>` | Extended from Phase 2 — now from SQLite |
| GET | `/api/machines/groups/{groupId}` | `GroupDetailResponse` | **NEW** |
| POST | `/api/machines/groups` | `GroupDetailResponse` | **NEW** |
| PUT | `/api/machines/groups/{groupId}` | `GroupDetailResponse` | **NEW** |
| DELETE | `/api/machines/groups/{groupId}` | `204 No Content` | **NEW** |
| POST | `/api/machines/groups/{groupId}/members` | `200 OK` | **NEW** |
| DELETE | `/api/machines/groups/{groupId}/members` | `200 OK` | **NEW** |

---

## Files to Create/Modify

| File | Action | Area |
|------|--------|------|
| `src/Nexus.Gateway/Data/Entities/MachineEntity.cs` | Create | Backend |
| `src/Nexus.Gateway/Data/Entities/MachineGroupEntity.cs` | Create | Backend |
| `src/Nexus.Gateway/Data/Entities/MachineGroupMemberEntity.cs` | Create | Backend |
| `src/Nexus.Gateway/Data/NexusDbContext.cs` | Modify | Backend |
| `src/Nexus.Gateway/Models/MachineManagementModels.cs` | Create | Backend |
| `src/Nexus.Gateway/Core/IMachineManagementService.cs` | Create | Backend |
| `src/Nexus.Gateway/Core/MachineManagementService.cs` | Create | Backend |
| `src/Nexus.Gateway/Controllers/MachinesController.cs` | Modify | Backend |
| `src/Nexus.Gateway/Core/EventBus.cs` | Modify | Backend |
| `src/Nexus.Gateway/Program.cs` | Modify | Backend |
| `src/Nexus.Frontend/src/types/index.ts` | Modify | Frontend |
| `src/Nexus.Frontend/src/store/machineStore.ts` | Modify | Frontend |
| `src/Nexus.Frontend/src/pages/MachinesPage.tsx` | Create | Frontend |
| `src/Nexus.Frontend/src/components/MachineCard.tsx` | Create | Frontend |
| `src/Nexus.Frontend/src/components/MachineTable.tsx` | Create | Frontend |
| `src/Nexus.Frontend/src/components/MachineDetailPanel.tsx` | Create | Frontend |
| `src/Nexus.Frontend/src/components/GroupManagementPanel.tsx` | Create | Frontend |
| `src/Nexus.Frontend/src/components/GroupCreateDialog.tsx` | Create | Frontend |
| `src/Nexus.Frontend/src/components/BulkOperationsBar.tsx` | Create | Frontend |
| `src/Nexus.Frontend/src/components/StatusBadge.tsx` | Create | Frontend |
| `src/Nexus.Frontend/src/components/TagChip.tsx` | Create | Frontend |
| `src/Nexus.Frontend/src/components/MetricsBar.tsx` | Create | Frontend |
| `src/Nexus.Frontend/src/components/SearchFilterBar.tsx` | Create | Frontend |
| `src/Nexus.Frontend/src/hooks/useMachines.ts` | Create | Frontend |
| `src/Nexus.Frontend/src/hooks/useMachineMetrics.ts` | Create | Frontend |
| `src/Nexus.Frontend/src/App.tsx` | Modify | Frontend |
| `src/Nexus.Frontend/src/shell/Sidebar.tsx` | Modify | Frontend |

---

## Integration Points

- **Phase 2 (WinRM/CIM):** `IMachineStatusService` provides live online/offline status and CPU/RAM/uptime that `MachineManagementService` merges into `MachineDetailResponse`. `MachineConfigLoader` provides YAML data for first-run import.
- **Phase 5 (SQLite):** New migration adds 3 tables to existing `NexusDbContext`.
- **Phase 7 (SignalR):** Frontend `useMachineMetrics` hook subscribes to `MetricsHub` for live machine metrics on the detail panel.
- **Phase 8 (Credentials):** `CredentialId` field on machines references credential profiles in the DPAPI vault.
- **Phase 9 (EventBus):** Machine/group lifecycle events allow Phase 41 (Alerts) and other subscribers to react to changes.
- **Phase 12 (Plugin Renderer):** Plugin context receives updated `MachineStatus[]` and `MachineGroup[]` from this phase's store.
- **Phase 15 (Machine Overview Plugin):** Will consume the machine list/detail APIs built here to populate the dashboard panel.

---

## Test Criteria
- [ ] EF Core migration generates and applies without errors (`dotnet ef migrations add Phase14_MachineGroupManagement`)
- [ ] `GET /api/machines` returns all machines from SQLite with live status merged
- [ ] `POST /api/machines` with valid `CreateMachineRequest` creates machine, returns 201
- [ ] `POST /api/machines` with duplicate hostname returns 409 Conflict
- [ ] `PUT /api/machines/DC01` updates display name, tags, or credential assignment
- [ ] `DELETE /api/machines/DC01` soft-deletes (is_active=false), machine hidden from default GET
- [ ] `GET /api/machines?includeInactive=true` shows soft-deleted machines
- [ ] `POST /api/machines/import` seeds all machines/groups from machines.yaml, returns summary
- [ ] `POST /api/machines/groups` creates group with color and label, returns 201
- [ ] `POST /api/machines/groups/sp-spse/members` adds machines to group
- [ ] `DELETE /api/machines/groups/sp-spse/members` removes machines from group
- [ ] `POST /api/machines/bulk/assign-credential` updates credential_id on multiple machines
- [ ] `POST /api/machines/bulk/add-tag` appends tag to all targeted machines
- [ ] Frontend: `/machines` page displays all machines as cards organized by group
- [ ] Frontend: search bar filters machines by hostname and display name
- [ ] Frontend: clicking a machine navigates to `/machines/{hostname}` detail view
- [ ] Frontend: detail panel shows live CPU/RAM/Disk bars updating via SignalR
- [ ] Frontend: selecting multiple machines shows BulkOperationsBar
- [ ] Frontend: group management panel allows creating/editing/deleting groups
- [ ] Frontend: all components use CSS variable theme tokens (no hardcoded colors)
- [ ] `dotnet build` succeeds
- [ ] `npm run build` produces production output

---

## Sub-Phase Breakdown (if needed)
- **14-0:** Database entities + NexusDbContext update + EF migration
- **14-1:** MachineManagementModels (DTOs) + IMachineManagementService interface
- **14-2:** MachineManagementService implementation + YAML import logic
- **14-3:** MachinesController extension (all CRUD + bulk + group endpoints)
- **14-4:** EventBus events + DI registration + backend integration test
- **14-5:** Frontend TypeScript types + machineStore extension
- **14-6:** Shared components (StatusBadge, TagChip, MetricsBar, SearchFilterBar)
- **14-7:** Custom hooks (useMachines, useMachineMetrics)
- **14-8:** MachinesPage + MachineCard + MachineTable
- **14-9:** MachineDetailPanel (with SignalR metrics subscription)
- **14-10:** GroupManagementPanel + GroupCreateDialog
- **14-11:** BulkOperationsBar + routing + sidebar updates

---

## Notes for Coding Agent
- Phase 2's `MachineConfigLoader` reads `config/machines.yaml`. Phase 14 imports this data into SQLite once. After import, the database is the source of truth — do NOT re-read YAML on every request.
- The import endpoint (`POST /api/machines/import`) is idempotent: existing machines are updated (upsert), not duplicated.
- `MachineDetailResponse` merges two data sources: static data from SQLite (entity) + live data from `IMachineStatusService` (Phase 2 background poller). Both must be combined in the service layer.
- Tags are stored as a JSON string array in SQLite (`"[\"dc\",\"dns\"]"`). Use `System.Text.Json` for serialization.
- Soft-deleted machines (`is_active = false`) must NOT appear in `IMachineStatusService` polling. Update the Phase 2 poller to query only active machines from the management service once imported.
- The frontend `MachinesPage` is a core shell page, NOT a plugin page. It gets its own route (`/machines`) and a hardcoded sidebar entry with online count badge. This is because every plugin depends on the machine context.
- All frontend components must use CSS variable theme tokens from Phase 11. Use Tailwind classes like `bg-bg-primary`, `text-accent`, `border-border` — never hex codes.
- The `useMachineMetrics` hook should debounce SignalR updates and clean up subscription on component unmount to avoid memory leaks.
- Group IDs must be validated as kebab-case on the backend before persistence.
- The color picker in `GroupCreateDialog` should offer the same 12-color preset palette used by the existing `machines.yaml` group definitions.
- Bulk operations should be atomic per-machine: if one fails, others still succeed. The `BulkOperationResult` reports individual failures.
- Machine hostname comparison should be case-insensitive (Windows hostnames are case-insensitive).

