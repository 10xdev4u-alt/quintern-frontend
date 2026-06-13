import { NavLink } from 'react-router-dom'

// Bottom-tab navigation shown on mobile. Includes only the most-used routes
// to avoid crowding the bar — full nav lives in the drawer.
const ITEMS = [
  { path: '/', label: 'Home', icon: 'home' },
  { path: '/projects', label: 'Projects', icon: 'board' },
  { path: '/team', label: 'Team', icon: 'users', managerOnly: true },
  { path: '/attendance', label: 'Attend.', icon: 'calendar' },
  { path: '/tasks', label: 'Tasks', icon: 'target' },
  { path: '/notifications', label: 'Inbox', icon: 'bell' },
];

const ICONS = {
  home: <path d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1h-5v-7h-6v7H4a1 1 0 01-1-1v-9.5z" />,
  users: <><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" /></>,
  calendar: <><path d="M8 2v3M16 2v3M3.5 9.09h17M21 8.5V17c0 3-1.5 5-5 5H8c-3.5 0-5-2-5-5V8.5c0-3 1.5-5 5-5h8c3.5 0 5 2 5 5z" /></>,
  target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" /></>,
  bell: <><path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" /></>,
  board: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 7v10M15 7v6" /></>,
};

export function MobileNav({ isManager }) {
  const items = isManager ? ITEMS : ITEMS.filter((i) => i.path !== '/team');
  return (
    <nav aria-label="Mobile navigation" className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-surface-raised/90 backdrop-blur-md border-t border-border safe-bottom">
      <ul className="grid" style={{ gridTemplateColumns: `repeat(${items.length}, 1fr)` }}>
        {items.map((it) => (
          <li key={it.path}>
            <NavLink to={it.path} end={it.path === '/'}
                     className={({ isActive }) => [
                       'flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors',
                       isActive ? 'text-fg' : 'text-fg-muted hover:text-fg',
                     ].join(' ')}>
              {({ isActive }) => (
                <>
                  <div className="relative">
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={isActive ? 2.25 : 1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      {ICONS[it.icon]}
                    </svg>
                    {isActive && <span className="absolute -top-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-fg" />}
                  </div>
                  <span>{it.label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
