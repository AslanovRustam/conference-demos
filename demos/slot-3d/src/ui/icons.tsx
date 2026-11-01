const base = { width: '1em', height: '1em', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

export const SpinIcon = () => (
  <svg {...base} strokeWidth={2.4}>
    <path d="M20 12a8 8 0 0 1-13.7 5.6" />
    <path d="M4 12a8 8 0 0 1 13.7-5.6" />
    <path d="M18 2.5v4.3h-4.3" />
    <path d="M6 21.5v-4.3h4.3" />
  </svg>
)

export const BoltIcon = () => (
  <svg {...base}>
    <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
  </svg>
)

export const AutoIcon = () => (
  <svg {...base}>
    <path d="M17 2l3 3-3 3" />
    <path d="M3 11V9a4 4 0 0 1 4-4h13" />
    <path d="M7 22l-3-3 3-3" />
    <path d="M21 13v2a4 4 0 0 1-4 4H4" />
  </svg>
)

export const SoundIcon = ({ muted }: { muted: boolean }) => (
  <svg {...base}>
    <path d="M11 5 6 9H2v6h4l5 4z" />
    {muted ? (
      <>
        <path d="m22 9-6 6" />
        <path d="m16 9 6 6" />
      </>
    ) : (
      <>
        <path d="M15.5 8.5a5 5 0 0 1 0 7" />
        <path d="M19 5a10 10 0 0 1 0 14" />
      </>
    )}
  </svg>
)

/** corners pointing out to go fullscreen, pointing in to leave it */
export const FullscreenIcon = ({ active }: { active: boolean }) => (
  <svg {...base}>
    <path d={active ? 'M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5' : 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5'} />
  </svg>
)

export const ExitIcon = () => (
  <svg {...base}>
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
)
