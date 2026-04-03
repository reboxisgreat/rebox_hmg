import { NextRequest, NextResponse } from 'next/server'

export function middleware(req: NextRequest) {
  const endDate = process.env.NEXT_PUBLIC_EDUCATION_END_DATE
  const { pathname } = req.nextUrl

  const excluded = ['/closed', '/admin', '/api']
  if (excluded.some((path) => pathname.startsWith(path))) {
    return NextResponse.next()
  }

  if (endDate && new Date() > new Date(endDate)) {
    return NextResponse.redirect(new URL('/closed', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
