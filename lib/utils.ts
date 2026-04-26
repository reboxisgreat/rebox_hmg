export const ADMIN_USERNAMES = ['rebox', 'test']

export function isAdminUser(): boolean {
  if (typeof window === 'undefined') return false
  const username = localStorage.getItem('participant_username') ?? ''
  return ADMIN_USERNAMES.includes(username)
}

export function isEducationEnded(): boolean {
  const endDate = process.env.NEXT_PUBLIC_EDUCATION_END_DATE
  if (!endDate) return false
  return new Date() > new Date(endDate)
}
