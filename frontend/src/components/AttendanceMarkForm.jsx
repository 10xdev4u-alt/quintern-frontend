import { useState } from 'react'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import api from '../lib/axios'
import { Card, CardHeader, CardBody, Button, Input, Select, Banner } from './ui'
import { useFlash } from '../lib/useFlash'
import { ATTENDANCE_LABEL } from '../lib/constants'

export default function AttendanceMarkForm() {
  const queryClient = useQueryClient()
  const [userId, setUserId] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [status, setStatus] = useState('PRESENT')
  const [remarks, setRemarks] = useState('')
  const { message, error, flash, flashError } = useFlash(2500)

  const { data: reports } = useQuery({
    queryKey: ['teamMembers'],
    queryFn: () => api.get('/team/members').then((res) => res.data),
  })

  const markMutation = useMutation({
    mutationFn: (data) => api.post('/attendance/mark', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['teamMembers'] });
      queryClient.invalidateQueries({ queryKey: ['internHome'] });
      flash('Attendance marked');
    },
    onError: (err) => flashError(err.response?.data?.error || 'Failed to mark attendance'),
  })

  return (
    <Card>
      <CardHeader title="Mark attendance" subtitle="Single record. Use bulk mark for groups." />
      <CardBody>
        {message && <Banner kind="success" className="mb-3">{message}</Banner>}
        {error && <Banner kind="error" className="mb-3">{error}</Banner>}
        <form onSubmit={(e) => { e.preventDefault(); markMutation.mutate({ user_id: userId, date, status, remarks }) }} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select label="Member" value={userId} onChange={(e) => setUserId(e.target.value)} required>
            <option value="">Select member…</option>
            {reports?.map((u) => <option key={u.id} value={u.id}>{u.full_name || u.email} ({u.role})</option>)}
          </Select>
          <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} max={new Date().toISOString().slice(0, 10)} required />
          <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value)}>
            {Object.entries(ATTENDANCE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
          <Input label="Remarks (optional)" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          <div className="sm:col-span-2"><Button type="submit" loading={markMutation.isPending} disabled={!userId}>Mark attendance</Button></div>
        </form>
      </CardBody>
    </Card>
  )
}
