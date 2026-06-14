using Nexus.Gateway.Models;

namespace Nexus.Gateway.Data;

public static class DatabaseSeeder
{
    public static void Seed(NexusDbContext context)
    {
        if (!context.MachineGroups.Any())
        {
            var groups = new[]
            {
                new MachineGroup { Name = "Core Infra" },
                new MachineGroup { Name = "SharePoint SE" },
                new MachineGroup { Name = "SharePoint 2019" },
                new MachineGroup { Name = "SharePoint 2016" }
            };

            context.MachineGroups.AddRange(groups);
            context.SaveChanges();

            if (!context.Machines.Any())
            {
                var coreInfraId = context.MachineGroups.First(g => g.Name == "Core Infra").Id;
                var spseId = context.MachineGroups.First(g => g.Name == "SharePoint SE").Id;
                var sp2019Id = context.MachineGroups.First(g => g.Name == "SharePoint 2019").Id;
                var sp2016Id = context.MachineGroups.First(g => g.Name == "SharePoint 2016").Id;

                var machines = new[]
                {
                    new Machine { Hostname = "DC01", DisplayName = "Domain Controller", Role = "DC", MachineGroupId = coreInfraId },
                    new Machine { Hostname = "SQL01", DisplayName = "SQL Server", Role = "SQL", MachineGroupId = coreInfraId },
                    new Machine { Hostname = "WIN11-CLIENT", DisplayName = "Windows 11 Client", Role = "Client", MachineGroupId = coreInfraId },

                    new Machine { Hostname = "SPSE-WFE01", DisplayName = "SPSE Web Front End", Role = "WFE", MachineGroupId = spseId },
                    new Machine { Hostname = "SPSE-APP01", DisplayName = "SPSE Application", Role = "APP", MachineGroupId = spseId },

                    new Machine { Hostname = "SP2019-WFE01", DisplayName = "SP2019 Web Front End", Role = "WFE", MachineGroupId = sp2019Id },
                    new Machine { Hostname = "SP2019-APP01", DisplayName = "SP2019 Application", Role = "APP", MachineGroupId = sp2019Id },

                    new Machine { Hostname = "SP2016-WFE01", DisplayName = "SP2016 Web Front End", Role = "WFE", MachineGroupId = sp2016Id },
                    new Machine { Hostname = "SP2016-APP01", DisplayName = "SP2016 Application", Role = "APP", MachineGroupId = sp2016Id },
                };

                context.Machines.AddRange(machines);
                context.SaveChanges();
            }
        }

        if (!context.SavedScripts.Any())
        {
            var scripts = new[]
            {
                new SavedScript
                {
                    Name = "Get All Services",
                    Content = "Get-Service | Select Name,Status,StartType | ConvertTo-Json",
                    Category = "System",
                    IsBuiltIn = true,
                    Author = "System"
                },
                new SavedScript
                {
                    Name = "Get Running Processes",
                    Content = "Get-Process | Sort CPU -Desc | Select -First 20 | ConvertTo-Json",
                    Category = "System",
                    IsBuiltIn = true,
                    Author = "System"
                },
                new SavedScript
                {
                    Name = "Disk Space Report",
                    Content = "Get-PSDrive -PSProvider FileSystem | Select Name,Used,Free | ConvertTo-Json",
                    Category = "System",
                    IsBuiltIn = true,
                    Author = "System"
                },
                new SavedScript
                {
                    Name = "Last 50 System Events",
                    Content = "Get-EventLog -LogName System -Newest 50 | ConvertTo-Json",
                    Category = "System",
                    IsBuiltIn = true,
                    Author = "System"
                },
                new SavedScript
                {
                    Name = "SP Farm Servers",
                    Content = "Add-PSSnapin Microsoft.SharePoint.PowerShell -EA SilentlyContinue; Get-SPServer | Select Name,Role,Status | ConvertTo-Json",
                    Category = "SharePoint",
                    IsBuiltIn = true,
                    Author = "System"
                }
            };

            context.SavedScripts.AddRange(scripts);
            context.SaveChanges();
        }
    }
}
