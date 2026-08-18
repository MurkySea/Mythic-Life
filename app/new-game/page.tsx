import type { Metadata } from 'next'
import IntroStory from './IntroStory'
import { NEW_GAME_PROLOGUE } from '@/lib/intro-story'

export const metadata: Metadata = {
  title: 'New Game | Mythic Life',
  description: 'The prologue to a new Mythic Life journey.',
}

export default function NewGamePage() {
  return <IntroStory scenes={NEW_GAME_PROLOGUE} />
}
