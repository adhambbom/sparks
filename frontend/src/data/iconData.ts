// Skill icon glyphs - simple pixel-style symbols mapped per ability
export const ABILITY_ICONS: Record<string, { glyph: string; bg: string; border: string }> = {
  power_strike:    { glyph: '✊', bg: '#3a2814', border: '#d8a050' },
  plasma_blade:    { glyph: '⚔', bg: '#3a1818', border: '#ff4040' },
  overload:        { glyph: '⚡', bg: '#3a2a08', border: '#ffaa00' },
  mech_slam:       { glyph: '☄', bg: '#2a1a1a', border: '#ff6040' },
  rocket_punch:    { glyph: '➶', bg: '#3a1808', border: '#ff8030' },
  phase_step:      { glyph: '◇', bg: '#1a0a2a', border: '#a050ff' },
  mind_blast:      { glyph: '✦', bg: '#2a0a3a', border: '#ff2dd4' },
  healing_pulse:   { glyph: '✚', bg: '#0a3a1a', border: '#39ff14' },
  rage_burst:      { glyph: '☢', bg: '#3a1818', border: '#ff3860' },
  time_warp:       { glyph: '⌛', bg: '#1a1a3a', border: '#a0a0ff' },
  hack:            { glyph: '⌬', bg: '#0a1a3a', border: '#00f0ff' },
  reboot:          { glyph: '↻', bg: '#0a2a1a', border: '#39ff14' },
  virus:           { glyph: '☠', bg: '#1a0a1a', border: '#a020a0' },
  data_shield:     { glyph: '◈', bg: '#0a1a3a', border: '#00aaff' },
  mind_control:    { glyph: '👁', bg: '#1a0a3a', border: '#ff2dd4' },
  // House signatures
  stealth_strike:  { glyph: '✦', bg: '#1a0a14', border: '#a85a5a' },
  plasma_aegis:    { glyph: '◆', bg: '#0a1428', border: '#3878d4' },
  vine_barrage:    { glyph: '⚝', bg: '#0a1e14', border: '#3eb86b' },
  ground_slam:     { glyph: '☷', bg: '#1e0a0a', border: '#d83a3a' },
};

export const DEFAULT_ABILITY_ICON = { glyph: '✱', bg: '#1a1a2e', border: '#6464a8' };
