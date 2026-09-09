export type HuntStatus = 'ready' | 'active' | 'victory' | 'defeat'
export type BossMove = 'slash' | 'crush' | 'guard'
export type HuntAction = 'strike' | 'guard' | 'dodge' | 'parry'
export type ParryQuality = 'perfect' | 'good' | 'miss'

export type HuntBoss = {
  key: string
  name: string
  title: string
  maxHp: number
  rewardGold: number
  pattern: BossMove[]
  description: string
  trophy: string
}

export type HuntBattleState = {
  bossHp: number
  playerHp: number
  resolve: number
  turn: number
  status: HuntStatus
}

export type HuntTurnResult = HuntBattleState & {
  bossMove: BossMove
  bossDamage: number
  playerDamage: number
  resolveDelta: number
  line: string
}

export type HuntPrepInput = {
  tasks: Array<{ difficulty?: number | null; mustDo?: boolean | null }>
  completedHabits: number
  morningDone: boolean
  mainQuestDone: boolean
}

export type HuntPrep = {
  damage: number
  resolveEarned: number
  rawPower: number
  taskPower: number
  habitPower: number
  ritualPower: number
  mainQuestPower: number
}

export const HUNT_PLAYER_MAX_HP = 5
export const HUNT_RESOLVE_CAP = 4
export const HUNT_PREP_DAMAGE_CAP = 54
export const HUNT_FRESH_FLOOR_HP = 18

const BOSSES: HuntBoss[] = [
  {
    key: 'ash-warden',
    name: 'Ash Warden',
    title: 'Keeper of Unfinished Things',
    maxHp: 72,
    rewardGold: 24,
    pattern: ['slash', 'guard', 'crush', 'slash'],
    description: 'A black-armored sentinel carrying every half-finished promise like soot on its blade.',
    trophy: 'Cinder-Sealed Sigil',
  },
  {
    key: 'briar-knight',
    name: 'Briar Knight',
    title: 'The Road That Closes',
    maxHp: 78,
    rewardGold: 27,
    pattern: ['guard', 'slash', 'crush', 'guard', 'slash'],
    description: 'Thorns knit themselves into armor wherever hesitation leaves room for them to grow.',
    trophy: 'Broken Briar Spur',
  },
  {
    key: 'hollow-stag',
    name: 'Hollow Stag',
    title: 'Antlered Silence',
    maxHp: 68,
    rewardGold: 23,
    pattern: ['crush', 'slash', 'slash', 'guard'],
    description: 'A pale forest thing with a cathedral of empty antlers and footsteps that make the road forget itself.',
    trophy: 'Moon-Pale Antler Shard',
  },
  {
    key: 'gilded-maw',
    name: 'Gilded Maw',
    title: 'Hunger Wearing a Crown',
    maxHp: 82,
    rewardGold: 30,
    pattern: ['slash', 'crush', 'guard', 'crush'],
    description: 'Its teeth are gold, its appetite endless, and every distraction looks valuable until it is swallowed.',
    trophy: 'Gilded Fang',
  },
  {
    key: 'bellkeeper',
    name: 'The Bellkeeper',
    title: 'Caller of False Urgency',
    maxHp: 76,
    rewardGold: 26,
    pattern: ['guard', 'crush', 'slash', 'slash'],
    description: 'It rings for everything at once until nothing can be heard clearly enough to matter.',
    trophy: 'Cracked Urgency Bell',
  },
  {
    key: 'pale-hound',
    name: 'Pale Hound',
    title: 'The One That Chases Drift',
    maxHp: 70,
    rewardGold: 24,
    pattern: ['slash', 'slash', 'crush', 'guard'],
    description: 'Fast, patient, and always just behind the moment when attention starts to wander.',
    trophy: 'Pale Hound Claw',
  },
  {
    key: 'oathbreaker',
    name: 'Oathbreaker',
    title: 'Echo of the Easy Exit',
    maxHp: 84,
    rewardGold: 32,
    pattern: ['crush', 'guard', 'slash', 'crush', 'slash'],
    description: 'A tall shade assembled from abandoned vows. It expects you to leave before the fight is finished.',
    trophy: 'Shard of the Broken Oath',
  },
]

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

export function hashHuntSeed(value: string): number {
  let hash = 2166136261
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function bossForDate(dateKey: string): HuntBoss {
  return BOSSES[hashHuntSeed(dateKey) % BOSSES.length]
}

export function getHuntBoss(key: string): HuntBoss | undefined {
  return BOSSES.find((boss) => boss.key === key)
}

export function computeHuntPrep(input: HuntPrepInput): HuntPrep {
  const taskPower = input.tasks.reduce((sum, task) => {
    const difficulty = clamp(Math.round(Number(task.difficulty || 1)), 1, 5)
    return sum + difficulty * 6 + (task.mustDo ? 3 : 0)
  }, 0)
  const habitPower = Math.max(0, Math.floor(input.completedHabits)) * 7
  const ritualPower = input.morningDone ? 6 : 0
  const mainQuestPower = input.mainQuestDone ? 12 : 0
  const rawPower = taskPower + habitPower + ritualPower + mainQuestPower

  return {
    damage: Math.min(HUNT_PREP_DAMAGE_CAP, rawPower),
    resolveEarned: Math.min(HUNT_RESOLVE_CAP, Math.floor(rawPower / 18)),
    rawPower,
    taskPower,
    habitPower,
    ritualPower,
    mainQuestPower,
  }
}

export function bossMoveForTurn(boss: HuntBoss, dateKey: string, turn: number): BossMove {
  const offset = hashHuntSeed(`${dateKey}:${boss.key}`) % boss.pattern.length
  return boss.pattern[(offset + Math.max(0, turn)) % boss.pattern.length]
}

export function telegraphForMove(move: BossMove): string {
  if (move === 'slash') return 'Its weight shifts forward. A fast edge is coming.'
  if (move === 'crush') return 'It raises everything it has. Do not meet this blow head-on.'
  return 'Its stance closes. The creature is hiding behind its guard.'
}

export function actionCost(action: HuntAction): number {
  return action === 'dodge' || action === 'parry' ? 1 : 0
}

export function resolveHuntTurn(opts: {
  boss: HuntBoss
  dateKey: string
  state: HuntBattleState
  action: HuntAction
  parryQuality?: ParryQuality
}): HuntTurnResult {
  const { boss, dateKey, state, action } = opts
  const bossMove = bossMoveForTurn(boss, dateKey, state.turn)
  const cost = actionCost(action)
  if (state.status === 'victory' || state.status === 'defeat') {
    return {
      ...state,
      bossMove,
      bossDamage: 0,
      playerDamage: 0,
      resolveDelta: 0,
      line: state.status === 'victory' ? 'The hunt is already won.' : 'The hunt is already over.',
    }
  }
  if (state.resolve < cost) {
    throw new Error('Not enough Resolve for that move.')
  }

  let bossDamage = 0
  let playerDamage = 0
  let resolveDelta = -cost
  let line = ''

  if (action === 'strike') {
    if (bossMove === 'guard') {
      bossDamage = 4
      line = 'Your strike bites into the guard, but most of the force is swallowed.'
    } else if (bossMove === 'slash') {
      bossDamage = 10
      playerDamage = 1
      line = 'You trade steel for steel. It hurts, but your blow lands harder.'
    } else {
      bossDamage = 12
      playerDamage = 2
      line = 'You attack through the crushing swing. Reckless — and effective.'
    }
  } else if (action === 'guard') {
    if (bossMove === 'slash') {
      bossDamage = 3
      line = 'You catch the quick edge and answer with a short counter.'
    } else if (bossMove === 'crush') {
      playerDamage = 1
      resolveDelta += 1
      line = 'The heavy blow drives you backward, but you keep your feet and gather yourself.'
    } else {
      bossDamage = 5
      resolveDelta += 1
      line = 'Neither side commits. You press into its guard and steal the initiative.'
    }
  } else if (action === 'dodge') {
    if (bossMove === 'crush') {
      bossDamage = 14
      line = 'You slip outside the crushing arc and punish the enormous opening.'
    } else if (bossMove === 'slash') {
      bossDamage = 5
      line = 'You clear the fast edge and clip it on the way past.'
    } else {
      bossDamage = 6
      line = 'You circle the closed stance and strike where the armor cannot follow.'
    }
  } else {
    const quality = opts.parryQuality || 'miss'
    if (bossMove === 'slash') {
      if (quality === 'perfect') {
        bossDamage = 18
        line = 'Perfect parry. The edge breaks off your timing and the counter lands clean.'
      } else if (quality === 'good') {
        bossDamage = 12
        line = 'The parry catches late, but it catches. You turn the blade and answer.'
      } else {
        playerDamage = 1
        line = 'The timing slips. The fast edge gets through.'
      }
    } else if (bossMove === 'crush') {
      if (quality === 'perfect') {
        bossDamage = 6
        playerDamage = 1
        line = 'You cannot truly parry that much force, but perfect timing turns disaster into a glancing blow.'
      } else if (quality === 'good') {
        playerDamage = 1
        line = 'You deflect part of the impact, but there is too much weight behind it.'
      } else {
        playerDamage = 2
        line = 'The heavy strike crashes straight through the attempted parry.'
      }
    } else {
      if (quality === 'perfect') {
        bossDamage = 7
        line = 'You read the false opening, refuse the bait, and crack the guard instead.'
      } else {
        line = 'You wait for a blow that never comes. The guard holds.'
      }
    }
  }

  const bossHp = clamp(state.bossHp - bossDamage, 0, boss.maxHp)
  const playerHp = clamp(state.playerHp - playerDamage, 0, HUNT_PLAYER_MAX_HP)
  const resolve = clamp(state.resolve + resolveDelta, 0, HUNT_RESOLVE_CAP)
  const status: HuntStatus = bossHp <= 0 ? 'victory' : playerHp <= 0 ? 'defeat' : 'active'

  return {
    bossHp,
    playerHp,
    resolve,
    turn: state.turn + 1,
    status,
    bossMove,
    bossDamage,
    playerDamage,
    resolveDelta,
    line,
  }
}
