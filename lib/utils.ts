export function isEducationEnded(): boolean {
  const endDate = process.env.NEXT_PUBLIC_EDUCATION_END_DATE
  if (!endDate) return false
  return new Date() > new Date(endDate)
}
