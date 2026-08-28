import { useMemo, useState } from 'react'
import { Check, ChevronsUpDown, UserX } from 'lucide-react'
import { useUsers } from '../../queries/userQueries'
import { UserAvatar } from '../UserAvatar'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'

type EmployeeComboboxProps = {
  value: string | null
  onChange: (user: { id: string; name: string } | null) => void
  disabled?: boolean
}

/** Accent-insensitive fold: "Müller" matches "muller", "José" matches "jose". */
function normalizeForSearch(text: string): string {
  return text
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

export function EmployeeCombobox({ value, onChange, disabled = false }: EmployeeComboboxProps) {
  const { data: users = [] } = useUsers()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const selected = users.find(user => user.id === value) ?? null

  const filtered = useMemo(() => {
    const needle = normalizeForSearch(search.trim())
    if (!needle) return users
    return users.filter(
      user =>
        normalizeForSearch(user.name ?? '').includes(needle) ||
        normalizeForSearch(user.email ?? '').includes(needle),
    )
  }, [users, search])

  const pick = (user: { id: string; name: string } | null) => {
    setOpen(false)
    setSearch('')
    onChange(user)
  }

  return (
    <Popover
      open={open}
      onOpenChange={next => {
        setOpen(next)
        if (!next) setSearch('')
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="combobox"
          size="sm"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-40 justify-between"
        >
          <span className={`flex min-w-0 items-center gap-1.5 ${selected ? '' : 'text-muted-foreground'}`}>
            {selected && (
              <UserAvatar name={selected.name} avatarUrl={selected.avatar_url} />
            )}
            <span className="truncate">{selected ? selected.name : 'Unassigned'}</span>
          </span>
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-4 min-w-70">
        <Input
          autoFocus
          placeholder="Search user…"
          className="h-10 mb-1 text-base outline-primary!"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="max-h-56 overflow-y-auto">
          <button
            type="button"
            className=" flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-primary/10 cursor-pointer"
            onClick={() => pick(null)}
          >
            <p>
            Unassigned
            </p>
            <UserX className="size-4" />
            {value === null && <Check className="ml-auto size-4" />}
          </button>
          {filtered.map(user => (
            <button
              key={user.id}
              type="button"
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-primary/10 cursor-pointer"
              onClick={() => pick({ id: user.id, name: user.name })}
            >
              <UserAvatar name={user.name} avatarUrl={user.avatar_url} />
              <p className="truncate">{user.name}</p>
              {user.id === value && <Check className="size-4 shrink-0" />}
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="px-2 py-1.5 text-sm text-muted-foreground">No users found</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
