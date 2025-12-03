import { useEffect, useMemo, useState } from 'react'
import './App.css'

const TILE_TYPES = {
  '#': { key: 'wall', label: 'Wall', color: '#8b6d4b' },
  '.': { key: 'trail', label: 'Trail', color: '#d8d4c0' },
  G: { key: 'grass', label: 'Tall Grass', color: '#4caf50' },
  W: { key: 'water', label: 'Water', color: '#78c7ff' },
  T: { key: 'town', label: 'Town Plaza', color: '#f2b8b5' },
}

const MAP_LAYOUT = [
  '########################################',
  '#....G....G...T.....GG....G.....G......#',
  '#..GG..###..G......###...G......GG.....#',
  '#......#..G.....G.....G..#..T......G...#',
  '#..T...#...G...#####....#..GG.....#....#',
  '#......#..GG...#...#....#..G...#..#..G.#',
  '#..GG..#..G....#...#..G.#......#..#....#',
  '#......#.......#...####.#..G...#..#....#',
  '#...G..#..T....#........#......#..#....#',
  '#......#.......#..GG....#..G...#..#....#',
  '#..GG.....G....#...#....#......#..#....#',
  '#.....#####....#...#....#..T...#..#....#',
  '#....G.....G...#...###..#......#..#..G.#',
  '#..GG..#..G....#.......G#...G..#..#....#',
  '#......#..G....#..T.....#......#..#....#',
  '#..T...#...G...#........#..GG..#..#....#',
  '#......#..GG...#..G.....#......#..#....#',
  '#..GG..#..G....#........#..G...#..#..G.#',
  '#......#.......#..GG....#......#..#....#',
  '#...G..#..T....#...#....#..T...#..#....#',
  '#......#.......#...#....#......#..#....#',
  '#..GG.....G....#...#....#..G...#..#....#',
  '#.....#####....#...#....#......#..#....#',
  '########################################',
]

const VIEWPORT = { width: 32, height: 18 }

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
  const [playerPosition, setPlayerPosition] = useState({ x: 1, y: 1 })
  const [messageLog, setMessageLog] = useState([
    'You arrive at the Sunpetal Isles—creatures hum with energy in the grass.',
    'Use the arrow keys or WASD to explore. Step into grass to trigger a battle.',
  ])
  const [battle, setBattle] = useState({ active: false, opponent: null })
  const [team, setTeam] = useState(() => [createCreature(0), createCreature(1)])
  const [activeMember, setActiveMember] = useState(0)
  const [turn, setTurn] = useState('player')
  const [isPaused, setIsPaused] = useState(false)
  const [backpackOpen, setBackpackOpen] = useState(false)

  const mapHeight = MAP_LAYOUT.length
  const mapWidth = MAP_LAYOUT[0].length

  const currentTile = useMemo(() => {
    const row = MAP_LAYOUT[playerPosition.y]
    const tileChar = row?.[playerPosition.x] ?? '#'
    return TILE_TYPES[tileChar] || TILE_TYPES['.']
  }, [playerPosition])

  useEffect(() => {
    const handleKey = (event) => {
      const key = event.key.toLowerCase()

      if (key === 'escape') {
        event.preventDefault()
        setIsPaused((prev) => !prev)
        setBackpackOpen(false)
        return
      }

      if (key === 'p') {
        event.preventDefault()
        setBackpackOpen((prev) => !prev)
        setIsPaused(false)
        return
      }

      if (battle.active || isPaused || backpackOpen) return

      const direction = key
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

      const delta = deltas[direction]
      if (!delta) return

      event.preventDefault()
      movePlayer(delta)
    }

    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [battle.active, backpackOpen, isPaused, playerPosition])

  const addMessage = (msg) => {
    setMessageLog((prev) => [msg, ...prev].slice(0, 6))
  }

  const movePlayer = ({ dx, dy }) => {
    const nextX = playerPosition.x + dx
    const nextY = playerPosition.y + dy

    if (nextX < 0 || nextY < 0 || nextX >= mapWidth || nextY >= mapHeight) return

    const tileChar = MAP_LAYOUT[nextY][nextX]
    if (tileChar === '#') return

    setPlayerPosition({ x: nextX, y: nextY })

    if (tileChar === 'T') {
      healTeam()
      addMessage('A warm lantern light heals your team in the plaza.')
      return
    }

    if (tileChar === 'G' && Math.random() < 0.35) {
      openBattle()
    }
  }

  const healTeam = () => {
    setTeam((prev) => prev.map((member) => ({ ...member, hp: member.maxHp })))
  }

  const openBattle = () => {
    const wildIndex = Math.floor(Math.random() * CREATURE_LIBRARY.length)
    const wild = createCreature(wildIndex)
    setBattle({ active: true, opponent: wild })
    setTurn('player')
    addMessage(`A wild ${wild.name} appeared!`)
  }

  const closeBattle = (resultMessage) => {
    addMessage(resultMessage)
    setBattle({ active: false, opponent: null })
    setTurn('player')
  }

  const currentMember = team[activeMember]

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
      closeBattle(`The wild ${battle.opponent.name} was pacified. Your team gained confidence!`)
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
    addMessage(`Wild ${opponentState.name} strikes with ${foeAbility.name}! (${damage} dmg) `)

    const targetHp = team[activeMember].hp - damage
    if (targetHp <= 0) {
      const nextAlive = team.findIndex((creature) => creature.hp > 0)
      if (nextAlive === -1) {
        closeBattle('Your team is out of stamina. You retreat to the nearest plaza to recover.')
        healTeam()
        setPlayerPosition({ x: 1, y: 1 })
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
    closeBattle('You retreat to rethink your approach. The wild creature wanders off.')
  }

  const resetExploration = () => {
    setPlayerPosition({ x: 1, y: 1 })
    healTeam()
    setMessageLog([
      'Your team regroups at the island gate with renewed focus.',
      'Use the arrow keys or WASD to move. Wander in the grass to find encounters.',
    ])
    setBattle({ active: false, opponent: null })
    setTurn('player')
    setIsPaused(false)
    setBackpackOpen(false)
  }

  const cameraX = Math.min(Math.max(playerPosition.x - Math.floor(VIEWPORT.width / 2), 0), mapWidth - VIEWPORT.width)
  const cameraY = Math.min(Math.max(playerPosition.y - Math.floor(VIEWPORT.height / 2), 0), mapHeight - VIEWPORT.height)

  const visibleTiles = MAP_LAYOUT.slice(cameraY, cameraY + VIEWPORT.height).map((row) =>
    row.slice(cameraX, cameraX + VIEWPORT.width)
  )

  return (
    <div className="page">
      <header className="header">
        <div>
          <p className="eyebrow">Sunpetal Isles</p>
          <h1>Mon Bound — Tiny Adventure</h1>
          <p className="sub">Explore, befriend, and spar with vivid little spirits in a cozy archipelago.</p>
        </div>
        <button className="secondary" onClick={resetExploration}>
          Reset Run
        </button>
      </header>

      <section className="layout">
        <div className="map-card">
          <div
            className="map"
            style={{
              gridTemplateColumns: `repeat(${VIEWPORT.width}, 1fr)`,
              gridTemplateRows: `repeat(${VIEWPORT.height}, 1fr)`,
            }}
          >
            {visibleTiles.map((row, yOffset) =>
              row.split('').map((tileChar, xOffset) => {
                const x = cameraX + xOffset
                const y = cameraY + yOffset
                const tile = TILE_TYPES[tileChar]
                const isPlayer = playerPosition.x === x && playerPosition.y === y
                return (
                  <div
                    key={`${x}-${y}`}
                    className={`tile tile-${tile.key}`}
                    style={{ backgroundColor: tile.color }}
                  >
                    {isPlayer ? <div className="player" /> : null}
                  </div>
                )
              })
            )}
          </div>
          <div className="legend">
            {Object.values(TILE_TYPES).map((tile) => (
              <div key={tile.key} className="legend-item">
                <span className="swatch" style={{ backgroundColor: tile.color }} />
                <span>{tile.label}</span>
              </div>
            ))}
            <div className="legend-item">
              <span className="swatch player-swatch" /> <span>Player</span>
            </div>
          </div>
          <p className="hint">Currently standing on: {currentTile.label}</p>
          <p className="hint">View window: {VIEWPORT.width} × {VIEWPORT.height}</p>
        </div>

        <div className="panel">
          <div className="team">
            <h2>Companions</h2>
            <div className="team-grid">
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
                      <div
                        className="hp-fill"
                        style={{ width: `${(member.hp / member.maxHp) * 100}%` }}
                      />
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
          </div>

          <div className="log">
            <h2>Adventure Log</h2>
            <ul>
              {messageLog.map((entry, index) => (
                <li key={index}>{entry}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {isPaused ? (
        <div className="overlay">
          <div className="overlay-card">
            <p className="eyebrow">Paused</p>
            <h2>Take a breather</h2>
            <p className="sub">Review your plan or hop back into your stroll across the isles.</p>
            <div className="overlay-actions">
              <button className="secondary" onClick={() => setIsPaused(false)}>
                Resume Adventure
              </button>
              <button className="secondary" onClick={resetExploration}>
                Return to Plaza
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
                <p className="eyebrow">Encounter</p>
                <h2>Wild {battle.opponent.name}</h2>
                <p className="sub">A curious creature challenges your lead companion.</p>
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
    </div>
  )
}

export default App
