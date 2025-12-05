import { useEffect, useRef, useState } from 'react'
import './App.css'
import MAP_FRAGMENTS from './data/mapLayout.json'

const MAP_LAYOUT = MAP_FRAGMENTS[0].fragmentLayout

const START_TILE = (() => {
  for (let y = 0; y < MAP_LAYOUT.length; y++) {
    const x = MAP_LAYOUT[y].indexOf('S')
    if (x !== -1) return { x, y }
  }
  return { x: 1, y: 1 }
})()

const START_POSITION = {
  x: START_TILE.x + 0.5,
  y: START_TILE.y + 0.5,
}

const TILE_TYPES = {
  '#': { key: 'wall', label: 'Wall', color: '#8b6d4b' },
  '.': { key: 'trail', label: 'Trail', color: '#d8d4c0' },
  S: { key: 'start', label: 'Starting Point', color: '#fcd34d' },
  E: { key: 'entrance', label: 'Cave Entrance', color: '#a3bffa' },
  G: { key: 'grass', label: 'Tall Grass', color: '#4caf50' },
  W: { key: 'water', label: 'Water', color: '#78c7ff' },
  T: { key: 'town', label: 'Town Plaza', color: '#f2b8b5' },
  X: { key: 'trainer', label: 'Trainer', color: '#f59e0b' },
}

const DEFAULT_TILE = TILE_TYPES['.']

const VIEWPORT = { width: 32, height: 18 }

const MOVEMENT_SPEED = 3.2

const FACING_DELTAS = {
  up: { dx: 0, dy: -1 },
  right: { dx: 1, dy: 0 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
}

const facingKeys = Object.keys(FACING_DELTAS)

const getRandomFacing = () => facingKeys[Math.floor(Math.random() * facingKeys.length)]

const getTileCharAt = (x, y) => {
  const tileY = Math.floor(y)
  const tileX = Math.floor(x)
  return MAP_LAYOUT[tileY]?.[tileX]
}

const initializeTrainers = () => {
  const trainers = []
  MAP_LAYOUT.forEach((row, y) => {
    row.split('').forEach((char, x) => {
      if (char === 'X') {
        trainers.push({ id: `${x}-${y}`, x, y, facing: getRandomFacing(), defeated: false })
      }
    })
  })
  return trainers
}

const CREATURE_LIBRARY = [
  {
    name: 'Sparkwisp',
    type: 'Storm',
    color: '#fcd34d',
    abilities: [
      { name: 'Jolt', power: 6 },
      { name: 'Thunder Dash', power: 9 },
    ],
  },
  {
    name: 'Pebblum',
    type: 'Stone',
    color: '#a8a29e',
    abilities: [
      { name: 'Rock Toss', power: 5 },
      { name: 'Quake Pulse', power: 8 },
    ],
  },
  {
    name: 'Feralume',
    type: 'Flare',
    color: '#fb7185',
    abilities: [
      { name: 'Ember Flick', power: 6 },
      { name: 'Radiant Roar', power: 10 },
    ],
  },
  {
    name: 'Mistrine',
    type: 'Gale',
    color: '#7dd3fc',
    abilities: [
      { name: 'Feather Cut', power: 5 },
      { name: 'Gust Spiral', power: 8 },
    ],
  },
]

const MAX_HP_BASE = 28

function createCreature(seedIndex = 0) {
  const base = CREATURE_LIBRARY[seedIndex % CREATURE_LIBRARY.length]
  const level = 3 + Math.floor(Math.random() * 3)
  const maxHp = MAX_HP_BASE + level * 2
  return {
    id: crypto.randomUUID(),
    ...base,
    level,
    maxHp,
    hp: maxHp,
  }
}

function App() {
  const [playerPosition, setPlayerPosition] = useState(() => ({ ...START_POSITION }))
  const playerPositionRef = useRef(playerPosition)
  const pressedKeysRef = useRef(new Set())
  const [camera, setCamera] = useState(() => ({
    x: Math.min(Math.max(START_POSITION.x - VIEWPORT.width / 2, 0), MAP_LAYOUT[0].length - VIEWPORT.width),
    y: Math.min(Math.max(START_POSITION.y - VIEWPORT.height / 2, 0), MAP_LAYOUT.length - VIEWPORT.height),
  }))
  const [, setMessageLog] = useState([
    'You arrive at the Sunpetal Isles—creatures hum with energy in the grass.',
    'Use the arrow keys or WASD to explore. Step into grass to trigger a battle, and watch for trainers.',
  ])
  const [battle, setBattle] = useState({ active: false, opponent: null, trainerId: null })
  const [screen, setScreen] = useState('menu')
  const [showNewGameForm, setShowNewGameForm] = useState(false)
  const [seedInput, setSeedInput] = useState('')
  const [activeSeed, setActiveSeed] = useState('')
  const [team, setTeam] = useState(() => [createCreature(0), createCreature(1)])
  const [activeMember, setActiveMember] = useState(0)
  const [turn, setTurn] = useState('player')
  const [isPaused, setIsPaused] = useState(false)
  const [backpackOpen, setBackpackOpen] = useState(false)
  const [trainers, setTrainers] = useState(() => initializeTrainers())
  const rotationTimers = useRef({})

  const mapHeight = MAP_LAYOUT.length
  const mapWidth = MAP_LAYOUT[0].length
  const playerTile = {
    x: Math.floor(playerPosition.x),
    y: Math.floor(playerPosition.y),
  }

  useEffect(() => {
    playerPositionRef.current = playerPosition
  }, [playerPosition])

  useEffect(() => {
    if (battle.active || isPaused || backpackOpen || screen !== 'playing') {
      pressedKeysRef.current.clear()
    }
  }, [backpackOpen, battle.active, isPaused, screen])

  useEffect(() => {
    const movementKeys = new Set(['arrowup', 'w', 'arrowdown', 's', 'arrowleft', 'a', 'arrowright', 'd'])

    const handleKeyDown = (event) => {
      const key = event.key.toLowerCase()

      if (screen !== 'playing') return

      if (key === 'escape') {
        event.preventDefault()
        setIsPaused((prev) => !prev)
        setBackpackOpen(false)
        pressedKeysRef.current.clear()
        return
      }

      if (key === 'p') {
        event.preventDefault()
        setBackpackOpen((prev) => !prev)
        setIsPaused(false)
        pressedKeysRef.current.clear()
        return
      }

      if (battle.active || isPaused || backpackOpen) return

      if (movementKeys.has(key)) {
        event.preventDefault()
        pressedKeysRef.current.add(key)
      }
    }

    const handleKeyUp = (event) => {
      const key = event.key.toLowerCase()
      if (movementKeys.has(key)) {
        event.preventDefault()
        pressedKeysRef.current.delete(key)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [backpackOpen, battle.active, isPaused, screen])

  useEffect(() => {
    let animationId = null
    let lastTimestamp = performance.now()

    const deltas = {
      arrowup: { dx: 0, dy: -1 },
      w: { dx: 0, dy: -1 },
      arrowdown: { dx: 0, dy: 1 },
      s: { dx: 0, dy: 1 },
      arrowleft: { dx: -1, dy: 0 },
      a: { dx: -1, dy: 0 },
      arrowright: { dx: 1, dy: 0 },
      d: { dx: 1, dy: 0 },
    }

    const step = (timestamp) => {
      const elapsedSeconds = Math.min(0.05, (timestamp - lastTimestamp) / 1000)
      lastTimestamp = timestamp

      if (!battle.active && !isPaused && !backpackOpen && screen === 'playing') {
        let dx = 0
        let dy = 0

        pressedKeysRef.current.forEach((key) => {
          const delta = deltas[key]
          if (delta) {
            dx += delta.dx
            dy += delta.dy
          }
        })

        if (dx !== 0 || dy !== 0) {
          const length = Math.hypot(dx, dy) || 1
          const normalizedDx = dx / length
          const normalizedDy = dy / length
          const distance = MOVEMENT_SPEED * elapsedSeconds

          movePlayer({ dx: normalizedDx, dy: normalizedDy, distance })
        }
      }

      animationId = requestAnimationFrame(step)
    }

    animationId = requestAnimationFrame(step)

    return () => cancelAnimationFrame(animationId)
  }, [backpackOpen, battle.active, isPaused, screen])

  useEffect(() => {
    const trainerIds = new Set(trainers.map((trainer) => trainer.id))
    Object.entries(rotationTimers.current).forEach(([trainerId, timeoutId]) => {
      if (!trainerIds.has(trainerId)) {
        clearTimeout(timeoutId)
        delete rotationTimers.current[trainerId]
      }
    })

    trainers.forEach((trainer) => {
      const existingTimer = rotationTimers.current[trainer.id]
      if (trainer.defeated) {
        if (existingTimer) {
          clearTimeout(existingTimer)
          delete rotationTimers.current[trainer.id]
        }
        return
      }

      if (existingTimer) return

      const scheduleRotation = () => {
        const delay = 5000 + Math.random() * 5000
        rotationTimers.current[trainer.id] = setTimeout(() => {
          setTrainers((prev) =>
            prev.map((t) => (t.id === trainer.id ? { ...t, facing: getRandomFacing() } : t))
          )
          delete rotationTimers.current[trainer.id]
        }, delay)
      }

      scheduleRotation()
    })
  }, [trainers])

  useEffect(
    () => () => {
      Object.values(rotationTimers.current).forEach((timeoutId) => clearTimeout(timeoutId))
      rotationTimers.current = {}
    },
    []
  )

  useEffect(() => {
    if (battle.active || isPaused || backpackOpen) return

    const watcher = trainers.find((trainer) => isPlayerInTrainerSight(trainer))
    if (watcher) {
      startTrainerBattle(watcher)
    }
  }, [backpackOpen, battle.active, isPaused, playerPosition, trainers])

  const addMessage = (msg) => {
    setMessageLog((prev) => [msg, ...prev].slice(0, 6))
  }

  const markTrainerDefeated = (trainerId) => {
    setTrainers((prev) =>
      prev.map((trainer) => (trainer.id === trainerId ? { ...trainer, defeated: true } : trainer))
    )
  }

  const isPlayerInTrainerSight = (trainer) => {
    if (trainer.defeated) return false

    const delta = FACING_DELTAS[trainer.facing]
    const playerTileX = Math.floor(playerPosition.x)
    const playerTileY = Math.floor(playerPosition.y)
    for (let step = 1; step <= 3; step++) {
      const checkX = trainer.x + delta.dx * step
      const checkY = trainer.y + delta.dy * step

      if (checkX < 0 || checkY < 0 || checkX >= mapWidth || checkY >= mapHeight) break
      if (MAP_LAYOUT[checkY][checkX] === '#') break
      if (playerTileX === checkX && playerTileY === checkY) return true
    }

    return false
  }

  const startTrainerBattle = (trainer) => {
    const foeIndex = Math.floor(Math.random() * CREATURE_LIBRARY.length)
    const rival = createCreature(foeIndex)
    setBattle({ active: true, opponent: rival, trainerId: trainer.id })
    setTurn('player')
    addMessage('A trainer challenges you to a duel!')
  }

  const healTeam = () => {
    setTeam((prev) => prev.map((member) => ({ ...member, hp: member.maxHp })))
  }

  const openBattle = () => {
    const wildIndex = Math.floor(Math.random() * CREATURE_LIBRARY.length)
    const wild = createCreature(wildIndex)
    setBattle({ active: true, opponent: wild, trainerId: null })
    setTurn('player')
    addMessage(`A wild ${wild.name} appeared!`)
  }

  const handleTileEntry = (tileChar) => {
    if (tileChar === 'T') {
      healTeam()
      addMessage('A warm lantern light heals your team in the plaza.')
      return
    }

    if (tileChar === 'G' && Math.random() < 0.35) {
      openBattle()
    }
  }

  const movePlayer = ({ dx, dy, distance }) => {
    setPlayerPosition((prev) => {
      const nextX = prev.x + dx * distance
      const nextY = prev.y + dy * distance

      if (nextX < 0.25 || nextY < 0.25 || nextX >= mapWidth - 0.25 || nextY >= mapHeight - 0.25) {
        return prev
      }

      const nextTileChar = getTileCharAt(nextX, nextY)
      if (!nextTileChar || nextTileChar === '#') return prev

      const enteredNewTile =
        Math.floor(prev.x) !== Math.floor(nextX) || Math.floor(prev.y) !== Math.floor(nextY)

      if (enteredNewTile) {
        handleTileEntry(nextTileChar)
      }

      return { x: nextX, y: nextY }
    })
  }

  const closeBattle = (resultMessage, defeatedTrainerId = null) => {
    if (defeatedTrainerId) {
      markTrainerDefeated(defeatedTrainerId)
    }
    addMessage(resultMessage)
    setBattle({ active: false, opponent: null, trainerId: null })
    setTurn('player')
  }

  const currentMember = team[activeMember]
  const isTrainerBattle = Boolean(battle.trainerId)

  const handleAbility = (ability) => {
    if (!battle.active || !battle.opponent) return
    if (turn !== 'player') return

    const damage = Math.max(4, Math.round(ability.power + currentMember.level * 0.8 + Math.random() * 3))
    const updatedOpponentHp = Math.max(0, battle.opponent.hp - damage)
    const updatedOpponent = { ...battle.opponent, hp: updatedOpponentHp }
    setBattle((prev) => ({ ...prev, opponent: updatedOpponent }))
    addMessage(`${currentMember.name} used ${ability.name}! (${damage} dmg) `)

    if (updatedOpponentHp <= 0) {
      awardVictory()
      if (battle.trainerId) {
        closeBattle('The trainer concedes defeat and lets you pass.', battle.trainerId)
      } else {
        closeBattle(`The wild ${battle.opponent.name} was pacified. Your team gained confidence!`)
      }
    } else {
      setTurn('foe')
      setTimeout(() => foeTurn(updatedOpponent), 450)
    }
  }

  const foeTurn = (opponentState) => {
    const foeAbility = opponentState.abilities[Math.floor(Math.random() * opponentState.abilities.length)]
    const damage = Math.max(3, Math.round(foeAbility.power + opponentState.level * 0.7 + Math.random() * 2))
    setTeam((prev) => {
      const updated = [...prev]
      const target = updated[activeMember]
      const newHp = Math.max(0, target.hp - damage)
      updated[activeMember] = { ...target, hp: newHp }
      return updated
    })
    const attackerLabel = isTrainerBattle ? "Trainer's" : 'Wild'
    addMessage(`${attackerLabel} ${opponentState.name} strikes with ${foeAbility.name}! (${damage} dmg) `)

    const targetHp = team[activeMember].hp - damage
    if (targetHp <= 0) {
      const nextAlive = team.findIndex((creature) => creature.hp > 0)
      if (nextAlive === -1) {
        closeBattle('Your team is out of stamina. You retreat to the nearest plaza to recover.')
        healTeam()
        setPlayerPosition({ ...START_POSITION })
      } else {
        setActiveMember(nextAlive)
        addMessage(`${team[activeMember].name} needs rest. ${team[nextAlive].name} steps up!`)
      }
    }

    setTurn('player')
  }

  const awardVictory = () => {
    setTeam((prev) =>
      prev.map((member, index) => {
        if (index !== activeMember) return member
        const nextLevel = member.level + 1
        const nextMaxHp = member.maxHp + 3
        return {
          ...member,
          level: nextLevel,
          maxHp: nextMaxHp,
          hp: Math.min(nextMaxHp, member.hp + 6),
        }
      })
    )
  }

  const handleFlee = () => {
    if (!battle.active) return
    if (isTrainerBattle) {
      closeBattle("You slip away from the trainer's gaze before the battle escalates.")
      return
    }
    closeBattle('You retreat to rethink your approach. The wild creature wanders off.')
  }

  const resetExploration = () => {
    setPlayerPosition({ ...START_POSITION })
    healTeam()
    setMessageLog([
      'Your team regroups at the island gate with renewed focus.',
      'Use the arrow keys or WASD to move. Wander in the grass to find encounters and be wary of trainers.',
    ])
    setBattle({ active: false, opponent: null, trainerId: null })
    setTurn('player')
    setIsPaused(false)
    setBackpackOpen(false)
    setTrainers(initializeTrainers())
  }

  const startNewGame = () => {
    const trimmedSeed = seedInput.trim()
    const generatedSeed = Math.random().toString(36).slice(2, 10)
    const nextSeed = trimmedSeed || generatedSeed
    setActiveSeed(nextSeed)
    resetExploration()
    setScreen('playing')
    setShowNewGameForm(false)
    setSeedInput('')
  }

  const returnToMainMenu = () => {
    resetExploration()
    setScreen('menu')
    setShowNewGameForm(false)
    setSeedInput('')
  }

  useEffect(() => {
    let rafId = null

    const getCameraTarget = () => ({
      x: Math.min(Math.max(playerPositionRef.current.x - VIEWPORT.width / 2, 0), mapWidth - VIEWPORT.width),
      y: Math.min(Math.max(playerPositionRef.current.y - VIEWPORT.height / 2, 0), mapHeight - VIEWPORT.height),
    })

    const smoothFollow = () => {
      const target = getCameraTarget()
      setCamera((prev) => {
        const lerpFactor = 0.2
        const nextX = prev.x + (target.x - prev.x) * lerpFactor
        const nextY = prev.y + (target.y - prev.y) * lerpFactor
        return { x: nextX, y: nextY }
      })

      rafId = requestAnimationFrame(smoothFollow)
    }

    rafId = requestAnimationFrame(smoothFollow)
    return () => cancelAnimationFrame(rafId)
  }, [mapHeight, mapWidth])

  const cameraXInt = Math.floor(camera.x)
  const cameraYInt = Math.floor(camera.y)
  const cameraOffsetX = camera.x - cameraXInt
  const cameraOffsetY = camera.y - cameraYInt

  const visibleWidth = Math.min(VIEWPORT.width + 1, mapWidth - cameraXInt)
  const visibleHeight = Math.min(VIEWPORT.height + 1, mapHeight - cameraYInt)

  const visibleTiles = MAP_LAYOUT.slice(cameraYInt, cameraYInt + visibleHeight).map((row) =>
    row.slice(cameraXInt, cameraXInt + visibleWidth)
  )

  const tileSize = `calc(min(100vw, 100vh * 16 / 9) / ${VIEWPORT.width})`

  return (
    <div className="page">
      <main className="playfield">
        <div
          className="map-viewport"
          style={{
            '--tile-size': tileSize,
            width: `calc(var(--tile-size) * ${VIEWPORT.width})`,
            height: `calc(var(--tile-size) * ${VIEWPORT.height})`,
          }}
        >
          <div
            className="map-grid"
            style={{
              gridTemplateColumns: `repeat(${visibleWidth}, var(--tile-size))`,
              gridTemplateRows: `repeat(${visibleHeight}, var(--tile-size))`,
              transform: `translate3d(calc(-1 * var(--tile-size) * ${cameraOffsetX}), calc(-1 * var(--tile-size) * ${cameraOffsetY}), 0)`,
              width: `calc(var(--tile-size) * ${visibleWidth})`,
              height: `calc(var(--tile-size) * ${visibleHeight})`,
            }}
          >
            {visibleTiles.map((row, yOffset) =>
              row.split('').map((tileChar, xOffset) => {
                const x = cameraXInt + xOffset
                const y = cameraYInt + yOffset
                const tile = TILE_TYPES[tileChar] ?? DEFAULT_TILE
                const trainerOnTile = trainers.find(
                  (trainer) => trainer.x === x && trainer.y === y && !trainer.defeated
                )
                return (
                  <div
                    key={`${x}-${y}`}
                    className={`tile tile-${tile.key}`}
                    style={{ backgroundColor: tile.color }}
                  >
                    {trainerOnTile ? <div className={`trainer facing-${trainerOnTile.facing}`} /> : null}
                  </div>
                )
              })
            )}
            <div
              className="player-entity"
              style={{
                left: `calc(${playerPosition.x - cameraXInt} * var(--tile-size))`,
                top: `calc(${playerPosition.y - cameraYInt} * var(--tile-size))`,
              }}
            />
          </div>
        </div>
      </main>

      {isPaused ? (
        <div className="overlay">
          <div className="overlay-card">
            <p className="eyebrow">Paused</p>
            <h2>Take a breather</h2>
            <p className="sub">Save your progress, revisit a previous journey, or head back out.</p>
            <div className="overlay-actions">
              <button className="secondary" onClick={() => {}}>
                Save Game
              </button>
              <button className="secondary" onClick={() => {}}>
                Load Game
              </button>
              <button className="secondary" onClick={() => setIsPaused(false)}>
                Resume Game
              </button>
              <button className="secondary" onClick={returnToMainMenu}>
                Exit To Main Menu
              </button>
            </div>
            <p className="hint">Press Esc to close the pause menu.</p>
          </div>
        </div>
      ) : null}

      {backpackOpen ? (
        <div className="overlay">
          <div className="overlay-card">
            <p className="eyebrow">Backpack & Party</p>
            <h2>Adjust your companions</h2>
            <p className="sub">Swap the lead partner or check on your team before the next step.</p>
            <div className="overlay-list">
              {team.map((member, index) => (
                <button
                  key={member.id}
                  className={`team-card ${index === activeMember ? 'active' : ''}`}
                  onClick={() => setActiveMember(index)}
                >
                  <div className="avatar" style={{ backgroundColor: member.color }} />
                  <div className="stats">
                    <div className="row">
                      <span className="name">{member.name}</span>
                      <span className="badge">Lv {member.level}</span>
                    </div>
                    <div className="hp-bar">
                      <div className="hp-fill" style={{ width: `${(member.hp / member.maxHp) * 100}%` }} />
                    </div>
                    <div className="row subtle">
                      <span>{member.type} type</span>
                      <span>
                        {member.hp}/{member.maxHp} HP
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <div className="overlay-actions">
              <button className="secondary" onClick={() => setBackpackOpen(false)}>
                Close Backpack
              </button>
            </div>
            <p className="hint">Press P again to close.</p>
          </div>
        </div>
      ) : null}

      {battle.active && battle.opponent ? (
        <div className="battle">
            <div className="battle-card">
              <div className="battle-header">
                <div>
                  <p className="eyebrow">{isTrainerBattle ? 'Trainer Battle' : 'Encounter'}</p>
                  <h2>{isTrainerBattle ? `Trainer's ${battle.opponent.name}` : `Wild ${battle.opponent.name}`}</h2>
                  <p className="sub">
                    {isTrainerBattle
                      ? 'A rival trainer locks eyes with you and steps forward.'
                      : 'A curious creature challenges your lead companion.'}
                  </p>
                </div>
                <button className="secondary" onClick={handleFlee}>
                  Flee
                </button>
              </div>

            <div className="battle-grid">
              <div className="creature foe">
                <div className="avatar" style={{ backgroundColor: battle.opponent.color }} />
                <div className="stats">
                  <div className="row">
                    <span className="name">{battle.opponent.name}</span>
                    <span className="badge">Lv {battle.opponent.level}</span>
                  </div>
                  <div className="hp-bar">
                    <div
                      className="hp-fill"
                      style={{ width: `${(battle.opponent.hp / battle.opponent.maxHp) * 100}%` }}
                    />
                  </div>
                  <div className="row subtle">
                    <span>{battle.opponent.type} spirit</span>
                    <span>
                      {battle.opponent.hp}/{battle.opponent.maxHp} HP
                    </span>
                  </div>
                </div>
              </div>

              <div className="creature ally">
                <div className="avatar" style={{ backgroundColor: currentMember.color }} />
                <div className="stats">
                  <div className="row">
                    <span className="name">{currentMember.name}</span>
                    <span className="badge">Lv {currentMember.level}</span>
                  </div>
                  <div className="hp-bar">
                    <div
                      className="hp-fill"
                      style={{ width: `${(currentMember.hp / currentMember.maxHp) * 100}%` }}
                    />
                  </div>
                  <div className="row subtle">
                    <span>{currentMember.type} partner</span>
                    <span>
                      {currentMember.hp}/{currentMember.maxHp} HP
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="actions">
              <p className="eyebrow">Turn</p>
              <div className="action-grid">
                {currentMember.abilities.map((ability) => (
                  <button
                    key={ability.name}
                    className="action"
                    onClick={() => handleAbility(ability)}
                    disabled={turn !== 'player' || currentMember.hp <= 0}
                  >
                    <strong>{ability.name}</strong>
                    <span className="subtle">Power {ability.power}</span>
                  </button>
                ))}
                <button className="action utility" onClick={handleFlee}>
                  <strong>Retreat</strong>
                  <span className="subtle">Leave the encounter</span>
                </button>
              </div>
              {turn !== 'player' ? <p className="hint">The wild creature is preparing a move…</p> : null}
            </div>
          </div>
        </div>
      ) : null}

      {screen === 'menu' ? (
        <div className="overlay">
          <div className="overlay-card menu-card">
            <p className="eyebrow">Codex Quest</p>
            <h1>Welcome back, explorer</h1>
            <p className="sub">Start a fresh journey or pick up from an earlier save.</p>

            <div className="menu-actions">
              <button
                className="primary"
                onClick={() => setShowNewGameForm(true)}
              >
                New Game
              </button>
              <button className="secondary" onClick={() => {}}>
                Load Game
              </button>
            </div>

            {showNewGameForm ? (
              <div className="new-game-form">
                <label className="input-group">
                  <span>Seed</span>
                  <input
                    type="text"
                    placeholder="Leave blank for a random seed"
                    value={seedInput}
                    onChange={(event) => setSeedInput(event.target.value)}
                  />
                </label>
                <div className="form-actions">
                  <button className="primary" onClick={startNewGame}>
                    Start Game
                  </button>
                  {activeSeed ? (
                    <p className="hint">Last used seed: {activeSeed}</p>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="letterbox" aria-hidden="true" />
    </div>
  )
}

export default App
