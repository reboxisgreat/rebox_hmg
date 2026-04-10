import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '리더스러닝랩 xClass 조직관리 과정',
    short_name: 'xClass',
    icons: [
      {
        src: '/dog-character.jpg',
        sizes: 'any',
        type: 'image/jpeg',
      },
    ],
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#ffffff',
  }
}
