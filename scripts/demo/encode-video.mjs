import { spawnSync } from 'node:child_process'

const GIF_WIDTH = 1200
const GIF_FPS = 12

function ffmpeg(args) {
  const result = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], {
    stdio: 'inherit',
  })

  if (result.error) {
    throw new Error(
      `cannot run ffmpeg (${result.error.message}). Install it with brew install ffmpeg`,
    )
  }

  if (result.status !== 0) {
    throw new Error(`ffmpeg exited with ${result.status}`)
  }
}

/**
 * Cut the first `skipSeconds` off Playwright's WebM, which start before the
 * stage loads, and write an MP4 for social media and a GIF for README files
 * next to it, from the same cut.
 */
export function encodeVideo(webm, { skipSeconds, mp4, gif }) {
  const cut = ['-ss', skipSeconds.toFixed(2), '-i', webm]

  ffmpeg([
    ...cut,
    '-c:v',
    'libx264',
    '-crf',
    '20',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    mp4,
  ])

  const filters = [
    `fps=${GIF_FPS}`,
    `scale=${GIF_WIDTH}:-1:flags=lanczos`,
    'split[a][b]',
    '[a]palettegen=max_colors=160:stats_mode=diff[p]',
    '[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle',
  ]

  ffmpeg([...cut, '-vf', filters.join(','), gif])
}
