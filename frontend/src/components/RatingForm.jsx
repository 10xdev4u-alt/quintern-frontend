import { useState } from 'react'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import api from '../lib/axios'
import { Card, CardHeader, CardBody, Button, Select, Textarea, Banner } from './ui'
import { useFlash } from '../lib/useFlash'
import { RATING_CATEGORIES } from '../lib/constants'

export default function RatingForm() {
  const queryClient = useQueryClient()
  const [userId, setUserId] = useState('')
  const [score, setScore] = useState(8)
  const [category, setCategory] = useState('PERFORMANCE')
  const [remarks, setRemarks] = useState('')
  const { message, error, flash, flashError } = useFlash(2500)

  const { data: reports } = useQuery({
    queryKey: ['teamMembers'],
    queryFn: () => api.get('/team/members').then((res) => res.data),
  })

  const rateMutation = useMutation({
    mutationFn: (data) => api.post('/ratings', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ratings'] });
      queryClient.invalidateQueries({ queryKey: ['teamMembers'] });
      setRemarks('');
      flash(`Rating submitted: ${score}/10`);
    },
    onError: (err) => flashError(err.response?.data?.error || 'Failed to submit rating'),
  })

  return (
    <Card>
      <CardHeader title="Rate a team member" subtitle="Ratings are immutable. Each score becomes a permanent record on a 1-10 scale." />
      <CardBody>
        {message && <Banner kind="success" className="mb-3">{message}</Banner>}
        {error && <Banner kind="error" className="mb-3">{error}</Banner>}
        <form onSubmit={(e) => { e.preventDefault(); rateMutation.mutate({ rated_user_id: userId, score, remarks, category }) }} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select label="Member" value={userId} onChange={(e) => setUserId(e.target.value)} required>
              <option value="">Select member…</option>
              {reports?.map((u) => <option key={u.id} value={u.id}>{u.full_name || u.email}</option>)}
            </Select>
            <Select label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
              {RATING_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </Select>
          </div>

          <div>
            <div className="flex items-end justify-between mb-1.5">
              <p id="rate-score-label" className="text-xs font-medium text-fg-muted">Score (1-10)</p>
              <span className="text-2xl font-semibold text-fg tabular-nums">{score}<span className="text-sm text-fg-muted">/10</span></span>
            </div>
            <div className="flex gap-1" role="radiogroup" aria-labelledby="rate-score-label">
              {[1,2,3,4,5,6,7,8,9,10].map((n) => {
                const tone = n >= 8 ? 'bg-emerald-500' : n >= 6 ? 'bg-amber-500' : 'bg-rose-500';
                const active = n <= score;
                return (
                  <button type="button" key={n} onClick={() => setScore(n)}
                          role="radio" aria-checked={score === n} aria-label={`Set score to ${n}`}
                          className={['flex-1 h-10 rounded-md text-sm font-semibold tabular-nums transition-all', active ? `${tone} text-white` : 'bg-surface-sunken text-fg-muted hover:bg-surface-raised'].join(' ')}>
                    {n}
                  </button>
                );
              })}
            </div>
            <div className="flex justify-between text-[10px] text-fg-muted mt-1.5 px-1">
              <span>Needs improvement</span>
              <span>Exceptional</span>
            </div>
          </div>

          <Textarea label="Remarks / feedback" rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Optional context for the rating" />
          <Button type="submit" variant="primary" loading={rateMutation.isPending} disabled={!userId}>
            Submit {score}/10 rating
          </Button>
        </form>
      </CardBody>
    </Card>
  )
}
