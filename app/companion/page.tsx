import { redirect } from 'next/navigation'

export default async function CompanionPage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>
}) {
  const params = await searchParams
  const slug = params.c || 'seraphine'
  redirect(`/companion-profile?c=${encodeURIComponent(slug)}`)
}
