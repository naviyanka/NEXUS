import { useEffect, useState } from 'react'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { useMachineStore, Machine } from '@/stores/machineStore'
import {
  flexRender, getCoreRowModel, getFilteredRowModel, getPaginationRowModel,
  getSortedRowModel, useReactTable, ColumnDef
} from '@tanstack/react-table'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Search, MoreHorizontal, Plus, TerminalSquare, Activity } from 'lucide-react'
import { Link, useNavigate } from '@tanstack/react-router'
import { AddMachineDialog } from './components/add-machine-dialog'

export default function MachinesPage() {
  const { machines, isLoading, fetchMachines, fetchGroups, pollStatus } = useMachineStore()
  const [globalFilter, setGlobalFilter] = useState('')
  const [rowSelection, setRowSelection] = useState({})
  const [isAddOpen, setIsAddOpen] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    fetchMachines()
    fetchGroups()
    pollStatus()
  }, [fetchMachines, fetchGroups, pollStatus])

  const columns: ColumnDef<Machine>[] = [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: 'lastKnownStatus',
      header: 'Status',
      cell: ({ row }) => {
        const status = row.getValue('lastKnownStatus') as string
        const lastSeen = row.original.lastSeenOnline
        const isOnline = status === 'Online'
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex justify-center items-center w-full">
                  <div className={`h-3 w-3 rounded-full ${isOnline ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse' : status === 'Offline' ? 'bg-red-500' : 'bg-gray-500'}`} />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{status}</p>
                <p className="text-xs text-muted-foreground">Last Seen: {lastSeen ? new Date(lastSeen).toLocaleString() : 'Never'}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )
      }
    },
    {
      accessorKey: 'hostname',
      header: 'Hostname',
      cell: ({ row }) => <span className="font-bold cursor-pointer hover:underline" onClick={() => navigate({ to: `/machines/${row.original.id}` })}>{row.getValue('hostname')}</span>
    },
    {
      accessorKey: 'displayName',
      header: 'Display Name',
    },
    {
      accessorFn: row => row.machineGroup?.name || 'Unassigned',
      id: 'group',
      header: 'Group',
      cell: ({ row }) => <Badge variant="secondary">{row.getValue('group')}</Badge>
    },
    {
      accessorKey: 'role',
      header: 'Role',
      cell: ({ row }) => <Badge variant="outline">{row.getValue('role') || 'None'}</Badge>
    },
    {
      accessorKey: 'tags',
      header: 'Tags',
      cell: ({ row }) => {
        const tags = (row.getValue('tags') as string)?.split(',').filter(Boolean) || []
        return (
          <div className="flex flex-wrap gap-1">
            {tags.map(t => <Badge key={t} variant="outline" className="text-[10px] py-0 px-1">{t}</Badge>)}
          </div>
        )
      }
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const machine = row.original
        return (
          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
              <Link to="/terminal" search={{ hostname: machine.hostname }}><TerminalSquare className="h-4 w-4" /></Link>
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" asChild>
              <Link to={`/machines/${machine.id}`}><Activity className="h-4 w-4" /></Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => navigate({ to: `/machines/${machine.id}` })}>Overview</DropdownMenuItem>
                <DropdownMenuItem asChild><Link to={`/machines/${machine.id}`} search={{ tab: 'services' }}>Services</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link to={`/machines/${machine.id}`} search={{ tab: 'processes' }}>Processes</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link to={`/machines/${machine.id}`} search={{ tab: 'events' }}>Events</Link></DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )
      }
    }
  ]

  const table = useReactTable({
    data: machines,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: (row, columnId, filterValue) => {
      const hostname = row.getValue('hostname') as string
      const displayName = row.getValue('displayName') as string
      const val = filterValue.toLowerCase()
      return (hostname?.toLowerCase() ?? '').includes(val) || (displayName?.toLowerCase() ?? '').includes(val)
    },
    state: {
      rowSelection,
      globalFilter
    }
  })

  return (
    <>
      <Header>
        <h1 className='text-xl font-bold'>Machines</h1>
      </Header>
      <Main>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center w-full max-w-sm space-x-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search hostname or display name..."
                value={globalFilter}
                onChange={e => setGlobalFilter(e.target.value)}
                className="h-8 w-[250px]"
              />
            </div>
            <div className="flex space-x-2">
              {Object.keys(rowSelection).length > 0 && (
                <Button variant="secondary" size="sm" onClick={() => pollStatus()}>
                  Ping Selected ({Object.keys(rowSelection).length})
                </Button>
              )}
              <Button size="sm" onClick={() => setIsAddOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Add Machine
              </Button>
            </div>
          </div>

          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow
                      key={row.id}
                      data-state={row.getIsSelected() && "selected"}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={columns.length} className="h-24 text-center">
                      {isLoading ? "Loading machines..." : "No machines found."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-end space-x-2 py-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Next
            </Button>
          </div>
        </div>
      </Main>
      <AddMachineDialog open={isAddOpen} onOpenChange={setIsAddOpen} />
    </>
  )
}
