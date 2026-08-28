import { useState } from 'react'
import { cn } from '@/lib/utils'

type UserAvatarProps = {
  name: string
  avatarUrl?: string | null
  className?: string
}

function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  const first = words[0][0]
  const last = words.length > 1 ? words[words.length - 1][0] : ''
  return (first + last).toUpperCase()
}

/**
 * Round profile image; falls back to initials when no avatar_url is set or
 * the image fails to load. Size via className (defaults to size-6).
 */
export function UserAvatar({ name, avatarUrl, className }: UserAvatarProps) {
  // Track the failing URL (not a boolean) so a reused instance recovers when
  // it re-renders with a different user's avatar.
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const showImage = !!avatarUrl && avatarUrl !== failedUrl

  if (showImage) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        onError={() => setFailedUrl(avatarUrl)}
        className={cn('size-6 shrink-0 rounded-full object-cover', className)}
      />
    )
  }

  return (
    <span
      aria-hidden
      className={cn(
        'flex items-center justify-center rounded-full bg-primary font-medium text-primary-foreground select-none size-6 text-[14px]',
        className,
      )}
    >
      {initialsOf(name)}
    </span>
  )
}
