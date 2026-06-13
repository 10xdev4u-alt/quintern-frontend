import { useState } from 'react'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import api from '../lib/axios'
import { Card, CardHeader, CardBody, Button, Input, Select, Banner, Badge } from './ui'
import { useFlash } from '../lib/useFlash'
import { ATTENDANCE_LABEL } from '../lib/constants'

export default function BulkAttendanceForm() {
  const queryClient = useQueryClient()
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [status, setStatus] = useState('PRESENT')
  const [remarks, setRemarks] = useState('')
  const [selectedUsers, setSelectedUsers] = useState([])
  const { message, error, flash, flashError } = useFlash(2500)

  const { data: reports } = useQuery({
    queryKey: ['teamMembers'],
    queryFn: () => api.get('/team/members').then((res) => res.data),
  })

  const bulkMutation = useMutation({
    mutationFn: (data) => api.post('/attendance/bulk', data),
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['teamMembers'] });
      queryClient.invalidateQueries({ queryKey: ['internHome'] });
      const n = vars?.entries?.length || 0;
      setSelectedUsers([]);
      flash(`Marked ${n} member${n === 1 ? '' : 's'}`);
    },
    onError: (err) => flashError(err.response?.data?.error || 'Bulk mark failed'),
  })

  const toggleUser = (id) => setSelectedUsers((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id])
  const selectAll = () => setSelectedUsers(reports?.map((u) => u.id) || [])
  const clearAll = () => setSelectedUsers([])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (selectedUsers.length === 0) {
      flashError('Select at least one member')
      return
    }
    bulkMutation.mutate({ entries: selectedUsers.map((uid) => ({ user_id: uid, date, status, remarks })) })
  }

  return (
    <Card>
      <CardHeader title="Bulk mark attendance" subtitle={`${selectedUsers.length} of ${reports?.length || 0} selected`} />
      <CardBody>
        {message && <Banner kind="success" className="mb-3">{message}</Banner>}
        {error && <Banner kind="error" className="mb-3">{error}</Banner>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-fg-muted">Members</label>
              <div className="flex gap-1.5 text-xs">
                <button type="button" onClick={selectAll} className="text-fg-muted hover:text-fg transition-colors">Select all</button>
                <span className="text-fg-subtle">·</span>
                <button type="button" onClick={clearAll} className="text-fg-muted hover:text-fg transition-colors">Clear</button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-36 overflow-auto p-1" role="group" aria-label="Members to mark">
              {reports?.map((u) => {
                const sel = selectedUsers.includes(u.id);
                return (
                  <button type="button" key={u.id} onClick={() => toggleUser(u.id)}
                          aria-pressed={sel}
                          className={['px-2.5 h-7 rounded-full text-xs font-medium transition-colors border', sel ? 'bg-fg text-fg-inverse border-fg' : 'bg-surface-base text-fg-muted border-border hover:border-border-strong'].join(' ')}>
                    {u.full_name || u.email}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} max={new Date().toISOString().slice(0, 10)} required />
            <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
              {Object.entries(ATTENDANCE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
            <Input label="Remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </div>
          <Button type="submit" variant="primary" loading={bulkMutation.isPending} disabled={!selectedUsers.length}>
            Bulk mark {selectedUsers.length} {selectedUsers.length === 1 ? 'member' : 'members'}
          </Button>
        </form>
      </CardBody>
    </Card>
  )
}
