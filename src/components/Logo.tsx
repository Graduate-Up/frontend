type LogoProps = {
  /** 어두운 배경 위에서 쓸 때 */
  onDark?: boolean
  /** 글자 크기(px). 작은 크기에선 술(tassel)을 뺀다 */
  size?: number
}

/** 졸UP 워드마크 + 학사모 */
export function Logo({ onDark = false, size = 28 }: LogoProps) {
  const withTassel = size >= 40
  const capWidth = size * 1.1

  return (
    <span
      aria-label="졸UP"
      style={{
        display: 'inline-flex',
        alignItems: 'flex-end',
        fontWeight: 900,
        fontSize: size,
        lineHeight: 1,
        letterSpacing: '-0.04em',
      }}
    >
      <span style={{ color: onDark ? '#fff' : 'var(--color-ink)' }}>졸</span>
      <span style={{ position: 'relative', color: onDark ? 'var(--color-periwinkle)' : 'var(--color-navy)' }}>
        <svg
          viewBox="0 0 44 20"
          width={capWidth}
          aria-hidden
          style={{ position: 'absolute', left: '50%', bottom: '100%', transform: 'translate(-50%, 15%)' }}
        >
          <path d="M22 0 0 7l22 7 22-7z" fill={onDark ? '#5fd3c2' : 'var(--color-teal)'} />
          <path d="M11 10.5v4c0 2.2 5 4 11 4s11-1.8 11-4v-4l-11 3.5z" fill="var(--color-teal-dark)" />
          {withTassel && (
            <>
              <path d="M39 8.5v7" stroke="var(--color-teal-dark)" strokeWidth="1.2" />
              <circle cx="39" cy="16.5" r="1.6" fill="var(--color-teal-dark)" />
            </>
          )}
        </svg>
        UP
      </span>
    </span>
  )
}
